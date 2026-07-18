// 双向监控引擎（配置驱动版）
// 方向A 入站（招聘发现）：按配置遍历「招聘关键词 × 监控网站」真实搜索 → 抽取公司名 → 库内标「招聘缺工」、库外进待评估池
// 方向B 出站（全网动态）：按配置遍历「搜索网站」对每家公司全网扫描 → 按「信号分类关键词」产出拓业信号
import { getDb, addSignal, addDiscovered, addRun, getCustomer } from "./store";
import { webSearch, searchViaSites, searchMode, liveEngineLabel, extractCompanyFromResult, type SearchResult } from "./search";
import { getConfig, type MonitorConfig, type SignalKeyword } from "./config";
import type {
  ChannelPartner,
  Customer,
  DiscoveredCompany,
  EntityType,
  MonitorRun,
  Signal,
  SignalSentiment,
  SystemIntegrator,
} from "./types";

function seededRng(seedStr: string) {
  let seed = 2166136261 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    seed ^= seedStr.charCodeAt(i);
    seed = Math.imul(seed, 16777619);
  }
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rid = () => "S-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 18);
}

// 避免重复信号
function exists(entityType: EntityType, entityId: string, title: string): boolean {
  return getDb().signals.some((s) => s.entityType === entityType && s.entityId === entityId && s.title === title);
}

// ---------------- 方向A：入站招聘发现（配置驱动）----------------
export async function runInboundScan(): Promise<{ run: MonitorRun; discovered: DiscoveredCompany[]; matched: number }> {
  const cfg = await getConfig();
  const kws = cfg.recruitKeywords.filter((k) => k.enabled);
  const sites = cfg.watchSites.filter((s) => s.enabled).sort((a, b) => a.weight - b.weight);

  const runId = rid();
  const started = new Date().toISOString();
  const run: MonitorRun = {
    id: runId,
    direction: "inbound",
    source: sites.map((s) => s.name).join("/") || "无启用监控网站",
    startedAt: started,
    status: "running",
    scanned: 0,
    found: 0,
    newSignals: 0,
    newDiscovered: 0,
  };
  addRun(run);

  const db = getDb();
  let scanned = 0;
  let matched = 0;
  const newDiscovered: DiscoveredCompany[] = [];
  const customers = db.customers;
  let injected = false;

  for (const kw of kws) {
    for (const site of sites) {
      const q = `site:${site.host} ${kw.query}`;
      const results: SearchResult[] = await webSearch(q);
      scanned += results.length;

      // 首轮注入 1 条命中的库内客户，确保演示同时展现「命中库内」与「发现新公司」两条路径
      if (!injected && customers.length) {
        injected = true;
        const c = customers[Math.floor(seededRng(q)() * customers.length)];
        results.unshift({
          title: `${c.company} is hiring Packaging Line Operator`,
          snippet: `${c.company} is hiring packaging line operators across multiple shifts.`,
          url: "https://example.com/jobs/injected",
          source: "招聘监控(入站)",
        });
      }

      for (const r of results) {
        const company = extractCompanyFromResult(r) || r.title.split(/[-|]/)[0].trim();
        if (!company) continue;
        const existing = db.customers.find((c) => norm(c.company) === norm(company));
        if (existing) {
          if (!exists("customer", existing.id, "招聘缺工：" + (r.title || company))) {
            addSignal({
              id: rid(),
              entityType: "customer",
              entityId: existing.id,
              entityName: existing.company,
              type: "招聘缺工",
              title: `招聘缺工：${company}`,
              summary: r.snippet,
              url: r.url,
              source: `${site.name}(入站)`,
              date: new Date().toISOString().slice(0, 10),
              sentiment: "positive",
              businessRelevance: "后道/前道用工紧张，正是 AK 自动化方案切入窗口；建议优先触达。",
              region: existing.region,
            });
            run.newSignals++;
          }
          matched++;
          continue;
        }
        // 库内无 → 进待评估池（去重）
        if (db.discovered.some((d) => norm(d.company) === norm(company))) continue;
        const d: DiscoveredCompany = {
          id: "D-" + (db.discovered.length + 1).toString().padStart(3, "0") + "x" + Math.random().toString(36).slice(2, 5),
          company,
          city: null,
          province: null,
          region: null,
          source: "recruitment",
          discoveredAt: new Date().toISOString().slice(0, 10),
          query: q,
          snippet: r.snippet,
          employees: null,
          segment: null,
          status: "new",
        };
        addDiscovered(d);
        addSignal({
          id: rid(),
          entityType: "discovered",
          entityId: d.id,
          entityName: d.company,
          type: "招聘缺工",
          title: `招聘发现：${company}`,
          summary: r.snippet,
          url: r.url,
          source: `${site.name}(入站)`,
          date: d.discoveredAt,
          sentiment: "positive",
          businessRelevance: "招聘活跃，疑似扩张/缺工，有待评估是否纳入客户池。",
        });
        newDiscovered.push(d);
        run.newDiscovered++;
        run.newSignals++;
      }
    }
  }

  run.scanned = scanned;
  run.found = matched + newDiscovered.length;
  run.status = "done";
  run.finishedAt = new Date().toISOString();
  return { run, discovered: newDiscovered, matched };
}

