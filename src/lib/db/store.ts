// Phase 2 数据存储（重构版，模块级缓存 + 可选 KV）
import { generateDatabase, type DbBundle } from "./generate";
import type {
  ChannelPartner,
  Customer,
  DbStats,
  DiscoveredCompany,
  DiscoveredStatus,
  MonitorRun,
  Signal,
  SystemIntegrator,
} from "./types";

interface Db extends DbBundle {
  runs: MonitorRun[];
}

let cache: Db | null = null;

export function getDb(): Db {
  if (!cache) {
    const b = generateDatabase();
    cache = { ...b, runs: [] };
  }
  return cache;
}

// ---------- 实体读取 ----------
export function getCustomer(id: string): Customer | undefined {
  return getDb().customers.find((x) => x.id === id);
}
export function getChannel(id: string): ChannelPartner | undefined {
  return getDb().channels.find((x) => x.id === id);
}
export function getSi(id: string): SystemIntegrator | undefined {
  return getDb().sis.find((x) => x.id === id);
}
export function getDiscovered(id: string): DiscoveredCompany | undefined {
  return getDb().discovered.find((x) => x.id === id);
}
export function getEntity(type: Signal["entityType"], id: string) {
  if (type === "customer") return getCustomer(id);
  if (type === "channel") return getChannel(id);
  if (type === "si") return getSi(id);
  return getDiscovered(id);
}

// ---------- 状态更新 ----------
export function setCustomerStatus(id: string, status: Customer["status"]): Customer | null {
  const c = getCustomer(id);
  if (c) {
    c.status = status;
    c.lastActivity = new Date().toISOString().slice(0, 10);
  }
  return c ?? null;
}

export function setDiscoveredStatus(id: string, status: DiscoveredStatus, note?: string): DiscoveredCompany | null {
  const d = getDiscovered(id);
  if (d) {
    d.status = status;
    if (note) d.note = note;
  }
  return d ?? null;
}

// ---------- 信号 / 运行写入 ----------
function bumpSignalCount(type: Signal["entityType"], id: string) {
  const e = getEntity(type, id);
  if (e && "signalCount" in e) (e as { signalCount?: number }).signalCount = ((e as { signalCount?: number }).signalCount ?? 0) + 1;
}

export function addSignal(s: Signal): Signal {
  getDb().signals.unshift(s);
  bumpSignalCount(s.entityType, s.entityId);
  return s;
}

export function addDiscovered(d: DiscoveredCompany): DiscoveredCompany {
  getDb().discovered.unshift(d);
  return d;
}

export function addRun(r: MonitorRun): MonitorRun {
  getDb().runs.unshift(r);
  return r;
}

// ---------- 统计 ----------
export function getStats(): DbStats {
  const db = getDb();
  const c = db.customers;
  const ontario = c.filter((x) => x.region === "安省").length;
  const tier2 = c.filter((x) => x.tier === "Tier2").length;
  const tier3 = c.filter((x) => x.tier === "Tier3").length;
  const red = c.filter((x) => x.recruitmentSignal === "red").length;
  const yellow = c.filter((x) => x.recruitmentSignal === "yellow").length;
  const green = c.filter((x) => x.recruitmentSignal === "green").length;
  const totalPipeline = c.reduce((s, x) => s + x.estDealCad, 0);
  const won = c.filter((x) => x.status === "won").length;
  const seg: Record<string, number> = {};
  for (const x of c) seg[x.segment] = (seg[x.segment] || 0) + 1;
  const region: Record<string, number> = {};
  for (const x of [...c, ...db.channels, ...db.sis])
    region[x.region] = (region[x.region] || 0) + 1;
  const st: Record<string, number> = {};
  for (const s of db.signals) st[s.type] = (st[s.type] || 0) + 1;
  const inbound = db.runs.filter((r) => r.direction === "inbound" && r.status === "done");
  const outbound = db.runs.filter((r) => r.direction === "outbound" && r.status === "done");
  return {
    customers: c.length,
    channels: db.channels.length,
    sis: db.sis.length,
    discovered: db.discovered.length,
    signals: db.signals.length,
    ontarioCustomersPct: Math.round((ontario / c.length) * 100),
    sme: tier2 + tier3,
    redSignal: red,
    yellowSignal: yellow,
    greenSignal: green,
    totalPipelineCad: totalPipeline,
    wonCount: won,
    segmentBreakdown: seg,
    regionBreakdown: region,
    signalsByType: st,
    lastInboundAt: inbound[0]?.finishedAt,
    lastOutboundAt: outbound[0]?.finishedAt,
  };
}
