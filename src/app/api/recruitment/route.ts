import { NextResponse } from "next/server";
import { getDB } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = await getDB();
  const signals = db.signals.map((s) => {
    const lead = db.leads.find((l) => l.id === s.leadId);
    return { ...s, leadPriority: lead?.priority, leadStage: lead?.stage, leadId: s.leadId };
  });
  return NextResponse.json({ signals });
}
