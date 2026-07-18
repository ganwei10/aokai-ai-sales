import { NextResponse } from "next/server";
import { getDB, saveDB, logActivity } from "@/lib/store";
import { runRecruitmentScan } from "@/lib/jobs";
import { generateColdEmail } from "@/lib/llm";
import { createVisitForLead } from "@/lib/ops";

/**
 * 一键运行 AI 获客流水线（自动实现）：
 *  1) 招聘监控扫描 → 红灯线索优先级升 A
 *  2) 对 A/B 级且处于挖掘/锁定的线索：生成千人千面冷邮件并模拟投递
 *  3) 对已积极回复但无拜访的线索：执行七三开派发 + 1.5h 拜访
 */
export async function POST() {
  const db = await getDB();
  const now = new Date().toISOString();

  const scan = await runRecruitmentScan(db);

  let emailsGenerated = 0;
  let emailsSent = 0;
  let advanced = 0;

  for (const lead of db.leads) {
    if (lead.priority !== "A" && lead.priority !== "B") continue;
    if (lead.stage !== "scraped" && lead.stage !== "locked") continue;
    const signal = db.signals.find((s) => s.id === lead.recruitmentSignalId);
    const email = await generateColdEmail(lead, signal);
    db.emails.unshift(email);
    lead.emailId = email.id;
    email.status = "sent";
    email.sentAt = now;
    if (lead.stage === "scraped" || lead.stage === "locked") {
      lead.stage = "outreach";
      advanced++;
    }
    lead.lastEmailSentAt = now;
    lead.updatedAt = now;
    emailsGenerated++;
    emailsSent++;
    logActivity(
      db,
      "email",
      `流水线自动投递：${lead.company}（${email.generatedBy === "llm" ? "大模型" : "模板"}冷邮件）。`
    );
  }

  let dispatched = 0;
  for (const lead of db.leads) {
    if (lead.stage === "replied" && !lead.visitId) {
      const res = createVisitForLead(db, lead.id);
      if (!("error" in res)) dispatched++;
    }
  }

  logActivity(
    db,
    "system",
    `流水线一键运行完成：扫描 ${scan.scanned} 家 / 生成并投递 ${emailsSent} 封 / 推进 ${advanced} 家 / 派发拜访 ${dispatched} 家。`
  );
  await saveDB(db);

  return NextResponse.json({
    ok: true,
    scan,
    emailsGenerated,
    emailsSent,
    advanced,
    dispatched,
  });
}
