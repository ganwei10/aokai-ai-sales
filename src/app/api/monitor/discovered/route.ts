import { NextResponse } from "next/server";
import { getDb, addDiscovered } from "@/lib/db/store";
import type { DiscoveredCompany, Region } from "@/lib/db/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  let rows = getDb().discovered;
  if (status) rows = rows.filter((d) => d.status === status);
  return NextResponse.json({ discovered: rows, total: rows.length });
}

// 手动添加一个真实监测对象（真实公司名），入池后由出站扫描拉取真实信号
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const company = (body.company || "").toString().trim();
  if (!company) return NextResponse.json({ error: "company is required" }, { status: 400 });
  const db = getDb();
  const region: Region | null =
    (body.region as Region) ||
    (/ontario|canada/i.test(company + (body.province || "")) ? "安省" : /midwest|us|il|wi|mi|oh|in|ia|mn|ne|sd/i.test(body.province || "") ? "美中" : null);
  const d: DiscoveredCompany = {
    id: "D-" + (db.discovered.length + 1).toString().padStart(3, "0") + "w" + Math.random().toString(36).slice(2, 5),
    company,
    city: body.city || null,
    province: body.province || null,
    region,
    source: "manual",
    discoveredAt: new Date().toISOString().slice(0, 10),
    query: null,
    snippet: body.notes || null,
    employees: body.employees ?? null,
    segment: body.segment || null,
    status: "watch",
  };
  addDiscovered(d);
  return NextResponse.json({ discovered: d });
}
