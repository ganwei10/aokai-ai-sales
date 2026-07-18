import { NextResponse } from "next/server";
import { runInboundScan } from "@/lib/db/monitor";

export const dynamic = "force-dynamic";

export async function POST() {
  const res = await runInboundScan();
  return NextResponse.json(res);
}
