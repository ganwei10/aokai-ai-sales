"use client";

import { useCallback, useEffect, useState } from "react";
import { PRODUCT_LABELS, STAGE_ORDER, type Lead, type Stage } from "@/lib/types";
import { PriorityBadge, StageBadge, Spinner } from "@/components/ui";

const NEXT: Partial<Record<Stage, Stage>> = {
  scraped: "locked",
  locked: "outreach",
  outreach: "replied",
  replied: "visit",
  visit: "won",
};
const NEXT_LABEL: Record<string, string> = {
  scraped: "锁定",
  locked: "触达",
  outreach: "标记回复",
  replied: "派发拜访",
  visit: "签单",
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [stage, setStage] = useState("");
  const [priority, setPriority] = useState("");
  const [q, setQ] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newLead, setNewLead] = useState({ company: "", city: "", employees: "", tier: "Tier3", productInterest: "AK201000", wagePerHour: "" });

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (stage) params.set("stage", stage);
    if (priority) params.set("priority", priority);
    if (q) params.set("q", q);
    const r = await fetch("/api/leads?" + params.toString());
    const d = await r.json();
    setLeads(d.leads);
    setLoading(false);
  }, [stage, priority, q]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(id: string, fn: () => Promise<unknown>) {
    setBusy(id);
    try {
      await fn();
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function patch(id: string, body: Record<string, unknown>) {
    await fetch("/api/leads/" + id, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  }

  async function addLead() {
    if (!newLead.company || !newLead.city) return;
    await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...newLead,
        employees: Number(newLead.employees) || 0,
        wagePerHour: newLead.wagePerHour ? Number(newLead.wagePerHour) : undefined,
      }),
    });
    setNewLead({ company: "", city: "", employees: "", tier: "Tier3", productInterest: "AK201000", wagePerHour: "" });
    setShowAdd(false);
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-ink">线索池</h1>
        <button className="btn-ghost" onClick={() => setShowAdd((v) => !v)}>{showAdd ? "收起" : "＋ 新增线索"}</button>
      </div>

      {showAdd && (
        <div className="card grid grid-cols-2 gap-3 p-4 md:grid-cols-6">
          <input className="input" placeholder="公司名" value={newLead.company} onChange={(e) => setNewLead({ ...newLead, company: e.target.value })} />
          <input className="input" placeholder="城市" value={newLead.city} onChange={(e) => setNewLead({ ...newLead, city: e.target.value })} />
          <input className="input" placeholder="人数" value={newLead.employees} onChange={(e) => setNewLead({ ...newLead, employees: e.target.value })} />
          <select className="input" value={newLead.tier} onChange={(e) => setNewLead({ ...newLead, tier: e.target.value })}>
            <option value="Tier2">Tier2</option>
            <option value="Tier3">Tier3</option>
          </select>
          <select className="input" value={newLead.productInterest} onChange={(e) => setNewLead({ ...newLead, productInterest: e.target.value })}>
            {Object.entries(PRODUCT_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <button className="btn-primary" onClick={addLead}>保存</button>
        </div>
      )}

      <div className="card flex flex-wrap items-center gap-2 p-3">
        <input className="input flex-1 min-w-[160px]" placeholder="搜索公司 / 城市" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input w-32" value={stage} onChange={(e) => setStage(e.target.value)}>
          <option value="">全部阶段</option>
          {STAGE_ORDER.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
          <option value="lost">lost</option>
        </select>
        <select className="input w-28" value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="">全部优先级</option>
          <option value="A">A 级</option>
          <option value="B">B 级</option>
          <option value="C">C 级</option>
        </select>
      </div>

      {loading ? (
        <div className="card p-10 text-center text-slate-400">加载中…</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-400">
              <tr>
                <th className="px-3 py-2">公司 / 城市</th>
                <th className="px-3 py-2">规模</th>
                <th className="px-3 py-2">产品</th>
                <th className="px-3 py-2">优先级</th>
                <th className="px-3 py-2">阶段</th>
                <th className="px-3 py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">
                    <div className="font-medium text-ink">{l.company}</div>
                    <div className="text-xs text-slate-400">{l.city} · {l.region} · {l.tier} · {l.source}</div>
                  </td>
                  <td className="px-3 py-2 text-slate-500">{l.employees} 人{l.wagePerHour ? ` · $${l.wagePerHour}/h` : ""}</td>
                  <td className="px-3 py-2 text-slate-500">{PRODUCT_LABELS[l.productInterest]}</td>
                  <td className="px-3 py-2"><PriorityBadge p={l.priority} /></td>
                  <td className="px-3 py-2"><StageBadge s={l.stage} /></td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {NEXT[l.stage] && (
                        <button
                          className="btn-ghost px-2 py-1 text-xs"
                          disabled={busy === l.id}
                          onClick={() => act(l.id, async () => {
                            if (l.stage === "replied") {
                              await fetch("/api/visits", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadId: l.id }) });
                            } else if (l.stage === "outreach") {
                              await patch(l.id, { stage: "replied" });
                            } else {
                              await patch(l.id, { stage: NEXT[l.stage] });
                            }
                          })}
                        >
                          <Spinner show={busy === l.id} /> {NEXT_LABEL[l.stage]}
                        </button>
                      )}
                      <button
                        className="btn-ghost px-2 py-1 text-xs"
                        disabled={busy === l.id}
                        onClick={() => act(l.id, async () => fetch("/api/email/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadId: l.id }) }))}
                      >
                        生成邮件
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {leads.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-400">无匹配线索</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
