"use client";

import { useCallback, useEffect, useState } from "react";
import type { ColdEmail, Lead } from "@/lib/types";
import { Spinner } from "@/components/ui";

function usd(n: number) {
  return "$" + n.toLocaleString("en-US");
}

export default function EmailPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [emails, setEmails] = useState<(ColdEmail & { company?: string; city?: string })[]>([]);
  const [leadId, setLeadId] = useState("");
  const [draft, setDraft] = useState<ColdEmail | null>(null);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    const [l, e] = await Promise.all([fetch("/api/leads"), fetch("/api/emails")]);
    setLeads((await l.json()).leads);
    setEmails((await e.json()).emails);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function generate() {
    if (!leadId) return;
    setBusy(true);
    try {
      const r = await fetch("/api/email/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId }),
      });
      setDraft((await r.json()).email);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function send(id: string) {
    setSending(true);
    try {
      await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailId: id }),
      });
      setDraft(null);
      await load();
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-ink">大模型冷邮件 · 千人千面生成</h1>

      <div className="card flex flex-wrap items-end gap-2 p-4">
        <div className="flex-1 min-w-[220px]">
          <label className="mb-1 block text-xs text-slate-400">选择线索</label>
          <select className="input w-full" value={leadId} onChange={(e) => setLeadId(e.target.value)}>
            <option value="">— 请选择 —</option>
            {leads.map((l) => (
              <option key={l.id} value={l.id}>{l.company}（{l.city}）</option>
            ))}
          </select>
        </div>
        <button className="btn-primary" onClick={generate} disabled={busy || !leadId}>
          <Spinner show={busy} /> 生成冷邮件
        </button>
      </div>

      {draft && (
        <div className="card p-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="chip bg-slate-100 text-slate-500">
              {draft.generatedBy === "llm" ? "大模型生成" : "模板生成（无 LLM Key）"}
            </span>
            <button className="btn-dark" onClick={() => send(draft.id)} disabled={sending}>
              <Spinner show={sending} /> 投递（附 ROI 报告）
            </button>
          </div>
          <div className="text-sm font-semibold text-ink">主题：{draft.subject}</div>
          <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{draft.body}</pre>

          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="mb-2 text-xs font-semibold uppercase text-slate-400">个性化 ROI 报告</div>
            <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
              <div><div className="text-slate-400">方案</div><div className="font-medium">{draft.roi.product}</div></div>
              <div><div className="text-slate-400">替代人工</div><div className="font-medium">{draft.roi.laborSavedHeadcount} 人</div></div>
              <div><div className="text-slate-400">年省人工</div><div className="font-medium">{usd(draft.roi.annualLaborSaving)}</div></div>
              <div><div className="text-slate-400">回收期</div><div className="font-medium">{draft.roi.paybackMonths} 个月</div></div>
              <div><div className="text-slate-400">CAPEX</div><div className="font-medium">{usd(draft.roi.capex)}</div></div>
              <div className="col-span-2"><div className="text-slate-400">合规</div><div className="font-medium">{draft.roi.compliance.join(" / ")}</div></div>
            </div>
          </div>
        </div>
      )}

      <div className="card overflow-x-auto">
        <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-ink">已生成邮件（{emails.length}）</div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-400">
            <tr>
              <th className="px-3 py-2">客户</th>
              <th className="px-3 py-2">主题</th>
              <th className="px-3 py-2">来源</th>
              <th className="px-3 py-2">状态</th>
              <th className="px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {emails.map((e) => (
              <tr key={e.id} className="border-t border-slate-100">
                <td className="px-3 py-2">{e.company ?? e.leadId}</td>
                <td className="px-3 py-2 max-w-[280px] truncate text-slate-600">{e.subject}</td>
                <td className="px-3 py-2 text-slate-400">{e.generatedBy === "llm" ? "大模型" : "模板"}</td>
                <td className="px-3 py-2">
                  <span className={"chip " + (e.status === "sent" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500")}>
                    {e.status === "sent" ? "已投递" : "草稿"}
                  </span>
                </td>
                <td className="px-3 py-2">
                  {e.status === "draft" && (
                    <button className="btn-ghost px-2 py-1 text-xs" onClick={() => send(e.id)}>投递</button>
                  )}
                </td>
              </tr>
            ))}
            {emails.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-400">暂无邮件，先选择线索生成</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
