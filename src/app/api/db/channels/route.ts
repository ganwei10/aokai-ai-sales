import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const region = searchParams.get("region");
  const type = searchParams.get("type");
  const q = (searchParams.get("q") ?? "").toLowerCase();
  let rows = getDb().channels;
  if (region) rows = rows.filter((r) => r.region === region);
  if (type) rows = rows.filter((r) => r.type === type);
  if (q) rows = rows.filter((r) => r.name.toLowerCase().includes(q) || r.city.toLowerCase().includes(q) || r.contact.toLowerCase().includes(q));
  return NextResponse.json({ channels: rows, total: rows.length, all: getDb().channels.length });
}
