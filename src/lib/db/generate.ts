// 第二阶段数据库生成器（重构版，确定性可复现）
// 规模：300 客户（安省 180 / 美中 120）+ 70 渠道商（安省 42 / 美中 28）
//      + 30 SI（安省 18 / 美中 12）。三类实体彻底分离。

import type {
  Automation,
  ChannelPartner,
  ChannelType,
  Customer,
  CustStatus,
  DiscoveredCompany,
  Region,
  Segment,
  Signal,
  SystemIntegrator,
  SIType,
  ProductInterest,
  RecSignal,
  Tier,
} from "./types";

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ON_CITIES = [
  "Toronto", "Mississauga", "Brampton", "Guelph", "Kitchener", "Cambridge",
  "London", "Windsor", "Hamilton", "St. Catharines", "Brantford", "Stratford",
  "Woodstock", "Chatham", "Leamington", "Milton", "Waterloo", "Welland",
  "Belleville", "Peterborough", "Barrie", "Sarnia", "Cornwall", "Kingston",
  "Oshawa", "Niagara Falls", "Tillsonburg", "Simcoe", "St. Thomas", "Orangeville",
];

const US_CITIES: { city: string; prov: string }[] = [
  { city: "Chicago", prov: "IL" }, { city: "Cicero", prov: "IL" },
  { city: "Milwaukee", prov: "WI" }, { city: "Green Bay", prov: "WI" },
  { city: "Detroit", prov: "MI" }, { city: "Grand Rapids", prov: "MI" },
  { city: "Indianapolis", prov: "IN" }, { city: "Fort Wayne", prov: "IN" },
  { city: "Columbus", prov: "OH" }, { city: "Cleveland", prov: "OH" },
  { city: "Springfield", prov: "IL" }, { city: "St. Paul", prov: "MN" },
  { city: "Minneapolis", prov: "MN" }, { city: "Sioux City", prov: "IA" },
  { city: "Omaha", prov: "NE" }, { city: "Des Moines", prov: "IA" },
  { city: "Madison", prov: "WI" }, { city: "Toledo", prov: "OH" },
  { city: "Akron", prov: "OH" }, { city: "Lansing", prov: "MI" },
  { city: "Rockford", prov: "IL" }, { city: "South Bend", prov: "IN" },
  { city: "Davenport", prov: "IA" }, { city: "Cedar Rapids", prov: "IA" },
  { city: "Sioux Falls", prov: "SD" },
];

const SURNAMES = ["MacKenzie", "Thompson", "Ouellette", "Schmidt", "Nakamura", "Petrov", "Andersson", "OBrien", "Lefebvre", "Kowalski", "Romano", "Hansen", "Dubois", "Yamamoto", "Novak", "Bauer", "Costa", "Reyes", "Nguyen", "Patel", "Olsen", "Ferreira", "Kuznetsov", "Ibrahim", "Tanaka"];
const FIRST = ["James", "Marie", "David", "Sophie", "Liam", "Emma", "Noah", "Olivia", "Lucas", "Chloe", "Ethan", "Mia", "Ryan", "Ava", "Daniel", "Hannah", "Michael", "Claire", "Robert", "Laura"];
const SEG_WORDS = ["Poultry", "Beef", "Pork", "Meats", "Foods", "Protein", "Specialty", "Provisions"];
const SUFFIX = ["Foods", "Meats", "Poultry", "Packers", "Processing", "Provisions", "Butchers", "Foods Ltd.", "Protein"];
const PAIN = [
  "后道装袋高度依赖人工，招工难、流失高",
  "包装线节拍不稳，OEE 偏低",
  "合规审计（CFIA/FSMA）压力大，手工记录难追溯",
  "多 SKU 小批量切换频繁，换线损失大",
  "旺季产能瓶颈，无法按需扩产",
  "前道分割与后道装袋节拍不匹配，在制品堆积",
];
const DM_TITLE = ["Plant Manager", "Production Manager", "Operations Manager", "VP Manufacturing"];
const CH_PRE = ["Maple", "Grand River", "Bluewater", "Ironhorse", "Polar", "Summit", "Keystone", "Lakeside", "Prairie", "Northern", "Great Lakes", "Frontier", "Cascade", "Evergreen", "StClair", "Thunder", "Georgian", "Niagara", "Huron", "Erie"];
const CH_SUF = ["Trading", "Distribution", "Supply", "Machinery", "Agency", "Import"];
const SI_PRE = ["Precision", "Integra", "Apex", "Vector", "Cornerstone", "Meridian", "Tensor", "Helix", "Cobalt", "Atlas", "Veridian", "Quanta", "Lumen", "Forge", "Nexus", "Pinnacle"];
const SI_SUF = ["Automation", "Integration", "Robotics", "Systems", "Engineered", "Controls"];

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 14);
}

export interface DbBundle {
  customers: Customer[];
  channels: ChannelPartner[];
  sis: SystemIntegrator[];
  discovered: DiscoveredCompany[];
  signals: Signal[];
}

