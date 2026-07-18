// 奥楷机械 AI 销售自动化系统 — 核心类型定义

export type Stage =
  | "scraped" // 挖掘（全网爬取）
  | "locked" // 锁定（安省/美中）
  | "outreach" // 触达（冷邮件已发）
  | "replied" // 回复（积极回复）
  | "visit" // 拜访（1.5h 地面拜访）
  | "won" // 签单
  | "lost"; // 流失

export const STAGE_LABELS: Record<Stage, string> = {
  scraped: "挖掘",
  locked: "锁定",
  outreach: "触达",
  replied: "回复",
  visit: "拜访",
  won: "签单",
  lost: "流失",
};

// 流水线顺序（用于漏斗与推进）
export const STAGE_ORDER: Stage[] = [
  "scraped",
  "locked",
  "outreach",
  "replied",
  "visit",
  "won",
];

export type Priority = "A" | "B" | "C";

export const PRIORITY_LABELS: Record<Priority, string> = {
  A: "A 级 · 极度缺工",
  B: "B 级 · 高潜",
  C: "C 级 · 观察",
};

export type Tier = "Tier2" | "Tier3";

export type ProductInterest = "AK201000" | "AK0200" | "AK-Line" | "unknown";

export const PRODUCT_LABELS: Record<ProductInterest, string> = {
  "AK201000": "AK201000 后道装袋自动化线",
  AK0200: "AK0200 智能包装工作站",
  "AK-Line": "AK 整线集成方案",
  unknown: "待定",
};

export type SignalSeverity = "red" | "yellow" | "green";

export interface PlantManager {
  name?: string;
  title?: string;
  email?: string;
}

export interface Lead {
  id: string;
  company: string;
  city: string;
  region: string; // 安省 / 美中
  tier: Tier;
  employees: number;
  lat?: number; // 用于 1.5h 车程派发
  lon?: number;
  plantManager: PlantManager;
  productInterest: ProductInterest;
  stage: Stage;
  priority: Priority;
  source: string; // 招聘监控 / 全网爬取 / 展会
  wagePerHour?: number; // 基础时薪（来自招聘监控）
  notes?: string;
  createdAt: string;
  updatedAt: string;
  recruitmentSignalId?: string;
  emailId?: string;
  visitId?: string;
  channelPartnerId?: string; // 七三开派发的渠道商
  lastEmailSentAt?: string;
  positiveReplyAt?: string;
}

export interface RecruitmentRole {
  role: string;
  count: number;
  wagePerHour?: number;
}

export interface RecruitmentSignal {
  id: string;
  leadId?: string;
  company: string;
  city: string;
  roles: RecruitmentRole[];
  severity: SignalSeverity; // red=极度缺工 红灯
  priority: Priority; // 触发的优先级
  detectedAt: string;
  note: string;
}

export interface RoiReport {
  product: string;
  laborSavedHeadcount: number;
  annualLaborSaving: number;
  capex: number;
  paybackMonths: number;
  compliance: string[];
}

export interface ColdEmail {
  id: string;
  leadId: string;
  subject: string;
  body: string;
  roi: RoiReport;
  generatedBy: "llm" | "template";
  createdAt: string;
  status: "draft" | "sent";
  sentAt?: string;
}

export interface VisitAgendaItem {
  time: string;
  title: string;
  detail: string;
}

export interface Visit {
  id: string;
  leadId: string;
  channelPartnerId?: string;
  scheduledAt?: string;
  status: "planned" | "done" | "cancelled";
  driveMinutes: number; // 车程（应在 1.5h=90min 内）
  agenda: VisitAgendaItem[]; // 1.5 小时标准拜访流程
  outcome?: string;
  createdAt: string;
}

export type PartnerType = "代理" | "SI" | "MES";

export interface ChannelPartner {
  id: string;
  name: string;
  type: PartnerType;
  city: string;
  lat: number;
  lon: number;
  commissionSplit: string; // 七三开说明
  phone?: string;
  email?: string;
}

export type ActivityType =
  | "scan"
  | "email"
  | "dispatch"
  | "visit"
  | "stage"
  | "system";

export interface Activity {
  id: string;
  at: string;
  type: ActivityType;
  message: string;
}

export interface DB {
  leads: Lead[];
  signals: RecruitmentSignal[];
  emails: ColdEmail[];
  visits: Visit[];
  partners: ChannelPartner[];
  activities: Activity[];
}
