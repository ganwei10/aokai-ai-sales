"use client";

import { useCallback, useEffect, useState } from "react";
import { Stat } from "@/components/ui";
import type {
  ChannelPartner,
  Customer,
  DbStats,
  DiscoveredCompany,
  SystemIntegrator,
} from "@/lib/db/types";

const STATUS_LABEL: Record<string, string> = {
  prospect: "潜在", contacted: "已触达", replied: "已回复", visit: "拜访中", won: "已签单",
};
const STATUS_COLOR: Record<string, string> = {
  prospect: "bg-slate-100 text-slate-600", contacted: "bg-sky-100 text-sky-700",
  replied: "bg-emerald-100 text-emerald-700", visit: "bg-amber-100 text-amber-700", won: "bg-brand/10 text-brand",
};
const SIGNAL_LABEL: Record<string, string> = { red: "红灯·极度缺工", yellow: "黄灯·潜在瓶颈", green: "绿灯·平稳" };
const SIGNAL_COLOR: Record<string, string> = { red: "bg-brand", yellow: "bg-amber-400", green: "bg-emerald-500" };
const DISC_STATUS: Record<string, string> = { new: "待评估", qualifying: "评估中", converted: "已转化", rejected: "已排除" };
const DISC_COLOR: Record<string, string> = {
  new: "bg-slate-100 text-slate-600", qualifying: "bg-sky-100 text-sky-700",
  converted: "bg-emerald-100 text-emerald-700", rejected: "bg-rose-100 text-rose-600",
};
const fmtCad = (n: number) => "$" + Math.round(n / 1000) + "K";

type Tab = "customers" | "channels" | "si" | "discovered";

export default function DatabasePage() {
  const [stats, setStats] = useState<DbStats | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [channels, setChannels] = useState<ChannelPartner[]>([]);
  const [sis, setSi] = useState<SystemIntegrator[]>([]);
  const [discovered, setDiscovered] = useState<DiscoveredCompany[]>([]);
  const [tab, setTab] = useState<Tab>("customers");
  const [loading, setLoading] = useState(true);

  const [region, setRegion] = useState("");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (region) params.set("region", region);
    if (q) params.set("q", q);
    const [s, c, ch, si, d] = await Promise.all([
      fetch("/api/db/stats").then((r) => r.json()),
      fetch("/api/db/customers?" + params.toString()).then((r) => r.json()),
      fetch("/api/db/channels?" + params.toString()).then((r) => r.json()),
      fetch("/api/db/sis?" + params.toString()).then((r) => r.json()),
      fetch("/api/monitor/discovered").then((r) => r.json()),
    ]);
    setStats(s);
    setCustomers(c.customers);
    setChannels(ch.channels);
    setSi(si.sis);
    setDiscovered(d.discovered);
    setLoading(false);
  }, [region, q]);

  useEffect(() => { load(); }, [load]);

  async function advance(id: string, next: string) {
    await fetch("/api/db/customers/" + id, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    await load();
  }
  const NEXT: Record<string, string> = { prospect: "contacted", contacted: "replied", replied: "visit", visit: "won" };
  const NEXT_LABEL: Record<string, string> = { prospect: "标记触达", contacted: "标记回复", replied: "派发拜访", visit: "标记签单" };

  const counts = { customers: customers.length, channels: channels.length, si: sis.length, discovered: discovered.length };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">动态数据库（三类实体分离）</h1>
          <p className="text-xs text-slate-400">第二阶段 · 客户 300（安省 60%）/ 渠道商 70 / SI 30 · 招聘发现 + 全网动态见「监控中心」</p>
        </div>
        <div className="flex gap-2">
          <a className="btn-ghost" href="/api/db/export?format=csv&entity=channels">导出渠道商 CSV</a>
          <a className="btn-ghost" href="/api/db/export?format=csv&entity=sis">导出 SI CSV</a>
          <a className="btn-primary" href="/api/db/export?format=xlsx">导出客户 Excel (300×20)</a>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Stat label="客户总数" value={stats.customers} sub={`安省 ${stats.ontarioCustomersPct}%`} />
          <Stat label="渠道商" value={stats.channels} sub="经销商/代理商" />
          <Stat label="SI 集成商" value={stats.sis} sub="整线/后道/前道" />
          <Stat label="待评估(招聘发现)" value={stats.discovered} sub="入站未发现的新公司" />
          <Stat label="动态信号" value={stats.signals} sub={`出站 ${stats.lastOutboundAt ? "已跑" : "未跑"}`} />
          <Stat label="管道价值" value={fmtCad(stats.totalPipelineCad)} sub={`SME ${stats.sme}`} />
        </div>
      )}

      <div className="flex gap-2 text-sm">
        {([["customers", "客户"], ["channels", "渠道商"], ["si", "SI 集成商"], ["discovered", "待评估池"]] as [Tab, string][]).map(([k, label]) => (
          <button key={k} className={"rounded-lg px-3 py-1.5 font-medium " + (tab === k ? "bg-brand/10 text-brand" : "text-slate-600 hover:bg-slate-100")} onClick={() => setTab(k)}>
            {label}（{counts[k] || ""}）
          </button>
        ))}
      </div>

      <div className="card flex flex-wrap items-center gap-2 p-3">
        <input className="input flex-1 min-w-[160px]" placeholder="搜索企业 / 名称 / 城市 / 联系人" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input w-32" value={region} onChange={(e) => setRegion(e.target.value)}>
          <option value="">全部区域</option>
          <option value="安省">安省</option>
          <option value="美中">美中</option>
        </select>
      </div>

      {loading ? (
        <div className="card p-10 text-center text-slate-400">加载中…</div>
      ) : (
        <div className="card overflow-x-auto">
          {tab === "customers" && <CustomersTable rows={customers} onAdvance={advance} next={NEXT} nextLabel={NEXT_LABEL} statusLabel={STATUS_LABEL} statusColor={STATUS_COLOR} sigLabel={SIGNAL_LABEL} sigColor={SIGNAL_COLOR} fmt={fmtCad} />}
          {tab === "channels" && <ChannelsTable rows={channels} fmt={fmtCad} />}
          {tab === "si" && <SiTable rows={sis} fmt={fmtCad} />}
          {tab === "discovered" && <DiscoveredTable rows={discovered} discStatus={DISC_STATUS} discColor={DISC_COLOR} />}
        </div>
      )}
    </div>
  );
}

