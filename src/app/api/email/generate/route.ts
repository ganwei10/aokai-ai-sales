import { NextResponse } from "next/server";
import { getDB, saveDB, logActivity } from "@/lib/store";
import { generateColdEmail } from "@/lib/llm";

export async function POST(req: Request) {
  const db = await getDB();
  const { leadId } = await req.json().catch(() => ({}));
  const lead = db.leads.find((l) => l.id === leadId);
  if (!lead) return NextResponse.json({ error: "lead not found" }, { status: 404 });

  const signal = db.signals.find((s) => s.id === lead.recruitmentSignalId);
  const email = await generateColdEmail(lead, signal);
  db.emails.unshift(email);
  lead.emailId = email.id;
  lead.updatedAt = new Date().toISOString();
  logActivity(
    db,
    "email",
    `为 ${lead.company} 生成${email.generatedBy === "llm" ? "大模型" : "模板"}冷邮件：《${email.subject}》。`
  );
  await saveDB(db);
  return NextResponse.json({ email });
}
