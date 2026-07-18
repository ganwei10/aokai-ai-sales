import { NextResponse } from "next/server";
import { getDB, saveDB, logActivity } from "@/lib/store";

export async function POST(req: Request) {
  const db = await getDB();
  const { leadId, emailId } = await req.json().catch(() => ({}));
  const lead = db.leads.find((l) => l.id === leadId);
  if (!lead) return NextResponse.json({ error: "lead not found" }, { status: 404 });

  const id = emailId ?? lead.emailId;
  const email = db.emails.find((e) => e.id === id);
  if (!email) return NextResponse.json({ error: "email not found" }, { status: 404 });

  const now = new Date().toISOString();
  email.status = "sent";
  email.sentAt = now;

  if (lead.stage === "scraped" || lead.stage === "locked") {
    lead.stage = "outreach";
    logActivity(db, "stage", `线索 ${lead.company} 阶段推进：触达（冷邮件已投递）`);
  }
  lead.lastEmailSentAt = now;
  lead.updatedAt = now;
  logActivity(db, "email", `已向 ${lead.company} 投递冷邮件（附个性化 ROI 报告）。`);
  await saveDB(db);
  return NextResponse.json({ email, lead });
}
