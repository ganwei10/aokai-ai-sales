// 第二阶段：动态客户与渠道数据库 —— 数据模型
// 客户记录固定 20 项字段；渠道商为配套字段。

export type Region = "安省" | "美中";
export type Tier = "Tier2" | "Tier3";
export type Segment = "禽肉" | "猪牛肉" | "熟食/调理" | "海鲜" | "综合";
export type ProductInterest = "AK201000" | "AK0200" | "整线" | "其他";
export type Signal = "red" | "yellow" | "green";
export type Automation = "low" | "med" | "high";
export type CustStatus = "prospect" | "contacted" | "replied" | "visit" | "won";

// 客户 20 字段（编号 / 企业 / 城市 / 省州 / 区域 / 层级 / 品类 / 人数 / 年营收 /
// 意向产品 / 痛点 / 决策人 / 邮箱 / 招聘信号 / 在招包装岗 / 自动化水平 /
// 预估单值 / 渠道商 / 状态 / 最近活动）
export interface Customer {
  id: string;
  company: string;
  city: string;
  province: string;
  region: Region;
  tier: Tier;
  segment: Segment;
  employees: number;
  revenueCad: number;
  productInterest: ProductInterest;
  painPoint: string;
  decisionMaker: string;
  email: string;
  recruitmentSignal: Signal;
  openPackagingRoles: number;
  automationLevel: Automation;
  estDealCad: number;
  partnerId: string | null;
  status: CustStatus;
  lastActivity: string;
}

export type PartnerType = "集成商" | "经销商" | "行业顾问";
export type PartnerSpecialty = "后道装袋" | "前道分割" | "整线集成" | "合规咨询";
export type PartnerStatus = "active" | "pending";

export interface Partner {
  id: string;
  name: string;
  city: string;
  province: string;
  region: Region;
  type: PartnerType;
  specialty: PartnerSpecialty;
  coverageKm: number;
  tierFocus: "SME" | "大型" | "全";
  contact: string;
  email: string;
  commissionRate: number; // 0.3 = 七三开（AOKAI 70% / 渠道商 30%）
  activeAccounts: number;
  pipelineValueCad: number;
  status: PartnerStatus;
}

export interface DbStats {
  total: number;
  ontario: number;
  ontarioPct: number;
  usMidwest: number;
  tier2: number;
  tier3: number;
  redSignal: number;
  yellowSignal: number;
  greenSignal: number;
  totalPipelineCad: number;
  wonCount: number;
  segmentBreakdown: Record<string, number>;
  partners: number;
  partnersOntario: number;
}

// CSV / Excel 表头（中文字段名，顺序对应 20 字段）
export const CUSTOMER_HEADERS: [keyof Customer, string][] = [
  ["id", "编号"],
  ["company", "企业"],
  ["city", "城市"],
  ["province", "省/州"],
  ["region", "区域"],
  ["tier", "层级"],
  ["segment", "品类"],
  ["employees", "人数"],
  ["revenueCad", "年营收(CAD)"],
  ["productInterest", "意向产品"],
  ["painPoint", "痛点"],
  ["decisionMaker", "决策人"],
  ["email", "邮箱"],
  ["recruitmentSignal", "招聘信号"],
  ["openPackagingRoles", "在招包装岗"],
  ["automationLevel", "自动化水平"],
  ["estDealCad", "预估单值(CAD)"],
  ["partnerId", "渠道商"],
  ["status", "状态"],
  ["lastActivity", "最近活动"],
];
