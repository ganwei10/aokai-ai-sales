// 搜索抽象层：真实联网搜索（配 key 即用）+ 合成回退（无 key 也能演示）
// 真实来源：Brave Search / SerpAPI / Tavily（由 WEB_SEARCH_ENGINE 选择）
// 招聘来源：Adzuna（ADZUNA_APP_ID / ADZUNA_APP_KEY）或合成

export interface SearchResult {
  title: string;
  snippet: string;
  url: string;
  date?: string;
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

const ENGINE = (process.env.WEB_SEARCH_ENGINE || "brave").toLowerCase();
const KEY = process.env.WEB_SEARCH_API_KEY || "";
const ADZUNA_ID = process.env.ADZUNA_APP_ID || "";
const ADZUNA_KEY = process.env.ADZUNA_APP_KEY || "";

export function searchMode(): "live" | "demo" {
  return KEY ? "live" : "demo";
}

// ---------- 全网搜索 ----------
export async function webSearch(query: string): Promise<SearchResult[]> {
  if (!KEY) return syntheticWeb(query);
  try {
    if (ENGINE === "serp") return await serp(query);
    if (ENGINE === "tavily") return await tavily(query);
    return await brave(query);
  } catch (e) {
    return syntheticWeb(query);
  }
}

async function brave(query: string): Promise<SearchResult[]> {
  const url = "https://api.search.brave.com/res/v1/web/search?count=8&q=" + encodeURIComponent(query);
  const r = await fetch(url, { headers: { Accept: "application/json", "X-Subscription-Token": KEY } });
  const j = await r.json();
  return (j.web?.results || []).map((x: any) => ({ title: x.title, snippet: x.description || "", url: x.url, date: x.page_age || x.age }));
}
async function serp(query: string): Promise<SearchResult[]> {
  const url = "https://serpapi.com/search.json?engine=google&num=8&q=" + encodeURIComponent(query) + "&api_key=" + KEY;
  const r = await fetch(url);
  const j = await r.json();
  return (j.organic_results || []).map((x: any) => ({ title: x.title, snippet: x.snippet || "", url: x.link, date: x.date }));
}
async function tavily(query: string): Promise<SearchResult[]> {
  const r = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: KEY, query, max_results: 8 }),
  });
  const j = await r.json();
  return (j.results || []).map((x: any) => ({ title: x.title, snippet: x.content || "", url: x.url, date: x.published_date }));
}

// 合成搜索结果（演示，按 query 确定性生成）
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

// 合成招聘职位（演示）：返回若干肉企职位，公司名部分与库内重叠、部分为新公司
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
      company: company,
      title: title,
      location: rng() < 0.5 ? "Ontario, CA" : "Midwest, US",
      snippet: company + " is hiring a " + title + ". Growing production volume; multiple shifts available.",
      url: "https://example.com/jobs/" + (hash(company + i) % 99999),
    });
  }
  return out;
}
