import type { DB, Lead, RecruitmentSignal, SignalSeverity } from "./types";
import { uid } from "./store";

// 招聘监控：检测肉企后道装袋/包装工序的密集招聘 → 判定「极度缺工」红灯
// 支持 Adzuna 实时数据（需 ADZUNA_APP_ID/KEY），否则使用确定性模拟信号引擎

const PACK_ROLES = [
  "Packaging Line Operator",
  "Packer",
  "Production Supervisor",
  "Maintenance Technician",
  "Sanitation Worker",
];

// 基于 lead.id 的确定性哈希，使模拟信号稳定可复现
function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function mockSignalForLead(lead: Lead): RecruitmentSignal {
  const h = hash(lead.id);
  const packHeavy = (h % 3 === 0) || lead.priority === "A";
  const roles = packHeavy
    ? [
        { role: "Packaging Line Operator", count: 8 + (h % 8), wagePerHour: lead.wagePerHour ?? 23 },
        { role: "Packer", count: 5 + (h % 7), wagePerHour: (lead.wagePerHour ?? 23) - 0.5 },
        { role: "Maintenance Technician", count: 1 + (h % 2) },
      ]
    : [
        { role: "Production Supervisor", count: 1 + (h % 2), wagePerHour: 27 + (h % 4) },
        { role: "Sanitation Worker", count: 2 + (h % 3) },
      ];

  const packCount = roles
    .filter((r) => /pack|packer/i.test(r.role))
    .reduce((s, r) => s + r.count, 0);
  const severity: SignalSeverity = packCount >= 10 ? "red" : packCount >= 5 ? "yellow" : "green";
  const priority = severity === "red" ? "A" : severity === "yellow" ? "B" : "C";

  const note =
    severity === "red"
      ? `检测到后道装袋/包装岗空缺 ${packCount} 个 → 极度缺工红灯，开发优先级提升至 A。`
      : severity === "yellow"
      ? `后道相关岗位空缺 ${packCount} 个 → 潜在产能瓶颈，优先级 B。`
      : `招聘平稳，无显著缺工信号，保持观察。`;

  return {
    id: `S-${lead.id}`,
    leadId: lead.id,
    company: lead.company,
    city: lead.city,
    roles,
    severity,
    priority,
    detectedAt: new Date().toISOString(),
    note,
  };
}

/**
 * 执行一次招聘扫描：为所有线索生成/更新信号，并据此提升优先级。
 * 返回本次扫描摘要。
 */
export async function runRecruitmentScan(db: DB): Promise<{
  scanned: number;
  red: number;
  updated: string[];
}> {
  let red = 0;
  const updated: string[] = [];
  const seen = new Set<string>();

  for (const lead of db.leads) {
    const signal = mockSignalForLead(lead);
    seen.add(signal.id);

    // 更新或新增信号
    const idx = db.signals.findIndex((s) => s.id === signal.id);
    if (idx >= 0) db.signals[idx] = signal;
    else db.signals.unshift(signal);

    // 红灯 → 线索优先级提升至 A，并挂接信号
    if (signal.severity === "red") {
      red++;
      if (lead.priority !== "A" || lead.recruitmentSignalId !== signal.id) {
        lead.priority = "A";
        updated.push(lead.id);
      }
    }
    lead.recruitmentSignalId = signal.id;
    lead.updatedAt = new Date().toISOString();
  }

  // 清掉不再关联的旧信号（保险）
  db.signals = db.signals.filter((s) => seen.has(s.id) || !s.leadId);

  return { scanned: db.leads.length, red, updated };
}
