"use client";

import { useCallback, useEffect, useState } from "react";
import { Stat } from "@/components/ui";
import type { DbStats, MonitorRun, Signal } from "@/lib/db/types";

const SENT_COLOR: Record<string, string> = {
  positive: "bg-emerald-100 text-emerald-700",
  neutral: "bg-slate-100 text-slate-600",
  negative: "bg-rose-100 text-rose-600",
};
const SENT_LABEL: Record<string, string> = { positive: "利好", neutral: "中性", negative: "风险" };
const DIR_LABEL: Record<string, string> = { inbound: "方向A·入站招聘发现", outbound: "方向B·出站全网动态" };
const ETYPE_LABEL: Record<string, string> = { customer: "客户", channel: "渠道商", si: "SI", discovered: "待评估" };

const SIGNAL_TYPES = ["招聘缺工", "招聘扩张", "产能扩张", "新产线/新品", "融资/投资", "并购", "关厂/减产", "管理层变动", "认证/合规", "奖项/新闻", "负面事件"];

export default function MonitorPage() {
  const [stats, setStats] = useState<DbStats | null>(null);
  const [runs, setRuns] = useState<MonitorRun[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [busy, setBusy] = useState<"" | "inbound" | "outbound" | "both">("");
  const [filter, setFilter] = useState({ entityType: "", type: "", sentiment: "" });
  const [watchName, setWatchName] = useState("");
  const [watchRegion, setWatchRegion] = useState("安省");
  const [watchMsg, setWatchMsg] = useState("");

  const load = useCallback(async () => {
    const [s, r, sig] = await Promise.all([
      fetch("/api/db/stats").then((x) => x.json()),
      fetch("/api/monitor/runs").then((x) => x.json()),
      fetch("/api/monitor/signals?" + new URLSearchParams(filter as any).toString()).then((x) => x.json()),
    ]);
    setStats(s); setRuns(r.runs); setSignals(sig.signals);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  async function run(dir: "inbound" | "outbound" | "both") {
    setBusy(dir);
    try {
      if (dir === "inbound") await fetch("/api/monitor/inbound", { method: "POST" });
      else if (dir === "outbound") await fetch("/api/monitor/outbound", { method: "POST" });
      else await fetch("/api/monitor/run", { method: "POST" });
    } finally {
      setBusy("");
      await load();
    }
  }

  async function addWatch() {
    const name = watchName.trim();
    if (!name) return;
    setWatchMsg("添加中…");
    const res = await fetch("/api/monitor/discovered", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company: name, region: watchRegion }),
    });
    if (res.ok) {
      setWatchMsg(`已加入监测：${name}（运行「方向B」即拉取其真实全网信号）`);
      setWatchName("");
    } else {
      setWatchMsg("添加失败：公司名不能为空");
    }
    await load();
  }

  const lastIn = runs.find((r) => r.direction === "inbound");
  const lastOut = runs.find((r) => r.direction === "outbound");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-ink">双向监控中心</h1>
        <p className="text-xs text-slate-400">方向A 招聘网站→抽取公司名（入站发现） ｜ 方向B 库内公司→全网动态（产能/融资/并购/管理层…任何拓业信号）</p>
      </div>

      {stats && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="动态信号总数" value={stats.signals} sub="双向监控产出" />
          <Stat label="待评估公司" value={stats.discovered} sub="入站招聘发现的新公司" />
          <Stat label="上次入站" value={stats.lastInboundAt ? stats.lastInboundAt.slice(0, 10) : "未运行"} />
          <Stat label="上次出站" value={stats.lastOutboundAt ? stats.lastOutboundAt.slice(0, 10) : "未运行"} />
        </div>
      )}

      {/* 双向运行卡 */}
      <div className="grid gap-3 md:grid-cols-3">
        <button onClick={() => run("inbound")} disabled={busy !== ""}
          className="card text-left transition hover:shadow-md disabled:opacity-50">
          <div className="text-sm font-semibold text-ink">方向A · 入站招聘发现</div>
          <div className="mt-1 text-xs text-slate-400">扫招聘职位 → 抽公司名 → 库内标缺工、库外进待评估池</div>
          <div className="mt-3 text-xs text-brand">{busy === "inbound" ? "运行中…" : lastIn ? `上次发现 ${lastIn.found} 条（新 ${lastIn.newDiscovered}）` : "点击运行"}</div>
        </button>
        <button onClick={() => run("outbound")} disabled={busy !== ""}
          className="card text-left transition hover:shadow-md disabled:opacity-50">
          <div className="text-sm font-semibold text-ink">方向B · 出站全网动态</div>
          <div className="mt-1 text-xs text-slate-400">对库内客户/渠道/SI 全网扫描 → 收集拓业相关动态信号</div>
          <div className="mt-3 text-xs text-brand">{busy === "outbound" ? "运行中…" : lastOut ? `上次产出 ${lastOut.newSignals} 条信号` : "点击运行"}</div>
        </button>
        <button onClick={() => run("both")} disabled={busy !== ""}
          className="card bg-brand/5 text-left transition hover:shadow-md disabled:opacity-50 ring-1 ring-brand/20">
          <div className="text-sm font-semibold text-brand">运行双向监控</div>
          <div className="mt-1 text-xs text-slate-400">入站 + 出站 一次跑完</div>
          <div className="mt-3 text-xs text-brand">{busy === "both" ? "运行中…" : "推荐：先跑这一下"}</div>
        </button>
      </div>

      {/* 添加真实监测公司（手动入池，出站扫描拉取真实信号）*/}
      <div className="card p-3">
        <div className="mb-2 text-xs font-semibold uppercase text-slate-400">添加真实监测公司（手动入池）</div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="input flex-1 min-w-[200px]"
            placeholder="输入真实公司名，如 Maple Leaf Foods / Olymel / 双汇 / 雨润"
            value={watchName}
            onChange={(e) => setWatchName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addWatch()}
          />
          <select className="input w-28" value={watchRegion} onChange={(e) => setWatchRegion(e.target.value)}>
            <option value="安省">安省</option>
            <option value="美中">美中</option>
          </select>
          <button onClick={addWatch} className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white transition hover:opacity-90">
            加入监测
          </button>
        </div>
        {watchMsg && <div className="mt-2 text-xs text-slate-500">{watchMsg}</div>}
        <div className="mt-1 text-[11px] text-slate-400">真实公司名才会返回真实信号；种子库为演示用的合成公司名，出站扫描对它们返回 0 属正常。</div>
      </div>

      {/* 运行记录 */}
      {runs.length > 0 && (
        <div className="card p-3">
          <div className="mb-2 text-xs font-semibold uppercase text-slate-400">运行记录</div>
          <div className="space-y-1 text-sm">
            {runs.slice(0, 8).map((r) => (
              <div key={r.id} className="flex items-center gap-3 text-slate-500">
                <span className="chip bg-slate-100 text-slate-600">{DIR_LABEL[r.direction]}</span>
                <span>{r.startedAt.slice(0, 16).replace("T", " ")}</span>
                <span className="text-slate-400">扫描 {r.scanned} · 发现 {r.found} · 新信号 {r.newSignals}</span>
                <span className={"chip " + (r.status === "done" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>{r.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 信号时间线过滤 */}
      <div className="card flex flex-wrap items-center gap-2 p-3">
        <span className="text-xs font-semibold uppercase text-slate-400">动态信号</span>
        <select className="input w-32" value={filter.entityType} onChange={(e) => setFilter({ ...filter, entityType: e.target.value })}>
          <option value="">全部实体</option>
          <option value="customer">客户</option>
          <option value="channel">渠道商</option>
          <option value="si">SI</option>
          <option value="discovered">待评估</option>
        </select>
        <select className="input w-36" value={filter.type} onChange={(e) => setFilter({ ...filter, type: e.target.value })}>
          <option value="">全部类型</option>
          {SIGNAL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="input w-28" value={filter.sentiment} onChange={(e) => setFilter({ ...filter, sentiment: e.target.value })}>
          <option value="">全部情绪</option>
          <option value="positive">利好</option>
          <option value="neutral">中性</option>
          <option value="negative">风险</option>
        </select>
      </div>

      {/* 信号时间线 */}
      <div className="card divide-y divide-slate-100">
        {signals.length === 0 && <div className="px-3 py-10 text-center text-slate-400">暂无信号。运行「方向B 出站全网动态」开始收集。</div>}
        {signals.slice(0, 60).map((s) => (
          <div key={s.id} className="flex flex-wrap items-start gap-3 p-3">
            <span className="chip bg-slate-100 text-slate-600">{ETYPE_LABEL[s.entityType]}</span>
            <span className="chip bg-slate-100 text-slate-600">{s.type}</span>
            <div className="min-w-[200px] flex-1">
              <div className="text-sm font-medium text-ink">{s.entityName} — {s.title}</div>
              <div className="text-xs text-slate-500">{s.summary}</div>
              <div className="mt-1 text-xs text-slate-400">业务含义：{s.businessRelevance}</div>
            </div>
            <div className="text-right text-xs text-slate-400">
              <div>{s.date}</div>
              <div>{s.source}</div>
            </div>
            <span className={"chip " + SENT_COLOR[s.sentiment]}>{SENT_LABEL[s.sentiment]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
