import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "AOKAI · AI 海外营销与销售自动化",
  description: "奥楷机械北美市场 AI 获客流水线 · 招聘监控 · 大模型冷邮件 · 1.5 小时地面拜访",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="min-h-screen flex flex-col">
          <Nav />
          <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6">{children}</main>
          <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-400">
            AOKAI Machinery · 北美 AI 销售自动化系统 · 第四阶段交付物
          </footer>
        </div>
      </body>
    </html>
  );
}
