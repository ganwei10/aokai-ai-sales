"use client";

import { useCallback, useEffect, useState } from "react";
import type { MonitorConfig, ConfigCollection } from "@/lib/db/config";

type Mode = "vercel-kv" | "local-file" | "in-memory";

const ENGINES = ["duckduckgo", "wikipedia", "brave", "serp", "tavily", "custom"] as const;
const SENTS: Record<string, string> = { positive: "利好", neutral: "中性", negative: "风险" };
const SENT_COLOR: Record<string, string> = {
  positive: "bg-emerald-100 text-emerald-700",
  neutral: "bg-slate-100 text-slate-600",
  negative: "bg-rose-100 text-rose-600",
};

export default function SettingsPage() {
  const [config, setConfig] = useState<MonitorConfig | null>(null);
  const [mode, setMode] = useState<Mode>("in-memory");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/config").then((x) => x.json());
    setConfig(r.config);
    setMode(r.mode);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function save(res: any) {
    setConfig(res.config);
    setMode(res.mode);
  }
  async function add(collection: ConfigCollection, item: any) {
    setBusy(true);
    try {
      const res = await fetch("/api/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ collection, item }) }).then((x) => x.json());
      if (res.error) setMsg(res.error); else { await save(res); setMsg(`已添加至 ${collection}`); }
    } finally { setBusy(false); }
  }
  async function patch(collection: ConfigCollection, id: string, p: any) {
    const res = await fetch("/api/config", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ collection, id, patch: p }) }).then((x) => x.json());
    if (res.error) setMsg(res.error); else await save(res);
  }
  async function del(collection: ConfigCollection, id: string) {
    const res = await fetch("/api/config", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ collection, id }) }).then((x) => x.json());
    if (res.error) setMsg(res.error); else await save(res);
  }
  async function reset() {
    if (!confirm("确认将所有监控配置恢复为系统默认值？")) return;
    const res = await fetch("/api/config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reset: true }) }).then((x) => x.json());
    await save(res);
    setMsg("已重置为默认配置");
  }

  if (!config) return <div className="card p-6 text-slate-400">加载中…</div>;

  const modeLabel: Record<Mode, string> = {
    "vercel-kv": "Vercel KV（云端持久化）",
    "local-file": "本地文件 data/config.json（重启保留）",
    "in-memory": "内存（重启后恢复默认）",
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-ink">监控配置中心</h1>
          <p className="text-xs text-slate-400">可动态增删：搜索网站、招聘监控网站、招聘关键词、信号分类关键词。修改后运行监控即生效。</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="chip bg-slate-100 text-slate-600">持久化：{modeLabel[mode]}</span>
          <button onClick={reset} disabled={busy} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            重置默认
          </button>
        </div>
      </div>
      {msg && <div className="text-xs text-brand">{msg}</div>}

      {/* 搜索网站（出站动态来源） */}
      <Section title="搜索网站（出站全网动态来源）" desc="出站扫描时按权重遍历这些站点抓取公司动态。内置引擎走专用解析；自定义填 URL 模板（支持 {{query}} 占位符）。">
        <AddSearchSite onAdd={(it) => add("searchSites", it)} busy={busy} />
        <div className="space-y-1">
          {config.searchSites.map((s) => (
            <Row key={s.id} enabled={s.enabled} onToggle={() => patch("searchSites", s.id, { enabled: !s.enabled })} onDel={() => del("searchSites", s.id)}>
              <span className="font-medium text-ink">{s.name}</span>
              <span className="chip bg-slate-100 text-slate-500">{s.engine}</span>
              <span className="text-xs text-slate-400">权重 {s.weight}</span>
              {s.urlTemplate && <span className="text-[11px] text-slate-400 break-all">{s.urlTemplate}</span>}
            </Row>
          ))}
        </div>
      </Section>

      {/* 监控网站（招聘站点，入站发现） */}
      <Section title="监控网站（招聘站点 · 入站发现来源）" desc="入站扫描对每个站点生成 site:<host> 真实搜索，抽取公司名。可增删任意招聘板。">
        <AddWatchSite onAdd={(it) => add("watchSites", it)} busy={busy} />
        <div className="space-y-1">
          {config.watchSites.map((s) => (
            <Row key={s.id} enabled={s.enabled} onToggle={() => patch("watchSites", s.id, { enabled: !s.enabled })} onDel={() => del("watchSites", s.id)}>
              <span className="font-medium text-ink">{s.name}</span>
              <span className="chip bg-slate-100 text-slate-500">site:{s.host}</span>
              <span className="text-xs text-slate-400">权重 {s.weight}</span>
            </Row>
          ))}
        </div>
      </Section>

      {/* 招聘关键词 */}
      <Section title="招聘监控关键词（入站）" desc="入站扫描遍历这些查询词，与监控网站组合生成真实搜索。">
        <AddKV onAdd={(q) => add("recruitKeywords", { query: q })} busy={busy} placeholder="如 automation technician protein processing facility" label="招聘查询词" />
        <div className="space-y-1">
          {config.recruitKeywords.map((k) => (
            <Row key={k.id} enabled={k.enabled} onToggle={() => patch("recruitKeywords", k.id, { enabled: !k.enabled })} onDel={() => del("recruitKeywords", k.id)}>
              <span className="text-sm text-ink">{k.query}</span>
            </Row>
          ))}
        </div>
      </Section>

      {/* 信号分类关键词 */}
      <Section title="信号分类关键词（出站信号识别）" desc="出站扫描用这些规则把网页文本归类为信号类型。可新增任意拓业主题（如 ESG/出口关税），patterns 用逗号或 | 分隔。">
        <AddSignal onAdd={(it) => add("signalKeywords", it)} busy={busy} />
        <div className="space-y-1">
          {config.signalKeywords.map((k) => (
            <Row key={k.id} enabled={k.enabled} onToggle={() => patch("signalKeywords", k.id, { enabled: !k.enabled })} onDel={() => del("signalKeywords", k.id)}>
              <span className="font-medium text-ink">{k.label}</span>
              <span className={"chip " + SENT_COLOR[k.sentiment]}>{SENTS[k.sentiment]}</span>
              <span className="text-[11px] text-slate-400 break-all">/{k.patterns.join("|")}/</span>
            </Row>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="card p-4">
      <div className="mb-1 text-sm font-semibold text-ink">{title}</div>
      <div className="mb-3 text-xs text-slate-400">{desc}</div>
      {children}
    </div>
  );
}

function Row({ enabled, onToggle, onDel, children }: { enabled: boolean; onToggle: () => void; onDel: () => void; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-100 px-3 py-2">
      <button onClick={onToggle} className={"h-4 w-7 rounded-full transition " + (enabled ? "bg-brand" : "bg-slate-300")} title={enabled ? "已启用" : "已禁用"}>
        <span className={"block h-3.5 w-3.5 rounded-full bg-white transition " + (enabled ? "translate-x-3" : "translate-x-0.5")} />
      </button>
      <div className="flex flex-1 flex-wrap items-center gap-2">{children}</div>
      <button onClick={onDel} className="text-xs text-rose-500 hover:underline">删除</button>
    </div>
  );
}

function AddSearchSite({ onAdd, busy }: { onAdd: (it: any) => void; busy: boolean }) {
  const [name, setName] = useState("");
  const [engine, setEngine] = useState<string>("custom");
  const [url, setUrl] = useState("");
  return (
    <div className="mb-3 flex flex-wrap items-end gap-2 rounded-lg bg-slate-50 p-2">
      <Input label="名称" value={name} onChange={setName} placeholder="如 行业新闻站" />
      <div className="flex flex-col">
        <span className="mb-1 text-[11px] text-slate-400">引擎</span>
        <select className="input w-32" value={engine} onChange={(e) => setEngine(e.target.value)}>
          {ENGINES.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>
      {engine === "custom" && <Input label="URL 模板" value={url} onChange={setUrl} placeholder="https://news.x.com/search?q={{query}}" wide />}
      <button disabled={busy || !name} onClick={() => onAdd({ name, engine, kind: engine === "custom" ? "custom" : "builtin", urlTemplate: engine === "custom" ? url : undefined, enabled: true, weight: 99 })}
        className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">添加</button>
    </div>
  );
}

function AddWatchSite({ onAdd, busy }: { onAdd: (it: any) => void; busy: boolean }) {
  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  return (
    <div className="mb-3 flex flex-wrap items-end gap-2 rounded-lg bg-slate-50 p-2">
      <Input label="名称" value={name} onChange={setName} placeholder="如 ZipRecruiter" />
      <Input label="域名(host)" value={host} onChange={setHost} placeholder="ziprecruiter.com" />
      <button disabled={busy || !name || !host} onClick={() => onAdd({ name, host, enabled: true, weight: 99 })}
        className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">添加</button>
    </div>
  );
}

function AddKV({ onAdd, busy, placeholder, label }: { onAdd: (q: string) => void; busy: boolean; placeholder: string; label: string }) {
  const [v, setV] = useState("");
  return (
    <div className="mb-3 flex flex-wrap items-end gap-2 rounded-lg bg-slate-50 p-2">
      <div className="flex flex-1 flex-col">
        <span className="mb-1 text-[11px] text-slate-400">{label}</span>
        <input className="input" value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder}
          onKeyDown={(e) => { if (e.key === "Enter" && v.trim()) { onAdd(v.trim()); setV(""); } }} />
      </div>
      <button disabled={busy || !v.trim()} onClick={() => { onAdd(v.trim()); setV(""); }}
        className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">添加</button>
    </div>
  );
}

function AddSignal({ onAdd, busy }: { onAdd: (it: any) => void; busy: boolean }) {
  const [label, setLabel] = useState("");
  const [sentiment, setSentiment] = useState<string>("positive");
  const [patterns, setPatterns] = useState("");
  const [relevance, setRelevance] = useState("");
  return (
    <div className="mb-3 flex flex-wrap items-end gap-2 rounded-lg bg-slate-50 p-2">
      <Input label="信号类型" value={label} onChange={setLabel} placeholder="如 ESG/碳中和" />
      <div className="flex flex-col">
        <span className="mb-1 text-[11px] text-slate-400">情绪</span>
        <select className="input w-24" value={sentiment} onChange={(e) => setSentiment(e.target.value)}>
          <option value="positive">利好</option>
          <option value="neutral">中性</option>
          <option value="negative">风险</option>
        </select>
      </div>
      <Input label="匹配词(逗号/|分隔)" value={patterns} onChange={setPatterns} placeholder="esg,carbon,green" wide />
      <div className="flex flex-1 flex-col">
        <span className="mb-1 text-[11px] text-slate-400">业务含义</span>
        <input className="input" value={relevance} onChange={(e) => setRelevance(e.target.value)} placeholder="可选" />
      </div>
      <button disabled={busy || !label || !patterns} onClick={() => onAdd({ label, sentiment, patterns: patterns.split(/[,|]/).map((x) => x.trim()).filter(Boolean), relevance: relevance || "用户自定义拓业信号。", enabled: true })}
        className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">添加</button>
    </div>
  );
}

function Input({ label, value, onChange, placeholder, wide }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; wide?: boolean }) {
  return (
    <div className={"flex flex-col " + (wide ? "flex-1 min-w-[200px]" : "")}>
      <span className="mb-1 text-[11px] text-slate-400">{label}</span>
      <input className="input" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}
