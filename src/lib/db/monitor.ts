// 双向监控引擎
// 方向A 入站（招聘发现）：扫招聘职位 → 抽取公司名 → 库中已有则标「招聘缺工」信号，库中没有则进「待评估」池
// 方向B 出站（全网动态）：对库内每家公司全网扫描 → 收集任何利于拓业的动态信号（产能/融资/并购/管理层…）
import { getDb, addSignal, addDiscovered, addRun, getCustomer } from "./store";
import { webSearch, recruitmentSearch, searchMode, liveEngineLabel, type SearchResult, type JobPosting } from "./search";
import type {
  ChannelPartner,
  Customer,
  DiscoveredCompany,
  EntityType,
  MonitorRun,
  Signal,
  SignalSentiment,
  SignalType,
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

function ADZUNA_SOURCE(): string {
  return process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY ? "Adzuna(Live)" : "合成招聘数据(演示)";
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 18);
}

// 避免重复信号
function exists(entityType: EntityType, entityId: string, title: string): boolean {
  return getDb().signals.some((s) => s.entityType === entityType && s.entityId === entityId && s.title === title);
}

// ---------------- 方向A：入站招聘发现 ----------------
const RECRUIT_QUERIES = [
  "packaging line operator meat processing plant Ontario Canada",
  "food production supervisor poultry processor hiring",
  "meat packing plant hiring multiple shifts Midwest",
  "automation technician protein processing facility",
];

