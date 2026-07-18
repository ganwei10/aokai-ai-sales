import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getDb } from "@/lib/db/store";
import {
  CHANNEL_HEADERS,
  CUSTOMER_HEADERS,
  DISCOVERED_HEADERS,
  SI_HEADERS,
  type ChannelPartner,
  type Customer,
  type DiscoveredCompany,
  type SystemIntegrator,
} from "@/lib/db/types";

export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;
const HEADER_SETS: Record<string, { headers: [string, string][]; name: string; file: string }> = {
  customers: { headers: CUSTOMER_HEADERS as [string, string][], name: "客户300", file: "aokai_customers_300" },
  channels: { headers: CHANNEL_HEADERS as [string, string][], name: "渠道商", file: "aokai_channels" },
  sis: { headers: SI_HEADERS as [string, string][], name: "SI", file: "aokai_si" },
  discovered: { headers: DISCOVERED_HEADERS as [string, string][], name: "待评估", file: "aokai_discovered" },
};

function toCsv(rows: Row[], headers: [string, string][]): string {
  const head = headers.map((h) => h[1]).join(",");
  const lines = rows.map((r) =>
    headers.map(([k]) => {
      const s = String(r[k] ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(",")
  );
  return "﻿" + [head, ...lines].join("\n");
}

export async function GET(req: Request) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const fmt = searchParams.get("format") ?? "csv";
  const entity = searchParams.get("entity") ?? "customers";
  const set = HEADER_SETS[entity] || HEADER_SETS.customers;

  const src = (
    entity === "channels" ? db.channels
    : entity === "sis" ? db.sis
    : entity === "discovered" ? db.discovered
    : db.customers
  ) as unknown as Row[];

  if (fmt === "xlsx") {
    const data = src.map((r) => Object.fromEntries(set.headers.map(([k, label]) => [label, r[k]])));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, set.name);
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${set.file}.xlsx"`,
      },
    });
  }

  const csv = toCsv(src, set.headers as [string, string][]);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${set.file}.csv"`,
    },
  });
}
