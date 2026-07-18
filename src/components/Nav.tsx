"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "仪表盘" },
  { href: "/leads", label: "线索" },
  { href: "/recruitment", label: "招聘监控" },
  { href: "/email", label: "冷邮件" },
  { href: "/visits", label: "地面拜访" },
];

export default function Nav() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-bold text-ink">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-white">A</span>
          <span className="leading-tight">
            AOKAI
            <span className="block text-[10px] font-normal text-slate-400">AI 销售自动化</span>
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {links.map((l) => {
            const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={
                  "rounded-lg px-3 py-1.5 font-medium transition " +
                  (active ? "bg-brand/10 text-brand" : "text-slate-600 hover:bg-slate-100")
                }
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
