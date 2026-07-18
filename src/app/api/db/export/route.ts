import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getDb } from "@/lib/db/store";
import { CUSTOMER_HEADERS, type Customer } from "@/lib/db/types";

export const dynamic = "force-dynamic";

function toRecord(r: Customer): Record<string, unknown> {
  return r as unknown as Record<string, unknown>;
}

function toCsv(rows: Customer[]): string {
  const head = CUSTOMER_HEADERS.map((h) => h[1]).join(",");
  const lines = rows.map((r) =>
    CUSTOMER_HEADERS.map(([k]) => {
      const s = String(toRecord(r)[k] ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(",")
  );
  // BOM 保证 Excel 正确识别 UTF-8 中文
  return "﻿" + [head, ...lines].join("\n");
}

export async function GET(req: Request) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const fmt = searchParams.get("format") ?? "csv";
  const rows = db.customers;

  if (fmt === "xlsx") {
    const data = rows.map((r) => Object.fromEntries(CUSTOMER_HEADERS.map(([k, label]) => [label, toRecord(r)[k]])));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "客户数据库300");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="aokai_phase2_customers_300.xlsx"',
      },
    });
  }

  const csv = toCsv(rows);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="aokai_phase2_customers_300.csv"',
    },
  });
}
