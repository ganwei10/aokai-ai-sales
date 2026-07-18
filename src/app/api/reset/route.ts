import { NextResponse } from "next/server";
import { seedDB } from "@/lib/seed";
import { saveDB, logActivity } from "@/lib/store";

export async function POST() {
  const fresh = JSON.parse(JSON.stringify(seedDB));
  logActivity(fresh, "system", "数据库已重置为初始种子（演示用）。");
  await saveDB(fresh);
  return NextResponse.json({ ok: true, leads: fresh.leads.length });
}
