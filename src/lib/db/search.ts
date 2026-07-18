// 搜索抽象层：真实联网搜索 + 合成回退（无 key 也能演示）
//
// 真实来源（按 WEB_SEARCH_ENGINE 选择主引擎）：
//   - duckduckgo : 免 key 真实搜索（默认）。HTML 抓取为主，自动回退 DDG 速答 / Wikipedia
//   - brave      : Brave Search API（需 WEB_SEARCH_API_KEY）
//   - serp       : SerpAPI（需 WEB_SEARCH_API_KEY）
//   - tavily     : Tavily（需 WEB_SEARCH_API_KEY）
// 招聘来源：Adzuna（ADZUNA_APP_ID / ADZUNA_APP_KEY）或合成

export interface SearchResult {
  title: string;
  snippet: string;
  url: string;
  date?: string;
  source?: string; // 真实来源标记，用于信号溯源
}

export interface JobPosting {
  company: string;
  title: string;
  location: string;
  snippet: string;
  url: string;
}

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function seededRng(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const KEY = process.env.WEB_SEARCH_API_KEY || "";
const ADZUNA_ID = process.env.ADZUNA_APP_ID || "";
const ADZUNA_KEY = process.env.ADZUNA_APP_KEY || "";
// 无 key 时默认走 duckduckgo（真实联网，免 key）；有 key 时默认走 brave
const ENGINE = (process.env.WEB_SEARCH_ENGINE || (KEY ? "brave" : "duckduckgo")).toLowerCase();

// live = 会真正发起联网请求；demo = 仅合成数据
export function searchMode(): "live" | "demo" {
  return ENGINE === "duckduckgo" || KEY ? "live" : "demo";
}
export function liveEngineLabel(): string {
  if (ENGINE === "duckduckgo") return "DuckDuckGo(Live)";
  if (ENGINE === "serp") return "SerpAPI(Live)";
  if (ENGINE === "tavily") return "Tavily(Live)";
  return "Brave(Live)";
}

// 从查询串中提取公司名（取首对引号内文本，否则取前 3 个词）
function extractName(query: string): string {
  const m = query.match(/"([^"]+)"/);
  if (m) return m[1];
  return query.replace(/OR|meat processing|poultry|pork|beef|expansion|hiring|investment|acquisition|automation|plant/gi, " ").trim().split(/\s+/).slice(0, 3).join(" ");
}

// ---------- 全网搜索（真实优先，多级回退）----------
export async function webSearch(query: string): Promise<SearchResult[]> {
  const name = extractName(query);
  try {
    if (ENGINE !== "duckduckgo" && KEY) {
      if (ENGINE === "serp") return await serp(query);
      if (ENGINE === "tavily") return await tavily(query);
      return await brave(query);
    }
    // duckduckgo（默认）：HTML 抓取 → 速答 API → Wikipedia，逐级回退
    const html = await duckduckgo(query);
    if (html.length) return html;
    const ia = await ddgInstantAnswer(name);
    if (ia.length) return ia;
    const wk = await wikipedia(name);
    if (wk.length) return wk;
    return html; // 空数组，交由调用方回退合成
  } catch (e) {
    try {
      const wk = await wikipedia(name);
      if (wk.length) return wk;
    } catch {}
    return syntheticWeb(query);
  }
}

async function duckduckgo(query: string): Promise<SearchResult[]> {
  const url = "https://html.duckduckgo.com/html/?q=" + encodeURIComponent(query);
  const r = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      Accept: "text/html",
    },
  });
  const html = await r.text();
  if (/anomaly|unusual traffic|verify you are human/i.test(html)) return [];
  const results: SearchResult[] = [];
  const blockRe =
    /class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?class="result__snippet"[^>]*href="[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(html)) !== null && results.length < 8) {
    const rawHref = m[1];
    const title = decodeEntities(stripTags(m[2])).trim();
    const snippet = decodeEntities(stripTags(m[3])).trim();
    const real = extractUddg(rawHref);
    if (real && title) results.push({ title, snippet, url: real, source: "DuckDuckGo(HTML)" });
  }
  return results;
}

// DuckDuckGo 官方速答 API（免 key，返回实体摘要 + 相关词条真实链接）
async function ddgInstantAnswer(name: string): Promise<SearchResult[]> {
  const url = "https://api.duckduckgo.com/?q=" + encodeURIComponent(name) + "&format=json&no_html=1";
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  const j = await r.json();
  const out: SearchResult[] = [];
  if (j.Abstract && j.AbstractURL) {
    out.push({ title: j.Heading || name, snippet: j.Abstract, url: j.AbstractURL, source: "DuckDuckGo(IA)" });
  }
  for (const t of j.RelatedTopics || []) {
    if (t.FirstURL && t.Text) out.push({ title: t.Text.slice(0, 80), snippet: t.Text, url: t.FirstURL, source: "DuckDuckGo(IA)" });
  }
  return out.slice(0, 6);
}

