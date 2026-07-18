import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/store";
import type { EntityType, SignalSentiment, SignalType } from "@/lib/db/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const entityType = searchParams.get("entityType") as EntityType | null;
  const entityId = searchParams.get("entityId");
  const type = searchParams.get("type") as SignalType | null;
  const sentiment = searchParams.get("sentiment") as SignalSentiment | null;
  const q = (searchParams.get("q") ?? "").toLowerCase();

  let rows = getDb().signals;
  if (entityType) rows = rows.filter((s) => s.entityType === entityType);
  if (entityId) rows = rows.filter((s) => s.entityId === entityId);
  if (type) rows = rows.filter((s) => s.type === type);
  if (sentiment) rows = rows.filter((s) => s.sentiment === sentiment);
  if (q) rows = rows.filter((s) => s.entityName.toLowerCase().includes(q) || s.title.toLowerCase().includes(q));

  return NextResponse.json({ signals: rows, total: rows.length });
}