function CustomersTable({ rows, onAdvance, next, nextLabel, statusLabel, statusColor, sigLabel, sigColor, fmt }: any) {
  return (
    <table className="w-full text-sm">
      <thead className="bg-slate-50 text-left text-xs uppercase text-slate-400">
        <tr>
          <th className="px-3 py-2">编号</th><th className="px-3 py-2">企业 / 城市</th><th className="px-3 py-2">区域</th>
          <th className="px-3 py-2">层级</th><th className="px-3 py-2">品类</th><th className="px-3 py-2">人数</th>
          <th className="px-3 py-2">意向产品</th><th className="px-3 py-2">招聘信号</th><th className="px-3 py-2">预估单值</th>
          <th className="px-3 py-2">渠道商</th><th className="px-3 py-2">SI</th><th className="px-3 py-2">状态</th><th className="px-3 py-2">操作</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((c: Customer) => (
          <tr key={c.id} className="border-t border-slate-100">
            <td className="px-3 py-2 font-mono text-xs text-slate-400">{c.id}</td>
            <td className="px-3 py-2"><div className="font-medium text-ink">{c.company}</div><div className="text-xs text-slate-400">{c.city} · {c.province}</div></td>
            <td className="px-3 py-2 text-slate-500">{c.region}</td>
            <td className="px-3 py-2 text-slate-500">{c.tier}</td>
            <td className="px-3 py-2 text-slate-500">{c.segment}</td>
            <td className="px-3 py-2 text-slate-500">{c.employees}</td>
            <td className="px-3 py-2 text-slate-500">{c.productInterest}</td>
            <td className="px-3 py-2"><span className="inline-flex items-center gap-1.5 text-xs text-slate-500"><span className={"h-2.5 w-2.5 rounded-full " + sigColor[c.recruitmentSignal]} />{sigLabel[c.recruitmentSignal]}</span></td>
            <td className="px-3 py-2 text-slate-500">{fmt(c.estDealCad)}</td>
            <td className="px-3 py-2 font-mono text-xs text-slate-400">{c.channelId ?? "—"}</td>
            <td className="px-3 py-2 font-mono text-xs text-slate-400">{c.siId ?? "—"}</td>
            <td className="px-3 py-2"><span className={"chip " + statusColor[c.status]}>{statusLabel[c.status]}</span></td>
            <td className="px-3 py-2">{next[c.status] && <button className="btn-ghost px-2 py-1 text-xs" onClick={() => onAdvance(c.id, next[c.status])}>{nextLabel[c.status]}</button>}</td>
          </tr>
        ))}
        {rows.length === 0 && <tr><td colSpan={13} className="px-3 py-8 text-center text-slate-400">无匹配客户</td></tr>}
      </tbody>
    </table>
  );
}