// Wikipedia 搜索 API（真实、免 key、稳定）
async function wikipedia(name: string): Promise<SearchResult[]> {
  const url =
    "https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=" +
    encodeURIComponent(name + " meat") +
    "&srlimit=5&format=json";
  const r = await fetch(url, { headers: { "User-Agent": "aokai-sales/1.0 (market-research)" } });
  const j = await r.json();
  const out: SearchResult[] = [];
  for (const x of j.query?.search || []) {
    const title = x.title as string;
    out.push({
      title,
      snippet: decodeEntities(stripTags(x.snippet || "")),
      url: "https://en.wikipedia.org/wiki/" + title.replace(/ /g, "_"),
      source: "Wikipedia",
    });
  }
  return out;
}

function extractUddg(href: string): string {
  const i = href.indexOf("uddg=");
  if (i < 0) return "";
  let s = href.slice(i + 5);
  const amp = s.indexOf("&");
  if (amp >= 0) s = s.slice(0, amp);
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, " ");
}
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

async function brave(query: string): Promise<SearchResult[]> {
  const url = "https://api.search.brave.com/res/v1/web/search?count=8&q=" + encodeURIComponent(query);
  const r = await fetch(url, { headers: { Accept: "application/json", "X-Subscription-Token": KEY } });
  const j = await r.json();
  return (j.web?.results || []).map((x: any) => ({ title: x.title, snippet: x.description || "", url: x.url, date: x.page_age || x.age, source: "Brave" }));
}
async function serp(query: string): Promise<SearchResult[]> {
  const url = "https://serpapi.com/search.json?engine=google&num=8&q=" + encodeURIComponent(query) + "&api_key=" + KEY;
  const r = await fetch(url);
  const j = await r.json();
  return (j.organic_results || []).map((x: any) => ({ title: x.title, snippet: x.snippet || "", url: x.link, date: x.date, source: "SerpAPI" }));
}
async function tavily(query: string): Promise<SearchResult[]> {
  const r = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: KEY, query, max_results: 8 }),
  });
  const j = await r.json();
  return (j.results || []).map((x: any) => ({ title: x.title, snippet: x.content || "", url: x.url, date: x.published_date, source: "Tavily" }));
}

// 合成搜索结果（演示 / 真实全部失败时的兜底）
function syntheticWeb(query: string): SearchResult[] {
  const rng = seededRng(hash(query));
  const q = query.replace(/"/g, "");
  const topics = [
    "expands production capacity with new line",
    "secures growth financing to scale operations",
    "appoints new VP of Operations",
    "earns SQF certification for export market",
    "reports strong quarterly volume, hiring 50+",
    "explores automation partnership for packaging",
    "acquires regional competitor to widen footprint",
    "temporary line slowdown amid labor shortage",
  ];
  const n = 2 + Math.floor(rng() * 3);
  const out: SearchResult[] = [];
  for (let i = 0; i < n; i++) {
    const t = topics[Math.floor(rng() * topics.length)];
    const daysAgo = Math.floor(rng() * 120);
    const d = new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);
    out.push({
      title: q + " - " + t,
      snippet: q + " " + t + ". The move is seen as part of a broader expansion in the North American protein sector.",
      url: "https://example.com/news/" + (hash(query + i) % 99999),
      date: d,
      source: "合成(演示)",
    });
  }
  return out;
}

// ---------- 招聘扫描（入站发现）----------
export async function recruitmentSearch(query: string): Promise<JobPosting[]> {
  if (ADZUNA_ID && ADZUNA_KEY) {
    try {
      return await adzuna(query);
    } catch (e) {
      return syntheticJobs(query);
    }
  }
  return syntheticJobs(query);
}

async function adzuna(query: string): Promise<JobPosting[]> {
  const country = query.toLowerCase().includes("canada") || query.toLowerCase().includes("ontario") ? "ca" : "us";
  const url =
    "https://api.adzuna.com/v1/api/jobs/" + country + "/search/1?app_id=" + ADZUNA_ID + "&app_key=" + ADZUNA_KEY +
    "&results_per_page=20&what=" + encodeURIComponent(query);
  const r = await fetch(url);
  const j = await r.json();
  return (j.results || []).map((x: any) => ({
    company: x.company?.display_name || x.company || "Unknown",
    title: x.title || query,
    location: x.location?.display_name || "",
    snippet: (x.description || "").slice(0, 160),
    url: x.redirect_url || "",
  }));
}

const SYNTH_COMPANIES = [
  "MapleLeaf Proteins", "Cargill Foods", "Sofina Poultry", "Olymel Packers", "Burnbrae Farms",
  "Schneider Foods", "Conestoga Meats", "HyLife Pork", "DairyWorld Co", "Exceldor Cooperative",
  "Freshway Poultry", "NorthStar Beef", "Greenfield Processing", "Western Halal Meats", "PrairieHarvest",
  "Lakeside Foods", "Summit Protein", "Ironwood Meats", "HarvestGold", "BlueRibbon Poultry",
  "Ontario Premium Meats", "Grand River Foods", "Keystone Packers", "PolarStar Protein", "Riverside Provisions",
];