export function generateDatabase(): DbBundle {
  const rng = mulberry32(20270718);
  const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
  const randInt = (a: number, b: number) => a + Math.floor(rng() * (b - a + 1));
  const chance = (p: number) => rng() < p;

  // ---- 渠道商（70：安省 42 / 美中 28）----
  const channels: ChannelPartner[] = [];
  const ON_CH = 42;
  for (let i = 0; i < ON_CH + 28; i++) {
    const isOn = i < ON_CH;
    const region: Region = isOn ? "安省" : "美中";
    const loc = isOn ? pick(ON_CITIES) : pick(US_CITIES);
    const city = isOn ? (loc as string) : (loc as { city: string }).city;
    const province = isOn ? "ON" : (loc as { prov: string }).prov;
    const type: ChannelType = pick<ChannelType>(["经销商", "代理商"]);
    const name = `${pick(CH_PRE)} ${pick(CH_SUF)}`;
    const contact = `${pick(FIRST)} ${pick(SURNAMES)}`;
    const slug = slugify(name);
    channels.push({
      id: `CH-${String(i + 1).padStart(3, "0")}`,
      name,
      city,
      province,
      region,
      type,
      coverageKm: isOn ? randInt(80, 220) : randInt(120, 350),
      tierFocus: pick<"SME" | "大型" | "全">(["SME", "SME", "全", "大型"]),
      contact,
      email: `${contact.split(" ")[0].toLowerCase()}.${contact.split(" ")[1].toLowerCase()}@${slug}.ca`,
      commissionRate: 0.3,
      activeAccounts: randInt(3, 28),
      pipelineValueCad: randInt(4, 32) * 100000,
      status: chance(0.85) ? "active" : "pending",
    });
  }

  // ---- SI 系统集成商（30：安省 18 / 美中 12）----
  const sis: SystemIntegrator[] = [];
  const ON_SI = 18;
  for (let i = 0; i < ON_SI + 12; i++) {
    const isOn = i < ON_SI;
    const region: Region = isOn ? "安省" : "美中";
    const loc = isOn ? pick(ON_CITIES) : pick(US_CITIES);
    const city = isOn ? (loc as string) : (loc as { city: string }).city;
    const province = isOn ? "ON" : (loc as { prov: string }).prov;
    const type: SIType = pick<SIType>(["整线集成", "后道集成", "前道集成", "视觉检测"]);
    const name = `${pick(SI_PRE)} ${pick(SI_SUF)}`;
    const contact = `${pick(FIRST)} ${pick(SURNAMES)}`;
    const slug = slugify(name);
    sis.push({
      id: `SI-${String(i + 1).padStart(3, "0")}`,
      name,
      city,
      province,
      region,
      type,
      coverageKm: isOn ? randInt(80, 200) : randInt(120, 320),
      tierFocus: pick<"SME" | "大型" | "全">(["SME", "SME", "全", "大型"]),
      contact,
      email: `${contact.split(" ")[0].toLowerCase()}.${contact.split(" ")[1].toLowerCase()}@${slug}.ca`,
      commissionRate: 0.3,
      activeAccounts: randInt(2, 18),
      pipelineValueCad: randInt(3, 26) * 100000,
      status: chance(0.8) ? "active" : "pending",
    });
  }

  const onChannels = channels.filter((p) => p.region === "安省");
  const usChannels = channels.filter((p) => p.region === "美中");
  const onSi = sis.filter((p) => p.region === "安省");
  const usSi = sis.filter((p) => p.region === "美中");

  // ---- 客户（300：安省 180 / 美中 120）----
  const customers: Customer[] = [];
  for (let i = 0; i < 300; i++) {
    const isOn = i < 180;
    const region: Region = isOn ? "安省" : "美中";
    const loc = isOn ? ON_CITIES[i % ON_CITIES.length] : US_CITIES[(i - 180) % US_CITIES.length];
    const city = isOn ? (loc as string) : (loc as { city: string }).city;
    const province = isOn ? "ON" : (loc as { prov: string }).prov;

    const tier: Tier = chance(0.3) ? "Tier2" : "Tier3";
    const segment: Segment = pick<Segment>(["禽肉", "猪牛肉", "熟食/调理", "海鲜", "综合"]);
    const employees = randInt(45, 520);
    const revenueCad = Math.round((employees * randInt(110, 260)) / 1000) * 1000;

    const productInterest: ProductInterest = pick<ProductInterest>(["AK201000", "AK201000", "AK0200", "AK0200", "整线", "其他"]);
    const painPoint = pick(PAIN);

    const dmFirst = pick(FIRST);
    const dmLast = pick(SURNAMES);
    const decisionMaker = `${dmFirst} ${dmLast} · ${pick(DM_TITLE)}`;
    const company = `${pick(SURNAMES)} ${pick(SEG_WORDS)} ${pick(SUFFIX)}`;
    const slug = slugify(company);
    const email = `${dmFirst.toLowerCase()}.${dmLast.toLowerCase()}@${slug}.${isOn ? "ca" : "com"}`;

    const openRoles = randInt(0, 16);
    const recruitmentSignal: RecSignal = openRoles >= 8 ? "red" : openRoles >= 4 ? "yellow" : "green";
    const automationLevel: Automation = chance(0.55) ? "low" : chance(0.6) ? "med" : "high";

    const base = productInterest === "AK201000" ? 220000 : productInterest === "AK0200" ? 140000 : productInterest === "整线" ? 480000 : 90000;
    const estDealCad = Math.round((base + employees * 120) / 10000) * 10000;

    const chPool = isOn ? onChannels : usChannels;
    const siPool = isOn ? onSi : usSi;
    const channel = chPool[i % chPool.length];
    const si = siPool[i % siPool.length];

    const statusPool: CustStatus[] = ["prospect", "prospect", "prospect", "contacted", "contacted", "replied", "visit", "won"];
    const status = pick(statusPool);
    const daysAgo = randInt(0, 120);
    const lastActivity = new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);

    customers.push({
      id: `C-${String(i + 1).padStart(3, "0")}`,
      company,
      city,
      province,
      region,
      tier,
      segment,
      employees,
      revenueCad,
      productInterest,
      painPoint,
      decisionMaker,
      email,
      recruitmentSignal,
      openPackagingRoles: openRoles,
      automationLevel,
      estDealCad,
      channelId: channel.id,
      siId: si.id,
      status,
      lastActivity,
    });
  }

  return { customers, channels, sis, discovered: [], signals: [] };
}
