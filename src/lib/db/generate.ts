// 第二阶段数据库生成器（确定性，可复现）
// 目标：300 家客户（安省 60% = 180 / 美中 40% = 120）+ 100 家渠道商
// 中小型企业（Tier2/3）切入，含招聘缺工信号，便于与第四阶段自动化联动。

import type {
  Automation,
  Customer,
  CustStatus,
  Partner,
  PartnerSpecialty,
  PartnerType,
  ProductInterest,
  Region,
  Segment,
  Signal,
  Tier,
} from "./types";

// 确定性 PRNG（mulberry32），固定种子保证每次生成结果一致
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
const PARTNER_PRE = ["Maple", "Grand River", "Bluewater", "Ironhorse", "Polar", "Summit", "Keystone", "Lakeside", "Prairie", "Northern", "Great Lakes", "Frontier", "Cascade", "Evergreen", "StClair", "Thunder", "Georgian", "Niagara", "Huron", "Erie"];
const PARTNER_SUF = ["Automation", "Integration", "Systems", "Machinery", "Solutions", "Robotics", "Engineered"];

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 14);
}

export function generateDatabase(): { customers: Customer[]; partners: Partner[] } {
  const rng = mulberry32(20270718);
  const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
  const randInt = (a: number, b: number) => a + Math.floor(rng() * (b - a + 1));
  const chance = (p: number) => rng() < p;

  // ---- 渠道商（100 家：安省 60 / 美中 40）----
  const partners: Partner[] = [];
  const ON_PARTNERS = 60;
  for (let i = 0; i < ON_PARTNERS + 40; i++) {
    const isOn = i < ON_PARTNERS;
    const region: Region = isOn ? "安省" : "美中";
    const loc = isOn ? pick(ON_CITIES) : pick(US_CITIES);
    const city = isOn ? (loc as string) : (loc as { city: string }).city;
    const province = isOn ? "ON" : (loc as { prov: string }).prov;
    const type = pick<PartnerType>(["集成商", "经销商", "行业顾问"]);
    const specialty = pick<PartnerSpecialty>(["后道装袋", "前道分割", "整线集成", "合规咨询"]);
    const name = `${pick(PARTNER_PRE)} ${pick(PARTNER_SUF)}`;
    const contact = `${pick(FIRST)} ${pick(SURNAMES)}`;
    const slug = slugify(name);
    partners.push({
      id: `P-${String(i + 1).padStart(3, "0")}`,
      name,
      city,
      province,
      region,
      type,
      specialty,
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

  const onPartners = partners.filter((p) => p.region === "安省");
  const usPartners = partners.filter((p) => p.region === "美中");

  // ---- 客户（300 家：安省 180 / 美中 120）----
  const customers: Customer[] = [];
  for (let i = 0; i < 300; i++) {
    const isOn = i < 180;
    const region: Region = isOn ? "安省" : "美中";
    const loc = isOn ? ON_CITIES[i % ON_CITIES.length] : US_CITIES[(i - 180) % US_CITIES.length];
    const city = isOn ? (loc as string) : (loc as { city: string }).city;
    const province = isOn ? "ON" : (loc as { prov: string }).prov;

    const tier: Tier = chance(0.3) ? "Tier2" : "Tier3";
    const segment = pick<Segment>(["禽肉", "猪牛肉", "熟食/调理", "海鲜", "综合"]);
    const employees = randInt(45, 520);
    const revenueCad = Math.round((employees * randInt(110, 260)) / 1000) * 1000;

    const productInterest = pick<ProductInterest>(["AK201000", "AK201000", "AK0200", "AK0200", "整线", "其他"]);
    const painPoint = pick(PAIN);

    const dmFirst = pick(FIRST);
    const dmLast = pick(SURNAMES);
    const decisionMaker = `${dmFirst} ${dmLast} · ${pick(DM_TITLE)}`;
    const company = `${pick(SURNAMES)} ${pick(SEG_WORDS)} ${pick(SUFFIX)}`;
    const slug = slugify(company);
    const email = `${dmFirst.toLowerCase()}.${dmLast.toLowerCase()}@${slug}.${isOn ? "ca" : "com"}`;

    const openRoles = randInt(0, 16);
    const recruitmentSignal: Signal = openRoles >= 8 ? "red" : openRoles >= 4 ? "yellow" : "green";
    const automationLevel: Automation = chance(0.55) ? "low" : chance(0.6) ? "med" : "high";

    const base = productInterest === "AK201000" ? 220000 : productInterest === "AK0200" ? 140000 : productInterest === "整线" ? 480000 : 90000;
    const estDealCad = Math.round((base + employees * 120) / 10000) * 10000;

    const pool = isOn ? onPartners : usPartners;
    const partner = pool[i % pool.length];

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
      partnerId: partner.id,
      status,
      lastActivity,
    });
  }

  return { customers, partners };
}
