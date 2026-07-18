import type { ProductInterest, RoiReport } from "./types";

// 北美基础工人综合年薪（单班，含负担）— 来自战略报告
export const ANNUAL_LABOR_COST = 61600; // USD/人/年

interface ProductSpec {
  label: string;
  laborSaved: number; // 替代人数
  paybackMonths: number; // 回收期
}

const PRODUCT_SPECS: Record<Exclude<ProductInterest, "unknown">, ProductSpec> = {
  AK201000: { label: "AK201000 后道装袋自动化线", laborSaved: 10, paybackMonths: 4.8 },
  AK0200: { label: "AK0200 智能包装工作站", laborSaved: 3, paybackMonths: 9.7 },
  "AK-Line": { label: "AK 整线集成方案", laborSaved: 12, paybackMonths: 6.0 },
};

const COMPLIANCE = ["UL/CSA 电气安全", "3-A / NSF 食品接触卫生", "FSMA (21 CFR Part 11) 数据追溯"];

export function resolveProduct(p: ProductInterest): Exclude<ProductInterest, "unknown"> {
  if (p === "unknown") return "AK201000";
  return p;
}

/** 基于战略报告参数动态测算 ROI */
export function buildRoi(product: ProductInterest): RoiReport {
  const spec = PRODUCT_SPECS[resolveProduct(product)];
  const annualLaborSaving = Math.round(spec.laborSaved * ANNUAL_LABOR_COST);
  const capex = Math.round((annualLaborSaving * spec.paybackMonths) / 12);
  return {
    product: spec.label,
    laborSavedHeadcount: spec.laborSaved,
    annualLaborSaving,
    capex,
    paybackMonths: spec.paybackMonths,
    compliance: COMPLIANCE,
  };
}

export function formatUSD(n: number): string {
  return "$" + n.toLocaleString("en-US");
}
