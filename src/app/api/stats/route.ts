import { NextResponse } from "next/server";
import { getDB, logActivity, persistenceMode } from "@/lib/store";
import { STAGE_ORDER, type Stage } from "@/lib/types";
import { buildRoi } from "@/lib/roi";

// 读取实时可变状态，禁用静态缓存
export const dynamic = "force-dynamic";

export async function GET() {
  const db = await getDB();

  const byStage: Record<string, number> = {};
  for (const s of STAGE_ORDER) byStage[s] = 0;
  byStage["lost"] = 0;
  for (const l of db.leads) byStage[l.stage] = (byStage[l.stage] ?? 0) + 1;

  const byPriority: Record<string, number> = { A: 0, B: 0, C: 0 };
  for (const l of db.leads) byPriority[l.priority] = (byPriority[l.priority] ?? 0) + 1;

  const emailsSent = db.emails.filter((e) => e.status === "sent").length;
  const visitsPlanned = db.visits.filter((v) => v.status !== "cancelled").length;
  const wonLeads = db.leads.filter((l) => l.stage === "won");
  const wonValue = wonLeads.reduce((s, l) => s + buildRoi(l.productInterest).capex, 0);

  const redSignals = db.signals.filter((s) => s.severity === "red").length;

  return NextResponse.json({
    mode: persistenceMode(),
    totals: {
      leads: db.leads.length,
      aPriority: byPriority.A,
      emailsSent,
      visitsPlanned,
      redSignals,
      wonValue,
      wonCount: wonLeads.length,
    },
    funnel: STAGE_ORDER.map((s) => ({ stage: s as Stage, count: byStage[s] })),
    byPriority,
    recent: db.activities.slice(0, 10),
  });
}
