import type { ChannelPartner, Lead, VisitAgendaItem } from "./types";

const EARTH_R = 6371; // km
const DRIVE_SPEED_KMH = 60; // 平均车速
export const MAX_VISIT_MIN = 90; // 1.5 小时黄金销售半径

function toRad(d: number): number {
  return (d * Math.PI) / 180;
}

export function haversineKm(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number
): number {
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.sqrt(h));
}

export function driveMinutes(km: number): number {
  return Math.round((km / DRIVE_SPEED_KMH) * 60);
}

/** 1.5 小时标准地面拜访流程 */
export function buildVisitAgenda(): VisitAgendaItem[] {
  return [
    { time: "00:00", title: "寒暄与现场痛点确认", detail: "确认后道装袋瓶颈与排班痛点" },
    { time: "00:10", title: "样机视频演示 AK 方案", detail: "播放 AK201000/AK0200 实际产线视频" },
    { time: "00:25", title: "后道装袋工序精益诊断", detail: "测算在制品堆积与人工节拍" },
    { time: "00:40", title: "ROI 测算现场对齐", detail: "按贵厂时薪现场生成回收测算" },
    { time: "00:55", title: "合规与 CFIA/FSMA 说明", detail: "3-A/NSF、UL/CSA、21 CFR Part 11" },
    { time: "01:05", title: "七三开渠道合作与返佣", detail: "渠道商拿综合毛利大头，本地信任背书" },
    { time: "01:15", title: "样机试产 / 试点排期", detail: "约定 2 周试点窗口" },
    { time: "01:25", title: "报价与签单路径", detail: "给出阶梯报价与交付节奏" },
    { time: "01:30", title: "闭环：确定下一步", detail: "锁定签约负责人与时间表" },
  ];
}

export interface DispatchResult {
  partner: ChannelPartner;
  distanceKm: number;
  driveMinutes: number;
  withinRadius: boolean;
}

/** 七三开派发：在 1.5h 车程内选择最近的渠道商 */
export function assignNearestPartner(
  lead: Lead,
  partners: ChannelPartner[]
): DispatchResult | null {
  if (lead.lat == null || lead.lon == null || partners.length === 0) return null;

  let best: ChannelPartner | null = null;
  let bestKm = Infinity;
  for (const p of partners) {
    const km = haversineKm(lead.lat!, lead.lon!, p.lat, p.lon);
    if (km < bestKm) {
      bestKm = km;
      best = p;
    }
  }
  if (!best) return null;
  const minutes = driveMinutes(bestKm);
  return {
    partner: best,
    distanceKm: Math.round(bestKm * 10) / 10,
    driveMinutes: minutes,
    withinRadius: minutes <= MAX_VISIT_MIN,
  };
}