export async function runInboundScan(): Promise<{ run: MonitorRun; discovered: DiscoveredCompany[]; matched: number }> {
  const runId = rid();
  const started = new Date().toISOString();
  const run: MonitorRun = {
    id: runId,
    direction: "inbound",
    source: ADZUNA_SOURCE(),
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

  // 为了让演示同时展现「命中已有客户」与「发现新公司」两条路径，
  // 将一小部分招聘公司名替换为库内真实客户名。
  const customers = db.customers;

  for (const q of RECRUIT_QUERIES) {
    const jobs: JobPosting[] = await recruitmentSearch(q);
    scanned += jobs.length;
    // 注入 1 条命中的库内客户（仅首轮）
    if (q === RECRUIT_QUERIES[0] && customers.length) {
      const c = customers[Math.floor(seededRng(q)() * customers.length)];
      jobs.unshift({
        company: c.company,
        title: "Packaging Line Operator",
        location: `${c.city}, ${c.province}`,
        snippet: `${c.company} is hiring packaging line operators across multiple shifts.`,
        url: "https://example.com/jobs/injected",
      });
    }
    for (const job of jobs) {
      const existing = db.customers.find((c) => norm(c.company) === norm(job.company));
      if (existing) {
        if (!exists("customer", existing.id, "招聘缺工：" + job.title)) {
          addSignal({
            id: rid(),
            entityType: "customer",
            entityId: existing.id,
            entityName: existing.company,
            type: "招聘缺工",
            title: `招聘缺工：${job.title}`,
            summary: job.snippet,
            url: job.url,
            source: "招聘监控(入站)",
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
      if (db.discovered.some((d) => norm(d.company) === norm(job.company))) continue;
      const d: DiscoveredCompany = {
        id: "D-" + (db.discovered.length + 1).toString().padStart(3, "0") + "x" + Math.random().toString(36).slice(2, 5),
        company: job.company,
        city: job.location.split(",")[0] || null,
        province: job.location.split(",")[1]?.trim() || null,
        region: /ontario|canada/i.test(job.location) ? "安省" : /midwest|us|il|wi|mi|oh|in|ia|mn|ne|sd/i.test(job.location) ? "美中" : null,
        source: "recruitment",
        discoveredAt: new Date().toISOString().slice(0, 10),
        query: q,
        snippet: job.snippet,
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
        title: `招聘发现：${job.title}`,
        summary: job.snippet,
        url: job.url,
        source: "招聘监控(入站)",
        date: d.discoveredAt,
        sentiment: "positive",
        businessRelevance: "招聘活跃，疑似扩张/缺工，有待评估是否纳入客户池。",
        region: d.region ?? undefined,
      });
      newDiscovered.push(d);
      run.newDiscovered++;
      run.newSignals++;
    }
  }

  run.scanned = scanned;
  run.found = matched + newDiscovered.length;
  run.status = "done";
  run.finishedAt = new Date().toISOString();
  return { run, discovered: newDiscovered, matched };
}

// ---------------- 方向B：出站全网动态 ----------------
const OUTBOUND_TYPES: { type: SignalType; sentiment: SignalSentiment; relevance: string; kw: RegExp }[] = [
  { type: "产能扩张", sentiment: "positive", relevance: "扩产带来新线/后道自动化需求，优先跟进产能规划负责人。", kw: /expand|capacity|new (line|plant|facility)|add .* shift/i },
  { type: "招聘扩张", sentiment: "positive", relevance: "大批量招工印证产能/产线扩张，自动化替代需求强。", kw: /hir|recruit|add .* jobs|staffing/i },
  { type: "新产线/新品", sentiment: "positive", relevance: "新产线/新品上线需配套包装与检测自动化。", kw: /new product|launch|rollout|line/i },
  { type: "融资/投资", sentiment: "positive", relevance: "获融资后资本开支意愿强，是设备采购窗口期。", kw: /fund|financ|invest|series |raise|capital/i },
  { type: "并购", sentiment: "positive", relevance: "并购后产能整合，存在整线标准化与自动化机会。", kw: /acqui|merger|consolidat/i },
  { type: "关厂/减产", sentiment: "negative", relevance: "减产/关厂短期抑制需求，但可能催生产线整合与改造。", kw: /clos|shut|cut|layoff|slowdown|reduc/i },
  { type: "管理层变动", sentiment: "neutral", relevance: "新管理层常带来设备更新与效率改造议程，可重新触达。", kw: /appoint|name .* (ceo|vp|president)|leadership|hire .* (ceo|coo)/i },
  { type: "认证/合规", sentiment: "positive", relevance: "认证/合规升级推动可追溯与自动化改造需求。", kw: /certif|sqf|cfia|fsma|audit|complian/i },
  { type: "奖项/新闻", sentiment: "positive", relevance: "品牌向好、曝光增加，可作为破冰切入话题。", kw: /award|recogni|ranked|featured/i },
  { type: "负面事件", sentiment: "negative", relevance: "召回/违规/罢工等负面，短期谨慎，长线看自动化降风险机会。", kw: /recall|violation|lawsuit|strike|outbreak|contaminat/i },
];

function classify(text: string): typeof OUTBOUND_TYPES[number] | null {
  for (const t of OUTBOUND_TYPES) if (t.kw.test(text)) return t;
  return null;
}

async function scanEntity(type: EntityType, id: string, name: string, region?: string) {
  // 始终发起真实联网搜索（无 key 时自动走 DuckDuckGo 真实搜索；失败才回退合成）
  const results: SearchResult[] = await webSearch(
    `"${name}" meat processing OR poultry OR pork OR beef expansion OR hiring OR investment OR acquisition OR automation OR plant`
  );
  let added = 0;
  const firstWord = name.toLowerCase().split(/\s+/)[0];
  for (const r of results) {
    if (added >= 3) break; // 每实体最多 3 条真实信号，避免噪声
    const text = (r.title + " " + r.snippet).toLowerCase();
    let pick = classify(text);
    if (!pick) {
      // 真实结果未命中关键词，但提及该公司（或明显业务词）→ 记为「全网动态」供人工研判
      const biz = /expansion|hire|hiring|recruit|invest|acqui|automation|plant|production|certif|recall|layoff|new line|capacity|financ/i;
      if (text.includes(firstWord) || biz.test(text)) {
        pick = { type: "全网动态", sentiment: "neutral", relevance: "公开网络出现与该公司相关的动态，建议人工研判是否利于拓业。", kw: /./ };
      } else {
        continue;
      }
    }
    const title = `${name}：${pick.type}`;
    if (exists(type, id, title)) continue;
    addSignal({
      id: rid(), entityType: type, entityId: id, entityName: name,
      type: pick.type, title, summary: r.snippet || r.title,
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
  const started = new Date().toISOString();
  const run: MonitorRun = {
    id: rid(), direction: "outbound",
    source: liveEngineLabel(),
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
    await scanEntity(t.type, t.id, t.name, t.region);
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
