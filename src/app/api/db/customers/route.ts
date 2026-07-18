import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const region = searchParams.get("region");
  const tier = searchParams.get("tier");
  const segment = searchParams.get("segment");
  const signal = searchParams.get("signal");
  const status = searchParams.get("status");
  const q = (searchParams.get("q") ?? "").toLowerCase();

  let rows = db.customers;
  if (region) rows = rows.filter((r) => r.region === region);
  if (tier) rows = rows.filter((r) => r.tier === tier);
  if (segment) rows = rows.filter((r) => r.segment === segment);
  if (signal) rows = rows.filter((r) => r.recruitmentSignal === signal);
  if (status) rows = rows.filter((r) => r.status === status);
  if (q)
    rows = rows.filter(
      (r) =>
        r.company.toLowerCase().includes(q) ||
        r.city.toLowerCase().includes(q) ||
        r.decisionMaker.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q)
    );

  return NextResponse.json({ customers: rows, total: rows.length, all: db.customers.length });
}
