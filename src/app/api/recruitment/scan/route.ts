import { NextResponse } from "next/server";
import { getDB, saveDB, logActivity } from "@/lib/store";
import { runRecruitmentScan } from "@/lib/jobs";

// 支持 GET（Vercel Cron 每日 06:07 调用）与 POST（手动触发）
async function run() {
  const db = await getDB();
  const result = await runRecruitmentScan(db);
  logActivity(
    db,
    "scan",
    `招聘监控扫描完成：覆盖 ${result.scanned} 家，红灯（极度缺工）${result.red} 家，提升优先级 ${result.updated.length} 家。`
  );
  await saveDB(db);
  return result;
}

export async function GET() {
  const result = await run();
  return NextResponse.json({ ok: true, ...result });
}

export async function POST() {
  const result = await run();
  return NextResponse.json({ ok: true, ...result });
}
