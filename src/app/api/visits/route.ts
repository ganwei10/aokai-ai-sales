import { NextResponse } from "next/server";
import { getDB, saveDB } from "@/lib/store";
import { createVisitForLead } from "@/lib/ops";

export async function GET() {
  const db = await getDB();
  const visits = db.visits.map((v) => {
    const lead = db.leads.find((l) => l.id === v.leadId);
    const partner = db.partners.find((p) => p.id === v.channelPartnerId);
    return { ...v, lead, partner };
  });
  return NextResponse.json({ visits });
}

export async function POST(req: Request) {
  const db = await getDB();
  const { leadId } = await req.json().catch(() => ({}));
  const res = createVisitForLead(db, leadId);
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: 400 });
  await saveDB(db);
  return NextResponse.json(res, { status: 201 });
}
