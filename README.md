<![CDATA[```
 ███╗   ██╗ ███████╗ ██████╗  ██╗   ██╗
 ████╗  ██║ ██╔════╝ ██╔══██╗ ██║   ██║
 ██╔██╗ ██║ █████╗   ██████╔╝ ██║   ██║
 ██║╚██╗██║ ██╔══╝   ██╔══██╗ ╚██╗ ██╔╝
 ██║ ╚████║ ███████╗ ██║  ██║  ╚████╔╝
 ╚═╝  ╚═══╝ ╚══════╝ ╚═╝  ╚═╝   ╚═══╝
```

> **西历 1995 年 10 月 4 日——**
> 第壱話「使徒、襲来」。
>
> 那年，碇真嗣第一次坐进初号机的驾驶舱。
> 没有人问过他愿不愿意。任务来了，就必须上。
>
> 31 年后的今天——使徒没有来。
> 但你的任务像使徒一样，一个接一个，永不停歇。
>
> **不能逃避。**

---

<p align="center">
  <strong>███ NERV 本部戰術作戰系統 ███</strong><br>
  <em>基于 OpenClaw 的自适应 Multi-Agent 协作框架</em><br>
  <br>
  <code>15 台 EVA 机体 · 三柱指挥体制 · Harness Engineering · 自进化工具发现 · MAGI 战情室</code>
</p>

<p align="center">
  <a href="#-这套系统适合谁">🎯 适合谁</a> ·
  <a href="#-30-秒感受多-agent-的力量">⚡ 30 秒体验</a> ·
  <a href="#-为什么不一样">💡 为什么不一样</a> ·
  <a href="#-magi-戰情室-v30">📋 MAGI 战情室</a> ·
  <a href="#-harness-engineering-物理安全矩阵">🛡️ Harness</a> ·
  <a href="#-三柱指挥体制">🏛️ 三柱体制</a> ·
  <a href="#-全员阵列">👥 全员阵列</a> ·
  <a href="#-自进化引擎marduk-機関-v2">🧬 自进化引擎</a>
</p>

---

## 🎯 这套系统适合谁

如果你符合以下任一条件，NERV 就是为你设计的：

### 已经在使用 OpenClaw 的用户

你已经体验过单个 Agent 的能力上限——帮你写代码、搜资料、做分析。但你一定遇到过这种场景：

> *「写完文案后，还要手动喂给另一个 Agent 配图，配完图再手动喂给发布脚本……」*

这不叫自动化，这叫**你自己变成了胶水**。

NERV 消灭了这个问题。你只负责下达战略指令，15 个专职机体自动编排、自动流转、自动交付。

### 正在用单一 Agent 处理复杂工作流的用户

你可能正在忍受一个"全能型"Agent 的痛苦：上下文越来越长、幻觉越来越多、一改就崩、逻辑混成一团——但你不知道有更好的架构。

**Multi-Agent 不是"多请几个 LLM 帮忙"。** 它是一种从根本上不同的工程思维：

| | 单 Agent 模式 | NERV Multi-Agent |
|:--|:-------------|:-----------------|
| 上下文 | 一个 session 塞所有事 → 爆 | 每个机体独立上下文，用完即销毁 |
| 出错时 | 改一处 → 全局崩 | 哪台机体出问题隔离哪台，其他不受影响 |
| 加新功能 | 改 system prompt → 越来越长 → 幻觉 | 注册新 Skill，零侵入 |
| 安全 | 全部权限给一个 Agent → 裸奔 | 最小权限 + 三层物理审查 |
| 可观测性 | 黑箱 | DAG 管线可视化 + 全链路审计日志 |

---

## ⚡ 30 秒感受 Multi-Agent 的力量

安装完 NERV 之后，试着给主 Agent 下达这条指令：

```
帮我生成一个定时推送任务：

每天早上 10 点，抓取过去 24 小时关于 AI 的最新技术晨报。
抓取逻辑分为三个板块，以「主标题 + 内容分析 + 对应链接」的方式提取内容：

1. 顶尖观点与技术
   (a) 抓取行业顶尖大佬发表的最新观点和技术
   (b) 抓取各大主流 AI 公司发表的关于 Harness Engineering 的论文或技术分享

2. 平台热点信息
   抓取 HN、arXiv 等平台最新、重要、讨论度高的几条技术信息

3. 深度媒体报道
   抓取国内外主流媒体关于 AI 内容的最新深度报道

以上内容每天定时推送到我的飞书。
```

**一条指令。没有第二步。**

在单 Agent 模式下，你得自己拆任务、自己写爬虫、自己配定时器、自己对接飞书。

在 NERV 里，你只管说话，系统自动编排：

```
你 → gendo（分析）→ misato（编排 DAG）
  ├─ n1: mari（爬取 HN/arXiv）
  ├─ n2: mari（爬取媒体报道）       ← 与 n1 并行
  ├─ n3: eva-03（搜索顶尖大佬社媒） ← 与 n1 并行
  ├─ n4: eva-00（三路数据清洗合并）  ← 依赖 n1+n2+n3
  ├─ n5: eva-13（生成晨报文案）     ← 依赖 n4
  ├─ n6: gendo（推送到飞书）        ← 依赖 n5
  └─ n7: misato（注册 Cron 定时器） ← 依赖 n6
```

7 台机体并行出击。爬虫和文案是不同的 Agent，互不污染。任何一环出错，只熔断那一台，其他继续。

**这就是 Multi-Agent 的力量：复杂度不在工具内部，而在工具的编排中。**

---

## 💡 为什么不一样

大多数多 Agent 系统的做法：

> "来，写一个超级脚本，爬微博、爬抖音、爬小红书，全部塞进一个文件里。"
>
> 然后代码越写越烂。改了抖音的逻辑，YouTube 的功能坏了。
> 加了新平台，500 行代码变 2000 行。Bug 修不完，上下文爆了，大模型开始幻觉。

**这就是传统模式的死亡螺旋：越全能的脚本越脆弱，越专一的 Agent 越强悍。**

NERV 的做法完全不同。我们不写全能脚本——我们编排专职 Agent 蜂群：

```
你: "帮我抓取抖音热门视频，整理成分析报告"
                        ↓
            碇源堂（战略顾问）
            "抖音需要专用工具，让我找找..."
                        ↓ TOOL_SEARCH
            EVA-03（工具猎人）
            "GitHub 上找到 douyin-dlp，star 2800，依赖简单"
                        ↓ 安全审查（强制）
            渚薰（安全审查）
            "代码安全，准许部署"
                        ↓ 推荐
            碇源堂 → 你
            "推荐使用 douyin-dlp，是否批准？"
                        ↓ 用户确认
            赤木律子（代码编排）
            "标准 I/O 适配器编写完成，adapter_lint 校验通过"
                        ↓
            EVA-01（部署终端）
            "Docker 构建完成，--network none 沙箱部署"
                        ↓
            明日香（调试测试）
            "Dry-Run 通过，输出符合 JSON Schema"
                        ↓
    ┌─────────── 从此以后 ───────────┐
    │ 系统永久学会了抓抖音视频。        │
    │ 下次再有类似需求，直接走。        │
    └───────────────────────────────┘
```

**每个 Agent 只做一件事，通过标准化 I/O 像搭积木一样组合出任意复杂的工作流。**

---

## 📋 MAGI 戰情室 v3.0

实时监控面板，SSE 驱动的「战争指挥室」级可视化系统。

### 四大面板

| 面板 | 功能 |
|:-----|:-----|
| **◆ 作戰室** | Agent 三态可视化（作戦中/待命/熔斷） · DAG 六角形管线 · 审批脉冲队列 · 审计日志 |
| **⛨ 三道防線** | Harness 三道防线实时统计（PASS ✓ / REJECT ✗ 对比） · SEELE 石碑模态框 |
| **✦ 死海文書** | 已完成任务归档 · GraphRAG 实体图谱插槽 · Rei 记忆蒸馏实时日志 |
| **⚔ 兵工廠** | Skill 注册表 · native/discovered 分类 · MARDUK 发现管线状态 |

### 技术特性

- **SSE 实时推送**：每 2 秒推送系统全状态，零轮询
- **11 个 REST 端点**：status / agents / tasks / logs / approvals / harness-stats / system-stats / skills / scrolls / breaker-logs / dag/:id
- **战情室视觉**：六角几何背景 · 橙色警示光暈 · 矩阵掃描過渡動畫
- **三态覆盖层**：Agent 卡片实时反映运行/待命/熔断状态
- **SEELE 石碑**：一键查看 seele_breaker 所有封驳记录和违规详情
- **15 个像素头像**：遵照《新世紀福音戰士·新劇場版》原著高保真生成

### 启动

```bash
# 终端 A：后端 API
cd ~/.openclaw/nerv/magi && node server/index.cjs

# 终端 B：前端
cd ~/.openclaw/nerv/magi && npx vite --host
```

---

## 🛡️ Harness Engineering 物理安全矩阵

这是 NERV 区别于所有"玩具型"多 Agent 系统的核心壁垒。

**我们不信任任何 LLM 输出。** 每一行代码、每一次部署、每一个外部工具的引入，都必须通过物理层面的三道防线——不是 prompt 里写一句"请注意安全"，而是真正的脚本级拦截。

### 三道防線

```
                  ┌───────────────────────────────────┐
                  │       LLM 输出（不被信任）           │
                  └────────────────┬──────────────────┘
                                   ▼
                  ┌────────────────────────────────────┐
                  │ 🔴 第一道：SEELE BREAKER 物理熔断     │
                  │    正则扫描 API Key / 反弹 Shell /     │
                  │    挖矿特征 / 越权指令                 │
                  │    → 命中即封驳，不可绕过               │
                  └────────────────┬──────────────────┘
                                   ▼ 通过
                  ┌────────────────────────────────────┐
                  │ 🟡 第二道：ADAPTER LINT 契约校验       │
                  │    AST 解析适配器代码结构               │
                  │    try-catch / JSON stdout / exit 0|1 │
                  │    → 不符合 I/O 契约即拒绝注册          │
                  └────────────────┬──────────────────┘
                                   ▼ 通过
                  ┌────────────────────────────────────┐
                  │ 🟢 第三道：SCHEMA VALIDATOR 物理过滤   │
                  │    字段白名单校验 · 数据完整性评分        │
                  │    → integrity_score < 50%             │
                  │      触发 NODE_FAILED                  │
                  └────────────────┬──────────────────┘
                                   ▼ 通过
                  ┌────────────────────────────────────┐
                  │           ✅ 安全数据流               │
                  └────────────────────────────────────┘
```

### 完整安全矩阵

| 机制 | 防线 | 说明 |
|:-----|:-----|:-----|
| 🔐 文件 I/O | 输入隔离 | 所有工具通过 `sandbox_io/<task_id>/input.json` 传参，杜绝 Bash 注入 |
| 🐳 Docker 沙箱 | 物理隔离 | exec 强制 sandbox，discovered 工具独立 Dockerfile |
| 🔌 物理断网 | 网络隔离 | discovered 工具 `docker run --network none`，需联网须 SEELE L4 审批 |
| 🛡️ 零信任校验 | 输出校验 | 强类型中文报错 + 重试引导，不信任任何 LLM 原始输出 |
| ⚡ 并发安全 | 数据库 | SQLite WAL + busy_timeout 5000ms + withRetry 指数退避 |
| 🔒 最小权限 | 权限收敛 | seele 只能跑 security_probe + seele_breaker，gendo exec 仅限 nerv-publisher |
| 📝 全链路审计 | 审计 | 每个操作写 audit_logs，物理脚本直写 harness_stats（零 LLM 开销） |
| 🔄 环路熔断 | DAG 保护 | retry ≥ 3 → CIRCUIT_BROKEN → 下游 BLOCKED |
| 🚨 物理熔断 | 代码扫描 | `seele_breaker.js` 正则扫描高危特征，命中即封驳 |
| 🔍 AST 校验 | 代码结构 | `adapter_lint.js` 强制检查适配器 try-catch + JSON stdout + 退出码 |
| 📐 Schema 校验 | 数据过滤 | `schema_validator.py` 字段白名单物理过滤，LLM 只做语义润色 |
| ⏳ 异步审批 | 人机协作 | `pending_approvals` 表 + `adam_notifier.py` 飞书推送 |

> **关键设计决策**：所有 Harness 日志由物理脚本直写数据库（`harness_stats` 表），零 LLM Token 开销。不让大模型读 STDOUT 再调工具记日志——那会凭空增加一次 Tool Call，浪费延迟和 Token。

---

## 🏛️ 三柱指挥体制

```
                         ┌─────────────────┐
                         │   你（造物主）     │
                         └────────┬────────┘
                                  │
         ┌────────────────────────┼────────────────────────┐
         ▼                        ▼                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  碇源堂 (gendo)  │    │ 葛城美里 (misato) │    │  SEELE (seele)   │
│  對外戰略顧問     │←──→│  作戦指揮官       │←──→│  安全審計会       │
│                 │    │                 │    │                 │
│ 用户沟通         │    │ DAG 路由          │    │ 风控熔断          │
│ 方案推荐         │    │ 任务分派          │    │ 敏感拦截          │
│ 工具发现决策      │    │ 状态巡检          │    │ 全链路审计        │
│ 发布授权         │    │                 │    │                 │
└────────┬────────┘    └────────┬────────┘    └─────────────────┘
         │              ┌──────┴──────┐          指 挥 層
─────────┼──────────────┼─────────────┼──────────────────────
         │        ┌─────▼─────┐  ┌────▼────┐  ┌──────────┐
         │        │ 赤木律子   │  │ 碇真嗣   │  │ 绫波零    │
         │        │ 代码编排   │  │ 数据编排  │  │ 记忆守护  │
         │        └──┬──┬──┬──┘  └──┬──┬──┬─┘  └──────────┘
         │           │  │  │       │  │  │       編 排 層
─────────┼───────────┼──┼──┼───────┼──┼──┼────────────────────
         │       ┌───┘  │  └──┐  ┌┘  │  └──┐
         │    ┌──▼──┐┌──▼─┐┌──▼┐┌▼──┐┌▼──┐┌▼──────┐
         │    │明日香││渚薰 ││初号││真希││三号││零号    │
         │    │调试  ││审查 ││部署││爬虫││搜索+││清洗   │
         │    └─────┘└────┘└───┘└───┘│发现│└──────┘
         │                           └───┘
         │    ┌──────┐┌──────┐┌──────────┐
         └───→│二号机 ││十三号 ││量产机     │
              │舆情   ││文案   ││视觉生成   │
              └──────┘└──────┘└──────────┘
                              作 戰 層
```

### 四层隔离 · 最小权限

| 层级 | 角色 | 原则 |
|:-----|:-----|:-----|
| **指挥层** | gendo · misato · seele | 三柱分权：对外沟通 · 内部路由 · 安全审计 |
| **编排层** | ritsuko · shinji · rei | 局部自治 · 编排下游 · 聚合评估 · 可重试 |
| **作战层** | 10 台机体 | 一次性电池 · 最小权限 · 完成即销毁 · sandbox 强制 |
| **神明层** | Adam · Lilith · Spear | 功能函数（非 Agent）· 审批/备份/巡检 |

---

## 🧬 自进化引擎（MARDUK 機関 v2）

**这是 NERV 和其他多 Agent 系统的根本区别。**

传统系统是静态的——你预装了什么工具，它就只能用什么工具。
NERV 是自进化的——遇到不会的事，它自己去找工具、审查、部署、注册，下次就会了。

### 进化闭环

```
用户需求 → misato: "没有匹配的 Skill"
              ↓ TOOL_GAP
          gendo: "让我帮你找"
              ↓ TOOL_SEARCH
          eva-03: GitHub + Web 搜索 Top-5
              ↓ 安全审查（强制）
          kaworu: "3 个 APPROVE / 2 个 REJECT"
              ↓ 推荐
          gendo → 用户: "推荐方案 A（⭐2800），是否部署？"
              ↓ 用户确认
          ritsuko: 编写符合标准 I/O 的适配器 (Adapter) 代码
              ↓
          eva-01: 独立 Dockerfile 封装与沙箱部署（物理隔离）
              ↓
          asuka: 构造虚拟 input.json 进行空载测试 (Dry-Run)
              ↓ 测试通过
          misato: skill_registry 新增一条永久路由
              ↓
          ✅ 系统永久获得新能力
```

### 三堵墙 · 三道解法

大模型集成第三方工具时，有三个致命陷阱：

| 陷阱 | 描述 | NERV 的解法 |
|:-----|:-----|:------------|
| **上下文崩溃** | 20 个文件塞给 LLM → 幻觉 | eva-03 只提取 README + 依赖 + 入口（≤200 字/项） |
| **依赖地狱** | pip install 爆炸 | 每个工具独立 Dockerfile，老死不相往来 |
| **胶水脆弱** | 一改全坏 | 标准 I/O 契约：输入 JSON 文件 → 输出 STDOUT JSON → exit 0/1 |

### 能力分层路由

```sql
-- 用户请求 "抓小红书"
-- ① 查找专用适配器（最高优先级）
SELECT * FROM skill_registry 
  WHERE pattern LIKE '%xiaohongshu%' AND source_type = 'discovered';

-- ② 没找到？使用原生工具兜底
SELECT * FROM skill_registry 
  WHERE source_type = 'native' AND tags LIKE '%crawler%';

-- ③ 连兜底都不够？启动自进化
→ TOOL_GAP → gendo → eva-03 搜索 → 用户确认 → 永久注册
```

### 🔌 标准 I/O 适配器契约 (The Adapter Protocol)

系统之所以能无缝衔接任意 GitHub 开源工具，全靠这套极简的契约化 I/O。无论底层是 Python 还是 Node.js，所有 `discovered` 工具必须被 Ritsuko 封装为满足以下协议的黑盒：

- **输入 (Input)**：通过文件入参 `sandbox_io/<task_id>/input.json`（彻底消灭 Bash 转义/注入灾难）。
- **输出 (Output)**：执行完毕后，`STDOUT` 必须打印标准 JSON：`{"status": "ok|error", "files": [...], "error": null}`。
- **状态 (Exit Code)**：`0` 代表节点成功，`非 0` 触发明日香的调试循环或 DAG 熔断。

---

## ⚡ 30 秒部署

### 前置条件

- [OpenClaw](https://openclaw.ai) 已安装
- Node.js 18+
- macOS / Linux

### 安装

```bash
git clone https://github.com/你的用户名/nerv.git ~/.openclaw/nerv
cd ~/.openclaw/nerv
chmod +x install.sh && ./install.sh
openclaw restart
```

安装脚本自动完成：
- ✅ 注册 15 个 NERV Agent 到 `openclaw.json`
- ✅ 初始化 `nerv.db`（SQLite WAL 模式 + 种子 Skill）
- ✅ 配置 Lilith 每日备份
- ✅ 备份你的原始 `openclaw.json`（可一键恢复）
- ✅ 不影响你现有的任何 Agent

### 验证

```bash
openclaw agent nerv-misato "系统状态报告"
```

---

## 👥 全员阵列

### 指挥层（三柱体制）

| 机体 | 代号 | 职责 | 权限 |
|:-----|:-----|:-----|:-----|
| 🎯 碇源堂 | `nerv-gendo` | 首席戰略顧問 · 用户沟通 · 方案推荐 · 工具发现决策 · 发布授权 | read, memory_search, sessions_send, exec (仅限 nerv-publisher) |
| 🗡️ 葛城美里 | `nerv-misato` | 作戦指揮官 · DAG 路由 · 任务分派 · 状态巡检 | read, write, exec (工具脚本), sessions_send |
| 🔒 SEELE | `nerv-seele` | 安全審計会 · 风控熔断 · 敏感拦截 · 全链路审计 | read, write, exec (仅 security_probe.js + seele_breaker.js) |

### 编排层

| 机体 | 代号 | 职责 | 权限 |
|:-----|:-----|:-----|:-----|
| 🔬 赤木律子 | `nerv-ritsuko` | 代码 Pipeline 编排 · 质量验收 | read, write, exec (sandbox) |
| ⚡ 碇真嗣 | `nerv-shinji` | 数据 Pipeline 编排 · Schema 锚点 | read, write, exec (sandbox), memory_search |
| 🌙 绫波零 | `nerv-rei` | 记忆守护 · 向量检索 · Skill GC · 损坏文件隔离 | read, write, memory_search |

### 作战层（一次性电池）

| 机体 | 代号 | 职责 | 特殊能力 |
|:-----|:-----|:-----|:---------|
| 🔥 式波明日香 | `nerv-asuka` | 代码调试 · Bug 定位 | exec (sandbox) |
| 🎵 渚薰 | `nerv-kaworu` | 代码审查 · 安全审计 | 三层 Skill 矩阵 (codex/gstack/aider) |
| 🕷️ 真希波 | `nerv-mari` | 爬虫采集 · 平台适配 | exec, 403 退避协议 |
| 📡 二号机 | `nerv-eva02` | 舆情监控 · 趋势预警 | read, write |
| 🔍 三号机 | `nerv-eva03` | **深度搜索 + 工具发现** | exec (gh CLI), 双模式 |
| 🧹 零号机 | `nerv-eva00` | 数据清洗 · 字段白名单 · 完整性评分 | read, write |
| ✍️ 十三号机 | `nerv-eva13` | 文案生成 · 多语言 | read, write |
| 🛠️ 初号机 | `nerv-eva01` | 部署运维 · Docker | exec (sandbox), 幂等部署 |
| 🎨 量产机 | `nerv-eva-series` | 视觉生成 · 配图 | read, write, image-gen |

### 神明节点（功能函数，非 Agent）

| 节点 | 实现 | 触发条件 |
|:-----|:-----|:---------|
| 亚当 (Adam) | `adam_notifier.py` 飞书审批 | seele 标记 L4/L5 风险 → 你本人审批 |
| 莉莉丝 (Lilith) | Cron 脚本 | 每日 03:00 备份 nerv.db |
| 朗基努斯之枪 (Spear) | `spear_sync.js` 状态对齐 | 每 5 分钟扫描孤岛/漏调度/环路/异常节点自动重调度 |

---

## ⚔️ 作战流程

### 常规任务（现有工具可解决）

```
你: "帮我抓取微博热搜前 10，清洗后写一篇分析文章，配图发到小红书"

gendo（战略顾问）分析需求 → 翻译为结构化指令 → 交给 misato
misato 分解 DAG：
  n1: mari (抓取微博热搜)
  n2: eva-00 (数据清洗)        ← 依赖 n1
  n3: eva-13 (生成分析文章)     ← 依赖 n2
  n4: eva-series (生成配图)    ← 依赖 n2（与 n3 并行）
  n5: gendo (发布授权)         ← 依赖 n3 + n4

misato → shinji（数据编排）→ 调度 mari/eva-00/eva-13/eva-series
全部完成 → shinji 回报 misato → gendo 展示结果
gendo: "42 条数据已清洗，5 篇文案已生成。发布到小红书？"
你: "发布"
gendo: 通过 nerv-publisher 发布 → 推送结果给你
```

### 工具不足时（自进化流程）

```
你: "帮我下载这个抖音视频，去水印"

gendo: 查 skill_registry → 没有抖音专用工具
misato: TOOL_GAP → gendo
gendo → eva-03: TOOL_SEARCH "douyin video download no watermark"
eva-03:
  ① DuckDuckGo 初筛
  ② gh search repos --sort=stars
  ③ 只提取 README + 依赖 + 入口（不拉全量代码）
  → 返回 Top-5 候选
gendo → kaworu: 强制安全审查（不可跳过）
kaworu: "douyin-dlp APPROVE / xxx REJECT（有恶意依赖）"
gendo → 你: "推荐 douyin-dlp（⭐2800，Python，依赖简单）"
你: "批准"
eva-01: 生成独立 Dockerfile → 部署到 sandbox → 测试通过
gendo: 展示适配器代码 → 你 APPROVE → misato 注册到 skill_registry
✅ 从此系统永久会抓抖音视频
```

### 事件驱动（非轮询）

每个节点执行完后，**立即** `sessions_send` 回上级：
- 前线 → 编排层（shinji/ritsuko）
- 编排层 → misato
- misato ↔ gendo（需用户确认时）

Heartbeat 只做**兜底容灾**：
- 检测孤岛节点（sessions_send 丢失时的安全网）
- 检测漏调度（自动补发触发消息）
- 环路熔断（retry ≥ 3 次自动 CIRCUIT_BROKEN）

---

---

## 対領域 (A.T.Field)

每个 Agent 在物理层面完全隔离：
- 独立 workspace · 独立 SOUL.md · 独立 session 上下文
- 通信只通过 `sessions_send`，消息即时化
- misato 零记忆原则：调度决策只从 nerv.db 冷读取
- 作战层 Agent 是一次性电池：完成即销毁，不污染上下文

这不是 metaphor，这是真正的 A.T.Field——**绝对领域的隔离边界**。

---

## 死海文書庫 (Scrolls of the Sea)

NERV 的长期记忆系统：
- rei（绫波零）守护的知识库
- 任务完成后自动沉淀关键信息到 `memory_queue/`
- 凌晨 Cron 提纯：去重 → Embedding → 写入向量库
- 下次同类任务时，rei 主动注入历史上下文
- 损坏文件隔离：JSON 异常 → `corrupted/` + SECURITY_ALERT（不无限重试）
- Skill GC：`discovered` 类工具 30 天未用自动清理（`native` 类永不自动删除）

---

## 🔧 技术栈

| 组件 | 技术 |
|:-----|:-----|
| Agent 运行时 | OpenClaw Gateway |
| Agent 通信 | sessions_send (A2A) |
| 状态存储 | SQLite WAL (nerv.db) · busy_timeout 5000ms |
| DAG 引擎 | 自建（并行分支 + 条件依赖 + DFS 环检测） |
| 工具发现 | MARDUK v2（GitHub CLI + Web Search + 安全审查） |
| 物理安全 | seele_breaker.js + adapter_lint.js + schema_validator.py |
| 战情室 | React + Vite · SSE 实时推送 · 六角几何 UI |
| 代码沙箱 | Docker (`--rm --network none`) |
| 长期记忆 | LanceDB / Obsidian MCP |
| Skill 路由 | nerv.db → skill_registry（native + discovered 分层）|

---

## 🗑️ 卸载

```bash
cd ~/.openclaw/nerv && ./uninstall.sh
openclaw restart
```

卸载脚本会：
- ✅ 恢复安装前的 `openclaw.json` 备份
- ✅ 移除 nerv.db 和所有备份
- ✅ **不影响你其他的 Agent**
- ✅ 可选完全删除 nerv 目录

---

## License

MIT

---

> *「逃げちゃダメだ、逃げちゃダメだ、逃げちゃダメだ……」*
>
> *——碇真嗣，西历 2015 年*
]]>
