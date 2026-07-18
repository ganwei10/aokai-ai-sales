// 监控配置中心：搜索网站 / 监控(招聘)网站 / 招聘关键词 / 信号分类关键词
// 全部可在 UI 增删改、持久化（KV 优先，否则本地 data/config.json，再内存缓存）。
import { promises as fs } from "fs";
import path from "path";

// ---------- 类型 ----------
export type SearchSiteEngine = "duckduckgo" | "wikipedia" | "brave" | "serp" | "tavily" | "custom";

export interface SearchSite {
  id: string;
  name: string;
  kind: "builtin" | "custom"; // builtin = 系统内置解析器；custom = 用户自定义 URL 模板
  engine: SearchSiteEngine;
  urlTemplate?: string; // 仅 custom：支持 {{query}} 占位符，如 https://news.example.com/search?q={{query}}
  enabled: boolean;
  weight: number; // 扫描顺序，越小越优先
}

export interface WatchSite {
  id: string;
  name: string; // 显示名，如 "Indeed"
  host: string; // 用于 site: 语法的域名，如 "indeed.com"
  enabled: boolean;
  weight: number;
}

export interface RecruitKeyword {
  id: string;
  query: string; // 招聘监控查询词
  enabled: boolean;
}

export interface SignalKeyword {
  id: string;
  label: string; // 信号类型名，如 "产能扩张"
  sentiment: "positive" | "neutral" | "negative";
  relevance: string; // 对拓业的业务含义
  patterns: string[]; // 匹配词（合并为正则，不区分大小写）
  enabled: boolean;
}

export interface MonitorConfig {
  searchSites: SearchSite[];
  watchSites: WatchSite[];
  recruitKeywords: RecruitKeyword[];
  signalKeywords: SignalKeyword[];
}

export type ConfigCollection = keyof MonitorConfig;

const KV_KEY = "aokai-sales-config";
let cache: MonitorConfig | null = null;
const DATA_FILE = path.join(process.cwd(), "data", "config.json");

// ---------- 默认值（迁移自原硬编码 RECRUIT_QUERIES / OUTBOUND_TYPES）----------
function defaultConfig(): MonitorConfig {
  return {
    searchSites: [
      { id: "ss-ddg", name: "DuckDuckGo", kind: "builtin", engine: "duckduckgo", enabled: true, weight: 1 },
      { id: "ss-wiki", name: "Wikipedia", kind: "builtin", engine: "wikipedia", enabled: true, weight: 2 },
      { id: "ss-brave", name: "Brave Search", kind: "builtin", engine: "brave", enabled: false, weight: 3 },
      { id: "ss-serp", name: "SerpAPI", kind: "builtin", engine: "serp", enabled: false, weight: 4 },
      { id: "ss-tavily", name: "Tavily", kind: "builtin", engine: "tavily", enabled: false, weight: 5 },
    ],
    watchSites: [
      { id: "ws-indeed", name: "Indeed", host: "indeed.com", enabled: true, weight: 1 },
      { id: "ws-linkedin", name: "LinkedIn Jobs", host: "linkedin.com/jobs", enabled: true, weight: 2 },
      { id: "ws-workopolis", name: "Workopolis", host: "workopolis.com", enabled: true, weight: 3 },
      { id: "ws-eluta", name: "Eluta", host: "eluta.ca", enabled: true, weight: 4 },
    ],
    recruitKeywords: [
      { id: "rk-1", query: "packaging line operator meat processing plant Ontario Canada", enabled: true },
      { id: "rk-2", query: "food production supervisor poultry processor hiring", enabled: true },
      { id: "rk-3", query: "meat packing plant hiring multiple shifts Midwest", enabled: true },
      { id: "rk-4", query: "automation technician protein processing facility", enabled: true },
    ],
    signalKeywords: [
      { id: "sk-cap", label: "产能扩张", sentiment: "positive", relevance: "扩产带来新线/后道自动化需求，优先跟进产能规划负责人。", patterns: ["expand", "capacity", "new (line|plant|facility)", "add .* shift"], enabled: true },
      { id: "sk-hire", label: "招聘扩张", sentiment: "positive", relevance: "大批量招工印证产能/产线扩张，自动化替代需求强。", patterns: ["hir", "recruit", "add .* jobs", "staffing"], enabled: true },
      { id: "sk-new", label: "新产线/新品", sentiment: "positive", relevance: "新产线/新品上线需配套包装与检测自动化。", patterns: ["new product", "launch", "rollout", "line"], enabled: true },
      { id: "sk-fin", label: "融资/投资", sentiment: "positive", relevance: "获融资后资本开支意愿强，是设备采购窗口期。", patterns: ["fund", "financ", "invest", "series ", "raise", "capital"], enabled: true },
      { id: "sk-ma", label: "并购", sentiment: "positive", relevance: "并购后产能整合，存在整线标准化与自动化机会。", patterns: ["acqui", "merger", "consolidat"], enabled: true },
      { id: "sk-close", label: "关厂/减产", sentiment: "negative", relevance: "减产/关厂短期抑制需求，但可能催生产线整合与改造。", patterns: ["clos", "shut", "cut", "layoff", "slowdown", "reduc"], enabled: true },
      { id: "sk-mgmt", label: "管理层变动", sentiment: "neutral", relevance: "新管理层常带来设备更新与效率改造议程，可重新触达。", patterns: ["appoint", "name .* (ceo|vp|president)", "leadership", "hire .* (ceo|coo)"], enabled: true },
      { id: "sk-cert", label: "认证/合规", sentiment: "positive", relevance: "认证/合规升级推动可追溯与自动化改造需求。", patterns: ["certif", "sqf", "cfia", "fsma", "audit", "complian"], enabled: true },
      { id: "sk-award", label: "奖项/新闻", sentiment: "positive", relevance: "品牌向好、曝光增加，可作为破冰切入话题。", patterns: ["award", "recogni", "ranked", "featured"], enabled: true },
      { id: "sk-neg", label: "负面事件", sentiment: "negative", relevance: "召回/违规/罢工等负面，短期谨慎，长线看自动化降风险机会。", patterns: ["recall", "violation", "lawsuit", "strike", "outbreak", "contaminat"], enabled: true },
    ],
  };
}

