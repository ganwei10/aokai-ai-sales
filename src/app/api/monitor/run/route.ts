import { NextResponse } from "next/server";
import { runBoth } from "@/lib/db/monitor";

export const dynamic = "force-dynamic";

// 双向监控：先入站招聘发现，再出站全网动态
export async function POST() {
  const res = await runBoth();
  return NextResponse.json(res);
}