function ChannelsTable({ rows, fmt }: { rows: ChannelPartner[]; fmt: (n: number) => string }) {
  return (
    <table className="w-full text-sm">
      <thead className="bg-slate-50 text-left text-xs uppercase text-slate-400">
        <tr><th className="px-3 py-2">编号</th><th className="px-3 py-2">名称 / 城市</th><th className="px-3 py-2">区域</th><th className="px-3 py-2">类型</th><th className="px-3 py-2">服务半径</th><th className="px-3 py-2">聚焦</th><th className="px-3 py-2">七三开</th><th className="px-3 py-2">活跃客户</th><th className="px-3 py-2">管道价值</th><th className="px-3 py-2">状态</th></tr>
      </thead>
      <tbody>
        {rows.map((p) => (
          <tr key={p.id} className="border-t border-slate-100">
            <td className="px-3 py-2 font-mono text-xs text-slate-400">{p.id}</td>
            <td className="px-3 py-2"><div className="font-medium text-ink">{p.name}</div><div className="text-xs text-slate-400">{p.city} · {p.province} · {p.contact}</div></td>
            <td className="px-3 py-2 text-slate-500">{p.region}</td>
            <td className="px-3 py-2 text-slate-500">{p.type}</td>
            <td className="px-3 py-2 text-slate-500">{p.coverageKm} km</td>
            <td className="px-3 py-2 text-slate-500">{p.tierFocus}</td>
            <td className="px-3 py-2 text-slate-500">{(p.commissionRate * 100).toFixed(0)}%</td>
            <td className="px-3 py-2 text-slate-500">{p.activeAccounts}</td>
            <td className="px-3 py-2 text-slate-500">{fmt(p.pipelineValueCad)}</td>
            <td className="px-3 py-2"><span className={"chip " + (p.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500")}>{p.status === "active" ? "合作中" : "待激活"}</span></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SiTable({ rows, fmt }: { rows: SystemIntegrator[]; fmt: (n: number) => string }) {
  return (
    <table className="w-full text-sm">
      <thead className="bg-slate-50 text-left text-xs uppercase text-slate-400">
        <tr><th className="px-3 py-2">编号</th><th className="px-3 py-2">名称 / 城市</th><th className="px-3 py-2">区域</th><th className="px-3 py-2">类型</th><th className="px-3 py-2">服务半径</th><th className="px-3 py-2">聚焦</th><th className="px-3 py-2">七三开</th><th className="px-3 py-2">活跃客户</th><th className="px-3 py-2">管道价值</th><th className="px-3 py-2">状态</th></tr>
      </thead>
      <tbody>
        {rows.map((p) => (
          <tr key={p.id} className="border-t border-slate-100">
            <td className="px-3 py-2 font-mono text-xs text-slate-400">{p.id}</td>
            <td className="px-3 py-2"><div className="font-medium text-ink">{p.name}</div><div className="text-xs text-slate-400">{p.city} · {p.province} · {p.contact}</div></td>
            <td className="px-3 py-2 text-slate-500">{p.region}</td>
            <td className="px-3 py-2 text-slate-500">{p.type}</td>
            <td className="px-3 py-2 text-slate-500">{p.coverageKm} km</td>
            <td className="px-3 py-2 text-slate-500">{p.tierFocus}</td>
            <td className="px-3 py-2 text-slate-500">{(p.commissionRate * 100).toFixed(0)}%</td>
            <td className="px-3 py-2 text-slate-500">{p.activeAccounts}</td>
            <td className="px-3 py-2 text-slate-500">{fmt(p.pipelineValueCad)}</td>
            <td className="px-3 py-2"><span className={"chip " + (p.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500")}>{p.status === "active" ? "合作中" : "待激活"}</span></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DiscoveredTable({ rows, discStatus, discColor }: { rows: DiscoveredCompany[]; discStatus: Record<string, string>; discColor: Record<string, string> }) {
  if (rows.length === 0)
    return <div className="px-3 py-10 text-center text-slate-400">暂无待评估公司。去「监控中心」运行入站招聘发现试试。</div>;
  return (
    <table className="w-full text-sm">
      <thead className="bg-slate-50 text-left text-xs uppercase text-slate-400">
        <tr><th className="px-3 py-2">企业</th><th className="px-3 py-2">区域</th><th className="px-3 py-2">发现关键词</th><th className="px-3 py-2">摘要</th><th className="px-3 py-2">状态</th><th className="px-3 py-2">发现时间</th></tr>
      </thead>
      <tbody>
        {rows.map((d) => (
          <tr key={d.id} className="border-t border-slate-100">
            <td className="px-3 py-2"><div className="font-medium text-ink">{d.company}</div><div className="text-xs text-slate-400">{d.city ?? ""}</div></td>
            <td className="px-3 py-2 text-slate-500">{d.region ?? "—"}</td>
            <td className="px-3 py-2 text-xs text-slate-400">{d.query}</td>
            <td className="px-3 py-2 text-slate-500">{d.snippet}</td>
            <td className="px-3 py-2"><span className={"chip " + discColor[d.status]}>{discStatus[d.status]}</span></td>
            <td className="px-3 py-2 text-slate-400">{d.discoveredAt}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
