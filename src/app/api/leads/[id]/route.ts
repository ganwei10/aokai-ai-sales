import { NextResponse } from "next/server";
import { getDB, saveDB, logActivity } from "@/lib/store";
import { STAGE_LABELS, type Stage } from "@/lib/types";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const db = await getDB();
  const lead = db.leads.find((l) => l.id === params.id);
  if (!lead) return NextResponse.json({ error: "not found" }, { status: 404 });
  const signal = db.signals.find((s) => s.id === lead.recruitmentSignalId);
  const email = db.emails.find((e) => e.id === lead.emailId);
  const visit = db.visits.find((v) => v.id === lead.visitId);
  const partner = db.partners.find((p) => p.id === lead.channelPartnerId);
  return NextResponse.json({ lead, signal, email, visit, partner });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const db = await getDB();
  const lead = db.leads.find((l) => l.id === params.id);
  if (!lead) return NextResponse.json({ error: "not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));

  if (body.stage && body.stage !== lead.stage) {
    const from = STAGE_LABELS[lead.stage];
    const to = STAGE_LABELS[body.stage as Stage];
    lead.stage = body.stage as Stage;
    logActivity(db, "stage", `线索 ${lead.company} 阶段推进：${from} → ${to}`);
    if (body.stage === "replied" && !lead.positiveReplyAt) {
      lead.positiveReplyAt = new Date().toISOString();
    }
  }
  if (body.priority) lead.priority = body.priority;
  if (typeof body.notes === "string") lead.notes = body.notes;
  if (body.wagePerHour != null) lead.wagePerHour = body.wagePerHour;
  lead.updatedAt = new Date().toISOString();

  await saveDB(db);
  return NextResponse.json({ lead });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const db = await getDB();
  const idx = db.leads.findIndex((l) => l.id === params.id);
  if (idx < 0) return NextResponse.json({ error: "not found" }, { status: 404 });
  const [removed] = db.leads.splice(idx, 1);
  logActivity(db, "system", `删除线索：${removed.company}`);
  await saveDB(db);
  return NextResponse.json({ ok: true });
}
