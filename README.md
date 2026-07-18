# 奥楷机械 · 北美 AI 海外营销与销售自动化系统

基于《奥楷机械北美市场战略规划（2027–2029）》落地的可运行系统，已覆盖**第二阶段（动态客户与渠道数据库）**与**第四阶段（AI 海外营销与销售自动化）**。第二阶段把「安省 60% 饱和开发」做成一套含 300 家客户（20 项字段）+ 100 家渠道商的可检索、可导出数据库；第四阶段把「AI 获客流水线 / 招聘监控抓线索 / 大模型冷邮件 / 1.5 小时地面拜访」做成自动化销售引擎，并部署到 Vercel。

## 第二阶段 · 动态数据库（三类实体分离 + 双向监控）

> 重构要点：客户 / 渠道商 / SI 三类实体**彻底分离**；新增**双向监控引擎**，招聘发现与全网动态都汇入统一的「动态信号」。

### 三类实体
- **终端客户（肉企）300 家 × 20 字段**：安省 180（60%）/ 美中 120（40%），SME（Tier2/3）切入，每条带招聘缺工信号（红/黄/绿）。
- **渠道商 70 家**（经销商/代理商）：安省 42 / 美中 28，含服务半径、聚焦、七三开佣金（30%）。
- **SI 系统集成商 30 家**（整线/后道/前道/视觉检测）：安省 18 / 美中 12。
- 客户同时挂 `channelId` 与 `siId`，渠道与 SI 不再混在同一张表。

### 双向监控（/monitor 监控中心）
- **方向A 入站（招聘发现）**：扫招聘网站职位 → 抽取公司名 → 库内已有则标「招聘缺工」信号，库内没有则进**待评估池（DiscoveredCompany）**待评估入池。
- **方向B 出站（全网动态）**：对库内每家公司全网扫描，收集**任何有利于拓业的动态**——产能扩张、招聘扩张、新产线/新品、融资/投资、并购、关厂/减产、管理层变动、认证/合规、奖项/新闻、负面事件——统一沉淀为「动态信号」时间线。
- 所有信号可过滤（实体/类型/情绪），并可一键导出 CSV / Excel。
- 数据源：`WEB_SEARCH_API_KEY`（Brave/Serp/Tavily，由 `WEB_SEARCH_ENGINE` 选择）+ `ADZUNA_APP_ID/KEY`（招聘）；**默认无 Key 即走真实联网搜索（DuckDuckGo HTML 抓取 → 自动回退 DDG 速答 API → Wikipedia），可直接产出真实信号**，无需任何 Key。

### 真实联网搜索（无需 Key 即可跑真实信号）
出站扫描默认使用 **DuckDuckGo 免 Key 真实搜索**：先抓 HTML 结果，遇 bot 限流时自动回退 DDG 官方速答 API 与 Wikipedia 搜索 API，三级回退均为真实数据源，返回带真实 URL 的信号。验证示例（真实公司）：
- `Maple Leaf Foods` → Wikipedia 实体页（DuckDuckGo 速答）
- `Sofina Foods` → 官网 about-us、Indeed 公司页、招聘页（DuckDuckGo HTML），含「招聘扩张」信号
- `Cargill Protein` → Cargill 北美蛋白业务页（DuckDuckGo HTML）

> 注：种子库中的 300 家客户为演示用**合成公司名**（如 "Ferreira Meats Foods Ltd."），真实搜索引擎查无此公司，出站扫描对它们返回 0 属正常。要看真实信号，请在「监控中心」用**添加真实监测公司**输入框加入真实公司名（如 Maple Leaf Foods / Olymel / 双汇 / 雨润），再跑「方向B」。

### 招聘 API（入站发现）
方向A 入站招聘发现接入 **Adzuna**（免费注册 https://developer.adzuna.com/）。填入 `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` 后拉取真实招聘职位；无 Key 时使用模拟招聘信号引擎，演示模式完整可跑。

## 第四阶段 · 四大模块

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
| GET | `/api/db/customers` | 客户数据库（region/tier/segment/signal/status/q 过滤） |
| PATCH | `/api/db/customers/[id]` | 推进客户状态 |
| GET | `/api/db/partners` | 渠道商列表 |
| GET | `/api/db/stats` | 数据库聚合统计（安省占比 / 信号分布 / 管道价值） |
| GET | `/api/db/export?format=csv\|xlsx` | 导出客户数据库 |

## 目录结构

```
src/lib/      types / store / seed / roi / jobs / llm / geo / ops
src/app/      layout + 5 个页面 + api 路由
data 通过 seed.ts 内置（安省 12 家肉企 + 6 家渠道商）
```

> 注：所有客户与渠道商数据为演示样本，部署前请替换为真实数据或接入贵司 CRM。
