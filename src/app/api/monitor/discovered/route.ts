import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  let rows = getDb().discovered;
  if (status) rows = rows.filter((d) => d.status === status);
  return NextResponse.json({ discovered: rows, total: rows.length });
}
