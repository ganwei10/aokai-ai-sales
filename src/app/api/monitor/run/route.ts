import { NextResponse } from "next/server";
import { runBoth, runOutboundScan } from "@/lib/db/monitor";

export const dynamic = "force-dynamic";

// 双向监控：先入站招聘发现，再出站全网动态
// POST：完整双向运行；GET：供 Vercel Cron 调用（每日定时真实扫描）
export async function POST(req: Request) {
  const limit = Number(new URL(req.url).searchParams.get("limit") || 60);
  const res = await runBoth(limit);
  return NextResponse.json(res);
}

export async function GET(req: Request) {
  const limit = Number(new URL(req.url).searchParams.get("limit") || 40);
  // Cron 场景：仅跑出站真实扫描（入站招聘依赖 Adzuna key，无 key 时自动合成）
  const outbound = await runOutboundScan(undefined, undefined, limit);
  return NextResponse.json({ inbound: null, outbound: outbound.run, signals: outbound.signals });
}