// ---------- 持久化：KV 优先 → 本地文件 → 内存 ----------
function kvConfigured(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

export function persistenceMode(): "vercel-kv" | "local-file" | "in-memory" {
  if (kvConfigured()) return "vercel-kv";
  try {
    require("fs");
    return "local-file";
  } catch {
    return "in-memory";
  }
}

async function loadKV(): Promise<MonitorConfig | null> {
  if (!kvConfigured()) return null;
  try {
    const { kv } = await import("@vercel/kv");
    const data = await kv.get<MonitorConfig>(KV_KEY);
    return data ?? null;
  } catch {
    return null;
  }
}

async function saveKV(c: MonitorConfig): Promise<void> {
  if (!kvConfigured()) return;
  try {
    const { kv } = await import("@vercel/kv");
    await kv.set(KV_KEY, c);
  } catch {
    /* 忽略持久化失败，保证主流程可用 */
  }
}

async function loadFile(): Promise<MonitorConfig | null> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw) as MonitorConfig;
    // 简单校验必备字段，避免旧文件导致崩溃
    if (!parsed || !Array.isArray(parsed.searchSites)) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function saveFile(c: MonitorConfig): Promise<void> {
  try {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(c, null, 2), "utf8");
  } catch {
    /* 本地文件不可写时降级为内存 */
  }
}

// ---------- 读取 / 保存 ----------
export async function getConfig(): Promise<MonitorConfig> {
  if (cache) return cache;
  const fromKV = await loadKV();
  if (fromKV) {
    cache = fromKV;
    return cache;
  }
  const fromFile = await loadFile();
  cache = fromFile ?? defaultConfig();
  return cache;
}

export async function saveConfig(c: MonitorConfig): Promise<MonitorConfig> {
  cache = c;
  await saveKV(c);
  await saveFile(c);
  return c;
}

export function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

// ---------- 集合级增删改助手 ----------
export async function resetConfig(): Promise<MonitorConfig> {
  return saveConfig(defaultConfig());
}

export async function addItem(collection: ConfigCollection, item: any): Promise<MonitorConfig> {
  const c = await getConfig();
  c[collection] = [...c[collection], item];
  return saveConfig(c);
}

export async function updateItem(
  collection: ConfigCollection,
  id: string,
  patch: Record<string, any>
): Promise<MonitorConfig> {
  const c = await getConfig();
  c[collection] = c[collection].map((x: any) => (x.id === id ? { ...x, ...patch } : x)) as any;
  return saveConfig(c);
}

export async function removeItem(collection: ConfigCollection, id: string): Promise<MonitorConfig> {
  const c = await getConfig();
  c[collection] = c[collection].filter((x: any) => x.id !== id) as any;
  return saveConfig(c);
}