function syntheticJobs(query: string): JobPosting[] {
  const rng = seededRng(hash("job:" + query));
  const titles = [
    "Packaging Line Operator", "Production Supervisor - Packaging", "Maintenance Technician",
    "Quality Assurance Technician", "Shift Lead - Processing", "Automation Engineer",
  ];
  const n = 6 + Math.floor(rng() * 8);
  const out: JobPosting[] = [];
  for (let i = 0; i < n; i++) {
    const company = SYNTH_COMPANIES[Math.floor(rng() * SYNTH_COMPANIES.length)];
    const title = titles[Math.floor(rng() * titles.length)];
    out.push({
      company,
      title,
      location: rng() < 0.5 ? "Ontario, CA" : "Midwest, US",
      snippet: company + " is hiring a " + title + ". Growing production volume; multiple shifts available.",
      url: "https://example.com/jobs/" + (hash(company + i) % 99999),
    });
  }
  return out;
}

// ---------- 可配置站点搜索（出站动态，按配置遍历搜索网站）----------
import { getConfig } from "./config";

// 自定义站点通用解析：抓取页面中的外链标题，过滤出与查询词相关的少量结果
async function customSearch(urlTemplate: string, query: string): Promise<SearchResult[]> {
  const url = urlTemplate.replace("{{query}}", encodeURIComponent(query)).replace("{{name}}", encodeURIComponent(query));
  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        Accept: "text/html",
      },
    });
    const html = await r.text();
    const out: SearchResult[] = [];
    const re = /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null && out.length < 6) {
      const href = m[1];
      const title = decodeEntities(stripTags(m[2])).trim();
      if (title.length < 4) continue;
      if (/google|bing|duckduckgo|wikipedia|linkedin|indeed/i.test(href) && !/news|blog|article|press/i.test(href)) continue;
      out.push({ title, snippet: title, url: href, source: "自定义站点" });
    }
    return out;
  } catch {
    return [];
  }
}

// 按配置中的启用搜索站点，遍历抓取并合并去重
// name：公司名；extra：附加查询词（如 "expansion OR hiring ..."）
export async function searchViaSites(name: string, extra = ""): Promise<SearchResult[]> {
  const cfg = await getConfig();
  const sites = cfg.searchSites
    .filter((s) => s.enabled)
    .sort((a, b) => a.weight - b.weight);
  const out: SearchResult[] = [];
  const seen = new Set<string>();
  const q = `"${name}" ${extra}`.trim();
  for (const site of sites) {
    let res: SearchResult[] = [];
    if (site.engine === "duckduckgo") res = await duckduckgo(q);
    else if (site.engine === "wikipedia") res = await wikipedia(name);
    else if (site.engine === "brave") res = KEY ? await brave(q) : [];
    else if (site.engine === "serp") res = KEY ? await serp(q) : [];
    else if (site.engine === "tavily") res = KEY ? await tavily(q) : [];
    else if (site.engine === "custom" && site.urlTemplate) res = await customSearch(site.urlTemplate, q);
    for (const r of res) {
      if (seen.has(r.url)) continue;
      seen.add(r.url);
      out.push({ ...r, source: r.source || site.name });
    }
    if (out.length >= 10) break;
  }
  return out.slice(0, 12);
}

// ---------- 从招聘搜索结果中启发式抽取公司名 ----------
const SITE_NOISE = /(indeed|linkedin|glassdoor|workopolis|eluta|monster|ziprecruiter|careerbuilder|simplyhired|google|bing|duckduckgo)/i;
export function extractCompanyFromResult(r: SearchResult): string | null {
  const t = (r.title || "").trim();
  // "包装工 - 公司名 | Indeed" 模式
  const m1 = t.match(/\s[-–]\s+(.+?)(?:\s[|｜]\s.*)?$/);
  if (m1) {
    const cand = cleanCompany(m1[1]);
    if (cand) return cand;
  }
  // "Company is hiring ..." 模式
  const m2 = t.match(/^([A-Z][\w&.'-]+(?:\s+[A-Z][\w&.'-]+){0,3})\s+is\s+hiring/i);
  if (m2) return cleanCompany(m2[1]);
  // "... at Company" 模式
  const m3 = t.match(/\bat\s+([A-Z][\w&.'-]+(?:\s+[A-Z][\w&.'-]+){0,3})/);
  if (m3) return cleanCompany(m3[1]);
  // snippet 中 "Company is hiring"
  const m4 = (r.snippet || "").match(/([A-Z][\w&.'-]+(?:\s+[A-Z][\w&.'-]+){0,3})\s+is\s+hiring/i);
  if (m4) return cleanCompany(m4[1]);
  return null;
}
function cleanCompany(s: string): string | null {
  let v = s.replace(/[|｜].*$/, "").trim();
  if (!v || SITE_NOISE.test(v)) return null;
  if (v.length > 60) return null;
  return v;
}
