# 奥楷机械 · 北美 AI 海外营销与销售自动化系统

基于《奥楷机械北美市场战略规划（2027–2029）》**第四阶段**方案落地的可运行系统：把「AI 获客流水线 / 招聘监控抓线索 / 大模型冷邮件 / 1.5 小时地面拜访」做成一套自动化销售引擎，并部署到 Vercel。

## 四大模块

1. **AI 获客流水线** — 全网爬取 → 锁定安省/美中线索 → 提取 Plant Manager → 千人千面冷邮件 → 1.5h 地面拜访签单。仪表盘「一键运行流水线」自动串起扫描→生成→投递→派发。
2. **招聘监控（千人千面线索抓取）** — 每日监控肉企招聘（Indeed/ZipRecruiter/Adzuna），一旦密集招聘 Packaging Line Operator/Packer，自动判定「极度缺工」红灯，开发优先级升 A。支持 Vercel Cron 每日 06:07 自动扫描。
3. **大模型冷邮件生成** — 调取招聘时薪，5 秒生成《贵司后道装袋工序精益改进与 ROI 测算报告》。接入 OpenAI 兼容大模型（DeepSeek/Gemini 均可）；无 Key 时回退内置高质量模板，开箱即用。
4. **线索派发与 1.5 小时地面拜访** — 收到积极回复后，按地缘 + 七三开协议自动派发最近本地 SI/代理商，1.5h 车程内驱车上门，附标准 90 分钟拜访流程。

## 技术栈

- Next.js 14（App Router）+ TypeScript + Tailwind CSS
- 数据：内存种子（演示模式）或 Vercel KV（生产持久化，自动探测）
- 大模型：OpenAI 兼容协议（LLM_API_KEY / LLM_BASE_URL / LLM_MODEL）
- 招聘数据：Adzuna（ADZUNA_APP_ID / ADZUNA_APP_KEY），无 Key 用确定性模拟信号引擎
- 部署：Vercel（含 `vercel.json` 与每日 Cron）

## 本地运行

```bash
npm install
cp .env.example .env.local   # 可选：填入 LLM / Adzuna / KV 等
npm run dev                  # http://localhost:3000
```

不填任何环境变量也能以「演示模式」完整运行（模板冷邮件 + 模拟信号）。

## 部署到 Vercel

```bash
# 方式一：CLI
npm i -g vercel
vercel login
vercel --prod

# 方式二：Git 推送后在 Vercel 导入本仓库，框架自动识别 nextjs
```

生产环境建议在 Vercel 项目绑定 **KV**（自动注入 `KV_REST_API_URL` / `KV_REST_API_TOKEN`），实现跨实例持久化；并在 Environment Variables 中填入 `LLM_API_KEY` 等以启用真实大模型与招聘数据。

## API 速览

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/stats` | 仪表盘 KPI / 漏斗 / 动态 |
| GET | `/api/leads` | 线索列表（支持 stage/priority/q 过滤） |
| POST | `/api/leads` | 新增线索 |
| PATCH | `/api/leads/[id]` | 推进阶段 / 优先级 / 模拟回复 |
| GET/POST | `/api/recruitment/scan` | 招聘扫描（POST 手动，GET 供 Cron） |
| GET | `/api/recruitment` | 信号列表 |
| POST | `/api/email/generate` | 生成冷邮件（大模型/模板） |
| POST | `/api/email/send` | 投递冷邮件 |
| GET/POST | `/api/visits` | 拜访列表 / 七三开派发建单 |
| POST | `/api/pipeline/run` | 一键运行完整获客流水线 |
| POST | `/api/reset` | 重置为初始种子 |

## 目录结构

```
src/lib/      types / store / seed / roi / jobs / llm / geo / ops
src/app/      layout + 5 个页面 + api 路由
data 通过 seed.ts 内置（安省 12 家肉企 + 6 家渠道商）
```

> 注：所有客户与渠道商数据为演示样本，部署前请替换为真实数据或接入贵司 CRM。
