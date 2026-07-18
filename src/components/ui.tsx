import type { Priority, Stage, SignalSeverity } from "@/lib/types";

export function PriorityBadge({ p }: { p: Priority }) {
  const map: Record<Priority, string> = {
    A: "bg-brand/10 text-brand",
    B: "bg-amber-100 text-amber-700",
    C: "bg-slate-100 text-slate-500",
  };
  return <span className={"chip " + map[p]}>{p} 级</span>;
}

export function StageBadge({ s }: { s: Stage }) {
  const map: Record<Stage, string> = {
    scraped: "bg-slate-100 text-slate-600",
    locked: "bg-sky-100 text-sky-700",
    outreach: "bg-violet-100 text-violet-700",
    replied: "bg-emerald-100 text-emerald-700",
    visit: "bg-amber-100 text-amber-700",
    won: "bg-brand/10 text-brand",
    lost: "bg-rose-100 text-rose-600",
  };
  const labels: Record<Stage, string> = {
    scraped: "挖掘",
    locked: "锁定",
    outreach: "触达",
    replied: "回复",
    visit: "拜访",
    won: "签单",
    lost: "流失",
  };
  return <span className={"chip " + map[s]}>{labels[s]}</span>;
}

export function SeverityDot({ s }: { s: SignalSeverity }) {
  const color = s === "red" ? "bg-brand" : s === "yellow" ? "bg-amber-400" : "bg-emerald-500";
  const label = s === "red" ? "红灯·极度缺工" : s === "yellow" ? "黄灯·潜在瓶颈" : "绿灯·平稳";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
      <span className={"h-2.5 w-2.5 rounded-full " + color} />
      {label}
    </span>
  );
}

export function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-bold text-ink">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

export function Spinner({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
  );
}
