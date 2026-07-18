import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/store";
import type { DbStats } from "@/lib/db/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const c = db.customers;
  const ontario = c.filter((x) => x.region === "安省").length;
  const us = c.length - ontario;
  const tier2 = c.filter((x) => x.tier === "Tier2").length;
  const tier3 = c.filter((x) => x.tier === "Tier3").length;
  const red = c.filter((x) => x.recruitmentSignal === "red").length;
  const yellow = c.filter((x) => x.recruitmentSignal === "yellow").length;
  const green = c.filter((x) => x.recruitmentSignal === "green").length;
  const totalPipeline = c.reduce((s, x) => s + x.estDealCad, 0);
  const won = c.filter((x) => x.status === "won").length;
  const seg: Record<string, number> = {};
  for (const x of c) seg[x.segment] = (seg[x.segment] || 0) + 1;
  const partnersOntario = db.partners.filter((p) => p.region === "安省").length;

  const stats: DbStats = {
    total: c.length,
    ontario,
    ontarioPct: Math.round((ontario / c.length) * 100),
    usMidwest: us,
    tier2,
    tier3,
    redSignal: red,
    yellowSignal: yellow,
    greenSignal: green,
    totalPipelineCad: totalPipeline,
    wonCount: won,
    segmentBreakdown: seg,
    partners: db.partners.length,
    partnersOntario,
  };
  return NextResponse.json(stats);
}
