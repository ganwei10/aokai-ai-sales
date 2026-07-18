// 第二阶段（重构版）：动态客户 / 渠道 / SI 数据库 + 双向监控信号
// 关键变更：客户、渠道商、SI（系统集成商）三类实体彻底分离；
// 统一的「动态信号 Signal」承载双向监控产出（招聘发现 + 全网动态）。

export type Region = "安省" | "美中";
export type Tier = "Tier2" | "Tier3";
export type Segment = "禽肉" | "猪牛肉" | "熟食/调理" | "海鲜" | "综合";
export type ProductInterest = "AK201000" | "AK0200" | "整线" | "其他";
export type RecSignal = "red" | "yellow" | "green";
export type Automation = "low" | "med" | "high";
export type CustStatus = "prospect" | "contacted" | "replied" | "visit" | "won";

// ---------- 终端客户（肉企，购买方）----------
// 20 字段：编号 / 企业 / 城市 / 省州 / 区域 / 层级 / 品类 / 人数 / 年营收 /
// 意向产品 / 痛点 / 决策人 / 邮箱 / 招聘信号 / 在招包装岗 / 自动化水平 /
// 预估单值 / 渠道商 / SI / 状态 / 最近活动
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
  recruitmentSignal: RecSignal;
  openPackagingRoles: number;
  automationLevel: Automation;
  estDealCad: number;
  channelId: string | null; // 负责开发的渠道商
  siId: string | null; // 协同的 SI
  status: CustStatus;
  lastActivity: string;
  monitoredAt?: string; // 上次全网扫描时间
  signalCount?: number; // 动态条数
}

// ---------- 渠道商（经销商 / 代理商，转售方）----------
export type ChannelType = "经销商" | "代理商";
export interface ChannelPartner {
  id: string;
  name: string;
  city: string;
  province: string;
  region: Region;
  type: ChannelType;
  coverageKm: number;
  tierFocus: "SME" | "大型" | "全";
  contact: string;
  email: string;
  commissionRate: number; // 0.3 = 七三开（AOKAI 70% / 渠道商 30%）
  activeAccounts: number;
  pipelineValueCad: number;
  status: "active" | "pending";
  monitoredAt?: string;
  signalCount?: number;
}

// ---------- SI 系统集成商（方案整合方）----------
export type SIType = "整线集成" | "后道集成" | "前道集成" | "视觉检测";
export interface SystemIntegrator {
  id: string;
  name: string;
  city: string;
  province: string;
  region: Region;
  type: SIType;
  coverageKm: number;
  tierFocus: "SME" | "大型" | "全";
  contact: string;
  email: string;
  commissionRate: number; // 七三开
  activeAccounts: number;
  pipelineValueCad: number;
  status: "active" | "pending";
  monitoredAt?: string;
  signalCount?: number;
}

// ---------- 待评估公司（招聘监控入站发现，尚未分类）----------
export type DiscoveredStatus = "new" | "qualifying" | "converted" | "rejected";
export interface DiscoveredCompany {
  id: string;
  company: string;
  city: string | null;
  province: string | null;
  region: Region | null;
  source: "recruitment"; // 发现来源
  discoveredAt: string;
  query: string; // 发现时的搜索词 / 职位
  snippet: string; // 摘要
  employees: number | null;
  segment: Segment | null;
  status: DiscoveredStatus;
  note?: string;
}

// ---------- 统一动态信号（双向监控的产出）----------
export type SignalType =
  | "招聘扩张"
  | "产能扩张"
  | "新产线/新品"
  | "融资/投资"
  | "并购"
  | "关厂/减产"
  | "管理层变动"
  | "认证/合规"
  | "奖项/新闻"
  | "负面事件"
  | "招聘缺工"; // 来自入站招聘发现

export type SignalSentiment = "positive" | "neutral" | "negative";
export type EntityType = "customer" | "channel" | "si" | "discovered";

export interface Signal {
  id: string;
  entityType: EntityType;
  entityId: string;
  entityName: string;
  type: SignalType;
  title: string;
  summary: string;
  url?: string;
  source: string; // 数据来源（招聘网站 / 新闻 / 工商 / 社媒…）
  date: string;
  sentiment: SignalSentiment;
  businessRelevance: string; // 对拓展业务的含义
  region?: Region;
}

// ---------- 监控运行记录 ----------
export type MonitorDirection = "inbound" | "outbound";
export interface MonitorRun {
  id: string;
  direction: MonitorDirection;
  source: string;
  startedAt: string;
  finishedAt?: string;
  status: "running" | "done" | "error";
  scanned: number;
  found: number;
  newSignals: number;
  newDiscovered: number;
  note?: string;
}

// ---------- 统计 ----------
export interface DbStats {
  customers: number;
  channels: number;
  sis: number;
  discovered: number;
  signals: number;
  ontarioCustomersPct: number;
  sme: number;
  redSignal: number;
  yellowSignal: number;
  greenSignal: number;
  totalPipelineCad: number;
  wonCount: number;
  segmentBreakdown: Record<string, number>;
  regionBreakdown: Record<string, number>;
  signalsByType: Record<string, number>;
  lastInboundAt?: string;
  lastOutboundAt?: string;
}

// 客户 20 字段表头（中文）
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
  ["channelId", "渠道商"],
  ["siId", "SI"],
  ["status", "状态"],
  ["lastActivity", "最近活动"],
];

export const CHANNEL_HEADERS: [keyof ChannelPartner, string][] = [
  ["id", "编号"],
  ["name", "名称"],
  ["city", "城市"],
  ["province", "省/州"],
  ["region", "区域"],
  ["type", "类型"],
  ["coverageKm", "服务半径(km)"],
  ["tierFocus", "聚焦"],
  ["contact", "联系人"],
  ["email", "邮箱"],
  ["commissionRate", "七三开"],
  ["activeAccounts", "活跃客户"],
  ["pipelineValueCad", "管道价值(CAD)"],
  ["status", "状态"],
];

export const SI_HEADERS: [keyof SystemIntegrator, string][] = [
  ["id", "编号"],
  ["name", "名称"],
  ["city", "城市"],
  ["province", "省/州"],
  ["region", "区域"],
  ["type", "类型"],
  ["coverageKm", "服务半径(km)"],
  ["tierFocus", "聚焦"],
  ["contact", "联系人"],
  ["email", "邮箱"],
  ["commissionRate", "七三开"],
  ["activeAccounts", "活跃客户"],
  ["pipelineValueCad", "管道价值(CAD)"],
  ["status", "状态"],
];

export const DISCOVERED_HEADERS: [keyof DiscoveredCompany, string][] = [
  ["id", "编号"],
  ["company", "企业"],
  ["city", "城市"],
  ["region", "区域"],
  ["source", "来源"],
  ["query", "发现关键词"],
  ["snippet", "摘要"],
  ["status", "状态"],
  ["discoveredAt", "发现时间"],
];
