"use client";

import { useCallback, useEffect, useState } from "react";
import { Stat } from "@/components/ui";
import type { Customer, DbStats, Partner } from "@/lib/db/types";

const STATUS_LABEL: Record<string, string> = {
  prospect: "潜在",
  contacted: "已触达",
  replied: "已回复",
  visit: "拜访中",
  won: "已签单",
};
const STATUS_COLOR: Record<string, string> = {
  prospect: "bg-slate-100 text-slate-600",
  contacted: "bg-sky-100 text-sky-700",
  replied: "bg-emerald-100 text-emerald-700",
  visit: "bg-amber-100 text-amber-700",
  won: "bg-brand/10 text-brand",
};
const SIGNAL_LABEL: Record<string, string> = { red: "红灯·极度缺工", yellow: "黄灯·潜在瓶颈", green: "绿灯·平稳" };
const SIGNAL_COLOR: Record<string, string> = { red: "bg-brand", yellow: "bg-amber-400", green: "bg-emerald-500" };
const fmtCad = (n: number) => "$" + Math.round(n / 1000) + "K";

export default function DatabasePage() {
  const [stats, setStats] = useState<DbStats | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [total, setTotal] = useState(0);
  const [tab, setTab] = useState<"customers" | "partners">("customers");
  const [loading, setLoading] = useState(true);

  const [region, setRegion] = useState("");
  const [tier, setTier] = useState("");
  const [segment, setSegment] = useState("");
  const [signal, setSignal] = useState("");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (region) params.set("region", region);
    if (tier) params.set("tier", tier);
    if (segment) params.set("segment", segment);
    if (signal) params.set("signal", signal);
    if (q) params.set("q", q);
    const [s, c, p] = await Promise.all([
      fetch("/api/db/stats").then((r) => r.json()),
      fetch("/api/db/customers?" + params.toString()).then((r) => r.json()),
      fetch("/api/db/partners").then((r) => r.json()),
    ]);
    setStats(s);
    setCustomers(c.customers);
    setTotal(c.total);
    setPartners(p.partners);
    setLoading(false);
  }, [region, tier, segment, signal, q]);

  useEffect(() => {
    load();
  }, [load]);

  async function advance(id: string, next: string) {
    await fetch("/api/db/customers/" + id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    await load();
  }
  const NEXT: Record<string, string> = { prospect: "contacted", contacted: "replied", replied: "visit", visit: "won" };
  const NEXT_LABEL: Record<string, string> = { prospect: "标记触达", contacted: "标记回复", replied: "派发拜访", visit: "标记签单" };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">动态客户与渠道数据库</h1>
          <p className="text-xs text-slate-400">第二阶段 · 300 家客户（安省 60% 饱和开发）+ 100 家渠道商 · 中小型企业切入</p>
        </div>
        <div className="flex gap-2">
          <a className="btn-ghost" href="/api/db/export?format=csv">导出 CSV</a>
          <a className="btn-primary" href="/api/db/export?format=xlsx">导出 Excel (300×20)</a>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
          <Stat label="客户总数" value={stats.total} sub="安省 180 / 美中 120" />
          <Stat label="安省占比" value={stats.ontarioPct + "%"} sub="60% 饱和开发目标" />
          <Stat label="SME（Tier2/3）" value={stats.tier2 + stats.tier3} sub={`T2 ${stats.tier2} · T3 ${stats.tier3}`} />
          <Stat label="红灯·极度缺工" value={stats.redSignal} sub={`黄 ${stats.yellowSignal} · 绿 ${stats.greenSignal}`} />
          <Stat label="管道总价值" value={fmtCad(stats.totalPipelineCad)} sub={`已签单 ${stats.wonCount}`} />
          <Stat label="渠道商" value={stats.partners} sub={`安省 ${stats.partnersOntario}`} />
        </div>
      )}

      <div className="flex gap-2 text-sm">
        <button className={"rounded-lg px-3 py-1.5 font-medium " + (tab === "customers" ? "bg-brand/10 text-brand" : "text-slate-600 hover:bg-slate-100")} onClick={() => setTab("customers")}>客户（{total || ""}）</button>
        <button className={"rounded-lg px-3 py-1.5 font-medium " + (tab === "partners" ? "bg-brand/10 text-brand" : "text-slate-600 hover:bg-slate-100")} onClick={() => setTab("partners")}>渠道商（{partners.length}）</button>
      </div>

      {tab === "customers" && (
        <div className="card flex flex-wrap items-center gap-2 p-3">
          <input className="input flex-1 min-w-[160px]" placeholder="搜索企业 / 城市 / 决策人 / 邮箱" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="input w-32" value={region} onChange={(e) => setRegion(e.target.value)}>
            <option value="">全部区域</option>
            <option value="安省">安省</option>
            <option value="美中">美中</option>
          </select>
          <select className="input w-28" value={tier} onChange={(e) => setTier(e.target.value)}>
            <option value="">全部层级</option>
            <option value="Tier2">Tier2</option>
            <option value="Tier3">Tier3</option>
          </select>
          <select className="input w-32" value={segment} onChange={(e) => setSegment(e.target.value)}>
            <option value="">全部品类</option>
            <option value="禽肉">禽肉</option>
            <option value="猪牛肉">猪牛肉</option>
            <option value="熟食/调理">熟食/调理</option>
            <option value="海鲜">海鲜</option>
            <option value="综合">综合</option>
          </select>
          <select className="input w-36" value={signal} onChange={(e) => setSignal(e.target.value)}>
            <option value="">全部招聘信号</option>
            <option value="red">红灯·极度缺工</option>
            <option value="yellow">黄灯·潜在瓶颈</option>
            <option value="green">绿灯·平稳</option>
          </select>
        </div>
      )}

      {loading ? (
        <div className="card p-10 text-center text-slate-400">加载中…</div>
      ) : tab === "customers" ? (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-400">
              <tr>
                <th className="px-3 py-2">编号</th>
                <th className="px-3 py-2">企业 / 城市</th>
                <th className="px-3 py-2">区域</th>
                <th className="px-3 py-2">层级</th>
                <th className="px-3 py-2">品类</th>
                <th className="px-3 py-2">人数</th>
                <th className="px-3 py-2">意向产品</th>
                <th className="px-3 py-2">招聘信号</th>
                <th className="px-3 py-2">预估单值</th>
                <th className="px-3 py-2">渠道商</th>
                <th className="px-3 py-2">状态</th>
                <th className="px-3 py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-mono text-xs text-slate-400">{c.id}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-ink">{c.company}</div>
                    <div className="text-xs text-slate-400">{c.city} · {c.province}</div>
                  </td>
                  <td className="px-3 py-2 text-slate-500">{c.region}</td>
                  <td className="px-3 py-2 text-slate-500">{c.tier}</td>
                  <td className="px-3 py-2 text-slate-500">{c.segment}</td>
                  <td className="px-3 py-2 text-slate-500">{c.employees}</td>
                  <td className="px-3 py-2 text-slate-500">{c.productInterest}</td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                      <span className={"h-2.5 w-2.5 rounded-full " + SIGNAL_COLOR[c.recruitmentSignal]} />
                      {SIGNAL_LABEL[c.recruitmentSignal]}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-500">{fmtCad(c.estDealCad)}</td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-400">{c.partnerId}</td>
                  <td className="px-3 py-2"><span className={"chip " + STATUS_COLOR[c.status]}>{STATUS_LABEL[c.status]}</span></td>
                  <td className="px-3 py-2">
                    {NEXT[c.status] && (
                      <button className="btn-ghost px-2 py-1 text-xs" onClick={() => advance(c.id, NEXT[c.status])}>
                        {NEXT_LABEL[c.status]}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {customers.length === 0 && (<tr><td colSpan={12} className="px-3 py-8 text-center text-slate-400">无匹配客户</td></tr>)}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-400">
              <tr>
                <th className="px-3 py-2">编号</th>
                <th className="px-3 py-2">名称 / 城市</th>
                <th className="px-3 py-2">区域</th>
                <th className="px-3 py-2">类型</th>
                <th className="px-3 py-2">专长</th>
                <th className="px-3 py-2">服务半径</th>
                <th className="px-3 py-2">七三开</th>
                <th className="px-3 py-2">活跃客户</th>
                <th className="px-3 py-2">管道价值</th>
                <th className="px-3 py-2">状态</th>
              </tr>
            </thead>
            <tbody>
              {partners.map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-mono text-xs text-slate-400">{p.id}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-ink">{p.name}</div>
                    <div className="text-xs text-slate-400">{p.city} · {p.province} · {p.contact}</div>
                  </td>
                  <td className="px-3 py-2 text-slate-500">{p.region}</td>
                  <td className="px-3 py-2 text-slate-500">{p.type}</td>
                  <td className="px-3 py-2 text-slate-500">{p.specialty}</td>
                  <td className="px-3 py-2 text-slate-500">{p.coverageKm} km</td>
                  <td className="px-3 py-2 text-slate-500">{(p.commissionRate * 100).toFixed(0)}%</td>
                  <td className="px-3 py-2 text-slate-500">{p.activeAccounts}</td>
                  <td className="px-3 py-2 text-slate-500">{fmtCad(p.pipelineValueCad)}</td>
                  <td className="px-3 py-2"><span className={"chip " + (p.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500")}>{p.status === "active" ? "合作中" : "待激活"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
