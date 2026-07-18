"use client";

import { useCallback, useEffect, useState } from "react";
import type { RecruitmentSignal } from "@/lib/types";
import { PriorityBadge, SeverityDot, Spinner } from "@/components/ui";

export default function RecruitmentPage() {
  const [signals, setSignals] = useState<(RecruitmentSignal & { leadId?: string; leadPriority?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/recruitment");
    const d = await r.json();
    setSignals(d.signals);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function scan() {
    setScanning(true);
    try {
      await fetch("/api/recruitment/scan", { method: "POST" });
      await load();
    } finally {
      setScanning(false);
    }
  }

  async function genEmail(leadId?: string) {
    if (!leadId) return;
    setBusy(leadId);
    try {
      await fetch("/api/email/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadId }) });
    } finally {
      setBusy(null);
    }
  }

  const redCount = signals.filter((s) => s.severity === "red").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">招聘监控 · 千人千面线索抓取</h1>
          <p className="text-sm text-slate-500">
            每日监控安省肉企招聘（Indeed/ZipRecruiter/Adzuna）→ 密集招聘装袋岗即判「极度缺工」红灯
          </p>
        </div>
        <button className="btn-primary" onClick={scan} disabled={scanning}>
          <Spinner show={scanning} /> 运行招聘扫描
        </button>
      </div>

      <div className="card p-4 text-sm text-slate-600">
        监控覆盖 <b>{signals.length}</b> 家 · 红灯（极度缺工）<b className="text-brand"> {redCount} </b> 家 · 红灯线索自动提升为 A 级开发优先级。
      </div>

      {loading ? (
        <div className="card p-10 text-center text-slate-400">加载中…</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {signals.map((s) => (
            <div key={s.id} className="card p-4">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-ink">{s.company}</div>
                <SeverityDot s={s.severity} />
              </div>
              <div className="mt-0.5 text-xs text-slate-400">{s.city}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {s.roles.map((r, i) => (
                  <span key={i} className="chip bg-slate-100 text-slate-600">
                    {r.role} ×{r.count}{r.wagePerHour ? ` · $${r.wagePerHour}/h` : ""}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-sm text-slate-600">{s.note}</p>
              <div className="mt-3 flex items-center justify-between">
                {s.leadPriority && <PriorityBadge p={s.leadPriority as "A" | "B" | "C"} />}
                <button
                  className="btn-ghost px-2 py-1 text-xs"
                  disabled={busy === s.leadId}
                  onClick={() => genEmail(s.leadId)}
                >
                  <Spinner show={busy === s.leadId} /> 生成冷邮件
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
