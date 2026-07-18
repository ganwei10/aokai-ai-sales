import { NextResponse } from "next/server";
import { getDB, saveDB, logActivity, uid } from "@/lib/store";
import type { Lead, Priority, Stage, Tier, ProductInterest } from "@/lib/types";

export async function GET(req: Request) {
  const db = await getDB();
  const { searchParams } = new URL(req.url);
  const stage = searchParams.get("stage");
  const priority = searchParams.get("priority");
  const q = (searchParams.get("q") ?? "").toLowerCase();

  let leads = db.leads;
  if (stage) leads = leads.filter((l) => l.stage === stage);
  if (priority) leads = leads.filter((l) => l.priority === priority);
  if (q)
    leads = leads.filter(
      (l) =>
        l.company.toLowerCase().includes(q) ||
        l.city.toLowerCase().includes(q)
    );

  return NextResponse.json({ leads, total: leads.length });
}

export async function POST(req: Request) {
  const db = await getDB();
  const body = await req.json().catch(() => ({}));
  const now = new Date().toISOString();
  const lead: Lead = {
    id: uid("L"),
    company: body.company ?? "未命名客户",
    city: body.city ?? "",
    region: body.region ?? "安省",
    tier: (body.tier as Tier) ?? "Tier3",
    employees: Number(body.employees) || 0,
    lat: body.lat,
    lon: body.lon,
    plantManager: body.plantManager ?? {},
    productInterest: (body.productInterest as ProductInterest) ?? "unknown",
    stage: (body.stage as Stage) ?? "scraped",
    priority: (body.priority as Priority) ?? "C",
    source: body.source ?? "手动录入",
    wagePerHour: body.wagePerHour,
    notes: body.notes,
    createdAt: now,
    updatedAt: now,
  };
  db.leads.unshift(lead);
  logActivity(db, "system", `手动新增线索：${lead.company}（${lead.city}）`);
  await saveDB(db);
  return NextResponse.json({ lead }, { status: 201 });
}
