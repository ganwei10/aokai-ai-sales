"use client";

import { useCallback, useEffect, useState } from "react";
import type { Lead, Visit } from "@/lib/types";
import { Spinner } from "@/components/ui";

const MAX_MIN = 90; // 1.5 小时黄金销售半径

interface VisitView extends Visit {
  lead?: Lead;
  partner?: { name: string; type: string; city: string; commissionSplit: string };
}

export default function VisitsPage() {
  const [visits, setVisits] = useState<VisitView[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [leadId, setLeadId] = useState("");

  const load = useCallback(async () => {
    const [v, l] = await Promise.all([fetch("/api/visits"), fetch("/api/leads")]);
    setVisits((await v.json()).visits);
    setLeads((await l.json()).leads);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const available = leads.filter((l) => !l.visitId);

  async function create() {
    if (!leadId) return;
    setBusy(true);
    try {
      await fetch("/api/visits", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadId }) });
      setLeadId("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">1.5 小时地面拜访 · 七三开派发</h1>
          <p className="text-sm text-slate-500">积极回复后，CRM 按地缘自动派发最近本地渠道商，1.5h 车程内驱车上门签单</p>
        </div>
        <div className="flex items-end gap-2">
          <select className="input" value={leadId} onChange={(e) => setLeadId(e.target.value)}>
            <option value="">— 选择待派发线索 —</option>
            {available.map((l) => (
              <option key={l.id} value={l.id}>{l.company}（{l.city}）</option>
            ))}
          </select>
          <button className="btn-primary" onClick={create} disabled={busy || !leadId}>
            <Spinner show={busy} /> 派发拜访
          </button>
        </div>
      </div>

      {loading ? (
        <div className="card p-10 text-center text-slate-400">加载中…</div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {visits.map((v) => {
            const within = v.driveMinutes <= MAX_MIN;
            return (
              <div key={v.id} className="card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-ink">{v.lead?.company}</div>
                    <div className="text-xs text-slate-400">{v.lead?.city} · {v.lead?.region}</div>
                  </div>
                  <span className={"chip " + (within ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                    {v.driveMinutes} min{v.partner ? ` · ${v.partner.city}` : ""}
                  </span>
                </div>

                {v.partner && (
                  <div className="mt-2 rounded-lg bg-slate-50 p-2 text-sm">
                    <div className="font-medium text-ink">{v.partner.name} · {v.partner.type}</div>
                    <div className="text-xs text-slate-500">{v.partner.commissionSplit}</div>
                  </div>
                )}

                <div className="mt-3 space-y-1.5">
                  {v.agenda.map((a, i) => (
                    <div key={i} className="flex gap-3 text-sm">
                      <span className="w-12 shrink-0 font-mono text-xs text-brand">{a.time}</span>
                      <span className="font-medium text-ink">{a.title}</span>
                      <span className="text-slate-400">— {a.detail}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-3 text-xs text-slate-400">状态：{v.status === "planned" ? "已排期" : v.status === "done" ? "已完成" : "已取消"}</div>
              </div>
            );
          })}
          {visits.length === 0 && (
            <div className="card p-10 text-center text-slate-400">暂无拜访，选择线索派发</div>
          )}
        </div>
      )}
    </div>
  );
}
