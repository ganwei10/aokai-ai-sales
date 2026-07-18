import type { DB, Lead, Visit } from "./types";
import { uid, logActivity } from "./store";
import { assignNearestPartner, buildVisitAgenda, MAX_VISIT_MIN } from "./geo";

/** 七三开派发 + 创建 1.5h 地面拜访 */
export function createVisitForLead(db: DB, leadId: string): { visit: Visit; dispatch: ReturnType<typeof assignNearestPartner> } | { error: string } {
  const lead = db.leads.find((l) => l.id === leadId);
  if (!lead) return { error: "lead not found" };

  const dispatch = assignNearestPartner(lead, db.partners);
  if (!dispatch) return { error: "no channel partner available" };

  const now = new Date().toISOString();
  const visit: Visit = {
    id: uid("V"),
    leadId: lead.id,
    channelPartnerId: dispatch.partner.id,
    status: "planned",
    driveMinutes: dispatch.driveMinutes,
    agenda: buildVisitAgenda(),
    createdAt: now,
  };
  db.visits.unshift(visit);
  lead.visitId = visit.id;
  lead.channelPartnerId = dispatch.partner.id;
  if (lead.stage === "replied") lead.stage = "visit";
  lead.updatedAt = now;

  const within = dispatch.withinRadius
    ? `在 1.5h 黄金半径内（${dispatch.driveMinutes}min）`
    : `超出 1.5h 半径（${dispatch.driveMinutes}min），建议远程先诊断`;
  logActivity(
    db,
    "dispatch",
    `派发 ${dispatch.partner.name}（${dispatch.partner.type}·${dispatch.partner.city}）对 ${lead.company} 执行地面拜访 —— ${within}。`
  );
  return { visit, dispatch };
}

export const VISIT_RADIUS_MIN = MAX_VISIT_MIN;