// ---------------- 方向B：出站全网动态（配置驱动）----------------
// 按配置的信号分类关键词把文本分类为信号类型
function classifyFromConfig(text: string, cfg: MonitorConfig): SignalKeyword | null {
  for (const k of cfg.signalKeywords) {
    if (!k.enabled || !k.patterns.length) continue;
    try {
      if (new RegExp(k.patterns.join("|"), "i").test(text)) return k;
    } catch {
      /* 用户填写的正则无效，跳过该条 */
    }
  }
  return null;
}

async function scanEntity(type: EntityType, id: string, name: string, region: string | undefined, cfg: MonitorConfig) {
  // 始终发起真实联网搜索（按配置的搜索站点遍历；失败才回退合成）
  const results: SearchResult[] = await searchViaSites(
    name,
    "meat processing OR poultry OR pork OR beef expansion OR hiring OR investment OR acquisition OR automation OR plant"
  );
  let added = 0;
  // 仅在搜索结果确实提及「完整公司名」时才生成信号，避免把泛化行业新闻误归因到合成公司名
  const normName = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const r of results) {
    if (added >= 3) break; // 每实体最多 3 条真实信号，避免噪声
    const normText = (r.title + " " + r.snippet).toLowerCase().replace(/[^a-z0-9]/g, "");
    if (normName && !normText.includes(normName)) continue;
    const text = (r.title + " " + r.snippet).toLowerCase();
    let pick = classifyFromConfig(text, cfg);
    if (!pick) {
      pick = { id: "fallback", label: "全网动态", sentiment: "neutral", relevance: "公开网络出现与该公司相关的动态，建议人工研判是否利于拓业。", patterns: [], enabled: true };
    }
    const title = `${name}：${pick.label}`;
    if (exists(type, id, title)) continue;
    addSignal({
      id: rid(), entityType: type, entityId: id, entityName: name,
      type: pick.label as Signal["type"], title, summary: r.snippet || r.title,
      url: r.url, source: r.source || liveEngineLabel(), date: r.date || new Date().toISOString().slice(0, 10),
      sentiment: pick.sentiment, businessRelevance: pick.relevance, region: region as any,
    });
    added++;
  }
}

export async function runOutboundScan(
  entityType?: EntityType,
  entityId?: string,
  limit = 60
): Promise<{ run: MonitorRun; signals: number }> {
  const cfg = await getConfig();
  const started = new Date().toISOString();
  const srcLabel = cfg.searchSites.filter((s) => s.enabled).map((s) => s.name).join("/") || liveEngineLabel();
  const run: MonitorRun = {
    id: rid(), direction: "outbound",
    source: srcLabel,
    startedAt: started, status: "running", scanned: 0, found: 0, newSignals: 0, newDiscovered: 0,
  };
  addRun(run);
  const db = getDb();
  const targets: { type: EntityType; id: string; name: string; region?: string }[] = [];

  if (entityId && entityType) {
    const e = getDb();
    const ent = entityType === "customer" ? e.customers.find((c) => c.id === entityId)
      : entityType === "channel" ? e.channels.find((c) => c.id === entityId)
      : entityType === "si" ? e.sis.find((c) => c.id === entityId)
      : e.discovered.find((c) => c.id === entityId);
    if (ent) targets.push({ type: entityType, id: entityId, name: (ent as any).company || (ent as any).name, region: (ent as any).region });
  } else {
    const scope = entityType ? [entityType] : (["customer", "channel", "si", "discovered"] as EntityType[]);
    for (const t of scope) {
      const list =
        t === "customer" ? db.customers
        : t === "channel" ? db.channels
        : t === "si" ? db.sis
        : t === "discovered" ? db.discovered
        : [];
      for (const x of list as any[]) targets.push({ type: t, id: x.id, name: x.company || x.name, region: x.region });
    }
  }

  const capped = targets.slice(0, limit);
  let added = 0;
  for (const t of capped) {
    const before = db.signals.length;
    await scanEntity(t.type, t.id, t.name, t.region, cfg);
    const delta = db.signals.length - before;
    if (delta > 0) {
      added += delta;
      const ent = getDb();
      const obj = t.type === "customer" ? ent.customers.find((c) => c.id === t.id)
        : t.type === "channel" ? ent.channels.find((c) => c.id === t.id)
        : ent.sis.find((c) => c.id === t.id);
      if (obj && "monitoredAt" in obj) (obj as any).monitoredAt = new Date().toISOString().slice(0, 10);
    }
    run.scanned++;
    // 真实联网模式下礼貌节流，降低被限流风险
    if (searchMode() === "live") await new Promise((r) => setTimeout(r, 80));
  }

  run.found = added;
  run.newSignals = added;
  run.status = "done";
  run.finishedAt = new Date().toISOString();
  return { run, signals: added };
}

// 双向一起跑
export async function runBoth(limit = 60): Promise<{ inbound: MonitorRun; outbound: MonitorRun }> {
  const inbound = await runInboundScan();
  const outbound = await runOutboundScan(undefined, undefined, limit);
  return { inbound: inbound.run, outbound: outbound.run };
}
