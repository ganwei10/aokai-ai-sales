import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const region = searchParams.get("region");
  const type = searchParams.get("type");
  let rows = db.partners;
  if (region) rows = rows.filter((p) => p.region === region);
  if (type) rows = rows.filter((p) => p.type === type);

  return NextResponse.json({ partners: rows, total: rows.length, all: db.partners.length });
}
