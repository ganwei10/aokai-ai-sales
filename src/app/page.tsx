"use client";

import { useCallback, useEffect, useState } from "react";
import { STAGE_LABELS, STAGE_ORDER, type Activity } from "@/lib/types";
import { Stat, Spinner } from "@/components/ui";

interface Stats {
  mode: string;
  totals: {
    leads: number;
    aPriority: number;
    emailsSent: number;
    visitsPlanned: number;
    redSignals: number;
    wonValue: number;
    wonCount: number;
  };
  funnel: { stage: string; count: number }[];
  byPriority: { A: number; B: number; C: number };
  recent: Activity[];
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [msg, setMsg] = useState<string>("");

  const load = useCallback(async () => {
    const r = await fetch("/api/stats");
    setStats(await r.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function runPipeline() {
    setRunning(true);
    setMsg("");
    try {
      const r = await fetch("/api/pipeline/run", { method: "POST" });
      const d = await r.json();
      setMsg(
        `流水线完成：扫描 ${d.scan.scanned} 家 · 生成投递 ${d.emailsSent} 封 · 推进 ${d.advanced} 家 · 派发拜访 ${d.dispatched} 家`
      );
      await load();
    } finally {
      setRunning(false);
    }
  }

  async function reset() {
    if (!confirm("确定重置为初始种子数据？")) return;
    setResetting(true);
    await fetch("/api/reset", { method: "POST" });
    setResetting(false);
    setMsg("已重置为初始种子数据。");
    await load();
  }

  const maxFunnel = stats ? Math.max(1, ...stats.funnel.map((f) => f.count)) : 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">AI 海外营销与销售自动化</h1>
          <p className="text-sm text-slate-500">
            第四阶段 · 获客流水线 / 招聘监控 / 大模型冷邮件 / 1.5 小时地面拜访
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-ghost" onClick={reset} disabled={resetting}>
            <Spinner show={resetting} /> 重置
          </button>
          <button className="btn-primary" onClick={runPipeline} disabled={running}>
            <Spinner show={running} /> 一键运行流水线
          </button>
        </div>
      </div>

      {msg && (
        <div className="card border-brand/30 bg-brand/5 px-4 py-3 text-sm text-brand-700">{msg}</div>
      )}

      {loading || !stats ? (
        <div className="card p-10 text-center text-slate-400">加载中…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <Stat label="线索总数" value={stats.totals.leads} sub={`A 级 ${stats.totals.aPriority} 家`} />
            <Stat label="红灯缺工" value={stats.totals.redSignals} sub="极度缺工信号" />
            <Stat label="已投递邮件" value={stats.totals.emailsSent} sub="千人千面冷邮件" />
            <Stat label="1.5h 拜访" value={stats.totals.visitsPlanned} sub="七三开派发" />
            <Stat label="签单金额" value={"$" + (stats.totals.wonValue / 1000).toFixed(0) + "k"} sub={`${stats.totals.wonCount} 单`} />
            <Stat
              label="持久化"
              value={stats.mode === "vercel-kv" ? "Vercel KV" : "内存"}
              sub={stats.mode === "vercel-kv" ? "已连接" : "演示模式"}
            />
          </div>

          <div className="card p-5">
            <h2 className="mb-3 text-sm font-semibold text-ink">获客流水线漏斗</h2>
            <div className="space-y-2">
              {stats.funnel.map((f) => (
                <div key={f.stage} className="flex items-center gap-3">
                  <div className="w-12 text-xs text-slate-500">{STAGE_LABELS[f.stage as keyof typeof STAGE_LABELS]}</div>
                  <div className="h-6 flex-1 overflow-hidden rounded bg-slate-100">
                    <div
                      className="h-full rounded bg-brand/80"
                      style={{ width: `${(f.count / maxFunnel) * 100}%` }}
                    />
                  </div>
                  <div className="w-8 text-right text-sm font-semibold text-ink">{f.count}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-5">
            <h2 className="mb-3 text-sm font-semibold text-ink">最近动态</h2>
            <ul className="space-y-2 text-sm">
              {stats.recent.map((a) => (
                <li key={a.id} className="flex gap-3">
                  <span className="text-xs text-slate-400">
                    {new Date(a.at).toLocaleString("zh-CN", { hour12: false })}
                  </span>
                  <span className="text-slate-600">[{a.type}] {a.message}</span>
                </li>
              ))}
              {stats.recent.length === 0 && <li className="text-slate-400">暂无动态</li>}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
