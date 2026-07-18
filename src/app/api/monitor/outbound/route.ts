import { NextResponse } from "next/server";
import { runOutboundScan } from "@/lib/db/monitor";
import type { EntityType } from "@/lib/db/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const entityType = (searchParams.get("entityType") as EntityType) || undefined;
  const entityId = searchParams.get("id") || undefined;
  const limit = Number(searchParams.get("limit") || 200);
  const res = await runOutboundScan(entityType, entityId, limit);
  return NextResponse.json(res);
}
