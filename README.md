<div align="center">

```
 ███╗   ██╗ ███████╗ ██████╗  ██╗   ██╗
 ████╗  ██║ ██╔════╝ ██╔══██╗ ██║   ██║
 ██╔██╗ ██║ █████╗   ██████╔╝ ██║   ██║
 ██║╚██╗██║ ██╔══╝   ██╔══██╗ ╚██╗ ██╔╝
 ██║ ╚████║ ███████╗ ██║  ██║  ╚████╔╝
 ╚═╝  ╚═══╝ ╚══════╝ ╚═╝  ╚═╝   ╚═══╝
```

</div>

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
  <a href="#-从用户视角看任务怎么流动">🧭 任务流</a> ·
  <a href="#-什么是-dag为什么要用-dag">🕸️ DAG</a> ·
  <a href="#-为什么不一样">💡 为什么不一样</a> ·
  <a href="#-magi-戰情室-v30">📋 MAGI 战情室</a> ·
  <a href="#-harness-engineering-物理安全矩阵">🛡️ Harness</a> ·
  <a href="#-三柱指挥体制">🏛️ 三柱体制</a> ·
  <a href="#-已验证-workflow-能力">🎬 已验证 workflow</a> ·
  <a href="#-全员阵列">👥 全员阵列</a> ·
  <a href="#-领域扩张路线-v1">🌐 领域扩张</a> ·
  <a href="#-真实循环案例">🎬 实战案例</a> ·
  <a href="#-终态通知与失败收敛原则">📣 通知与收敛</a> ·
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
你 → gendo（分析/拆解，产出草案）→ 你确认/转交 → misato（编排 DAG）
  ├─ n1: mari（爬取 HN/arXiv）
  ├─ n2: mari（爬取媒体报道）       ← 与 n1 并行
  ├─ n3: eva-03（搜索顶尖大佬社媒） ← 与 n1 并行
  ├─ n4: eva-00（三路数据清洗合并）  ← 依赖 n1+n2+n3
  ├─ n5: eva-13（生成晨报文案）     ← 依赖 n4
  ├─ n6: misato（汇总并通知）       ← 依赖 n5
  └─ n7: misato（注册 Cron 定时器） ← 依赖 n6
```

7 台机体并行出击。爬虫和文案是不同的 Agent，互不污染。任何一环出错，只熔断那一台，其他继续。

**这就是 Multi-Agent 的力量：复杂度不在工具内部，而在工具的编排中。**

> 说明：
> 上图只是示例，不代表每个 DAG 都必须让所有 Agent 出场。
> 在真实运行里，节点 owner 由角色矩阵决定，不由“谁恰好能用某个 skill”决定。
> `compatible_agents` 是能力过滤器，不是最终 owner。
> 在当前分离入口模式下，Gendo 默认只负责产出可转交草案，不会自动替你把任务送到 Misato；你确认后再把方案复制给 Misato 执行。
> Misato 是稳定接单入口：先异步派发 ready 节点，再在同一轮末尾立即回复你 `task_id / 已派发节点 / 等待节点`，最终结果通过 Adam Notifier 主动推送。

---

## 🧭 任务流与 DAG

NERV 的现状不是“一个更会聊天的 Agent”，而是把复杂任务拆成一条可验证、可并行、可回放的编排链。早期或传统 Agent 模式最容易掉进两个坑：一是人类自己当胶水，在不同 Agent 输出之间手动搬运数据；二是把所有步骤硬塞进一个臃肿上下文里，结果一改就崩、幻觉四起。现在这套架构已经不再靠堆 Prompt 硬抗复杂度，而是靠系统工程把意图、编排、执行、审计拆开。

从体系上看，NERV 现在更像“四层物理隔离 + 三柱体制”。`Gendo` 负责把自然语言需求翻成结构化草案，`Misato` 负责把草案编排成任务流并收口终态，`Seele` 负责审计、风险和底层秩序。15 台 EVA 机体不再是全能保姆，而是边界极清晰的特种兵。简单查询走快通道，复杂工程走 DAG 编排；可观测性、审计、熔断、重试都进入控制面，而不是继续藏在模型上下文里。

### 标准用法

1. **先判断这是“拆解题”还是“执行题”**
   - 目标还模糊、工具不确定、你想先看方案：找 **Gendo**
   - 目标已经明确、你要直接开干、你想查进度：找 **Misato**

2. **Gendo 负责把自然语言翻成结构化草案**
   - 业务域是什么
   - 要产出什么 artifact
   - 节点大致怎么拆
   - 哪些地方可能有 TOOL_GAP
   - 如果需求对风格、Hook、脚本完成度高度敏感，先补问再出草案

3. **你确认草案，再转交给 Misato**
   - 当前 NERV 采用分离入口
   - `Gendo` 默认不替你自动下发执行

4. **Misato 创建 `task_id`，实例化 DAG**
   - 只实例化当前真的可执行的节点
   - 入口节点统一 fire-and-forget 异步派发
   - 同一轮末尾立即告诉你：
     - `task_id`
     - 已派发节点
     - 等待节点
     - 最终结果是否通过 Adam 推送

5. **节点在后台异步推进**
   - 前线机体完成后，用 `NODE_COMPLETED / NODE_FAILED` 回报
   - Recorder 写入 `nerv.db`
   - Spear 负责巡检孤岛、漏调度、异常节点

6. **结果收口**
   - 成功：Adam Notifier 推送最终交付
   - 失败：明确告诉你卡在哪一层
   - 可复用经验：Rei 异步沉淀

### 让系统进入 DAG 的口令

如果你要的是“走 NERV 工作流”，不要只说需求本身，要明确加上这类口令：

- `先给我 DAG 草案，再交给 Misato 执行`
- `按 DAG 方式处理`
- `把这件事拆成任务流`
- `不要直接成稿，先编排成工作流`

如果你只说“帮我写一段文案 / 脚本 / 口播”，系统可能会直接单轮输出。
如果你显式要求 DAG，`Gendo` 才会先产草案，`Misato` 才会按编排链路跑。

### 你真正需要提供的东西

NERV 最怕的不是复杂，而是输入含糊。用户侧输入尽量说清这四件事：

- **目标**：你最终想拿到什么
- **输入**：你已经有的数据、文件、链接、商品信息
- **约束**：时间、风格、风险边界、平台边界
- **交付物**：你希望最终看到什么文件或通知

例如：

- 社媒内容：你要的是微博短文案、小红书长文案、抖音脚本，还是三者都要
- 直播脚本：你有没有商品清单、价格、福利、人群画像
- 翻译链路：你要“全文翻译”还是“摘要翻译”，结果写到哪里

### 什么是 DAG

DAG = **有向无环图**。在 NERV 里，它不是装饰性的概念，而是一条现代化工厂的作战流水线：

- **有向**：步骤只能往前推进，谁先谁后是确定的
- **无环**：不允许互相扯皮、互相等待、无限回圈
- **图**：它不是单行道，而是一张可以分叉、并行、汇合的网

放进 NERV 之后，DAG 的含义非常具体：

- **节点（Node）**：每个节点只做一件极度具体的事
- **边（Edge）**：边决定依赖关系，谁必须等谁完成
- **终态（Terminal State）**：任务完成与否，由节点终态和数据库收敛，不由一句“我做完了”决定

例如一条典型链路：

```text
采集 → 清洗 → 成稿 → 通知 → 记忆沉淀
```

写成 DAG 之后，系统才能知道：

- 哪些节点可以并行
- 哪些节点必须等待
- 哪个节点失败会阻塞下游
- 哪个节点完成后应该触发谁

### 为什么 NERV 必须用 DAG

引入 DAG，不是为了“显得高级”，而是为了把控制权从随机对话里拿回来。

如果不用 DAG，就会发生三件事：

1. **所有步骤塞进一个上下文**
   - 抓取、清洗、写稿、通知混在一起
   - 一处出错，整条上下文污染

2. **无法准确回收状态**
   - 你不知道是单个节点做完了，还是整条任务做完了
   - 也不知道后续为什么没继续跑

3. **无法稳定复用**
   - 下次要做类似任务，只能重写一遍 prompt
   - 无法沉淀成模板、规则和可审计的经验

相比单 Agent 模式，DAG 能把失败限制在局部节点；相比很多“多 Agent 开圆桌会”的框架，DAG 不允许机体互相扯皮到失控。我们允许机体在自己的节点里思考，但任务怎么流转、谁先谁后、什么时候结束，必须由这条冷冰冰的物理铁轨决定。

### DAG 在 NERV 里的实际应用

当系统接到一条复杂任务，比如“每天抓取并生成 AI 晨报”，它不会直接把所有要求丢给一个大模型，而是：

1. **任务切片**
   - `Mari` 去抓站点
   - `EVA-03` 去补公开搜索
   - `EVA-00` 做清洗与合并
   - `EVA-13` 负责成稿
   - `Misato` 负责通知与收口

2. **并行出击**
   - 抓取和补证据可以并行
   - 只有依赖汇聚时才进入下一步

3. **状态落库**
   - `tasks + dag_nodes + audit_logs` 才是真相源
   - 聊天消息只是表象，不是事实

4. **用完即毁**
   - 节点级上下文执行完就结束
   - 不把脏上下文继续带进下一环

### 当前 NERV 里最重要的三个原则

1. **不是每条 DAG 都要让所有 Agent 出场**
2. **节点 owner 先看职责，再看 skill**
3. **DAG 的真相源是 `tasks + dag_nodes`，不是聊天消息本身**

---

## 💡 为什么不一样

前面的「任务流与 DAG」已经解释了 NERV 怎么拆任务；这里补的是另一层差异：**我们不是把更多能力塞进同一个大脑，而是把能力沉成可复用的作战体系。**

传统做法往往是：

- 把采集、清洗、成稿、通知塞进一个大脚本
- 或者让多个 Agent 在对话里互相讨论下一步
- 结果是一处改动影响全局，状态难追，失败难收，复用成本极高

NERV 的做法是把复杂度拆到系统层：

- `Gendo` 负责把自然语言收成结构化草案
- `Misato` 负责把草案建成可执行 DAG
- EVA 机体只负责自己的节点，不越权定义整任务终态
- `Recorder / Spear / Adam / nerv.db` 负责状态、巡检、通知和收敛

这带来三个直接结果：

1. **功能扩张不再等于上下文膨胀**
2. **失败可以局部隔离、局部重试，而不是整条链重来**
3. **一条跑通的 DAG 能沉成模板、Skill 和验收标准，后续直接复用**

一句话说：**NERV 不是靠 Prompt 把模型逼成万能工具，而是用 Harness Engineering 把大模型规训成可靠节点。**

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
| 🐳 Docker 沙箱 | 可选增强 | 高风险执行节点可启用独立容器；当前默认以宿主机执行为主 |
| 🔌 执行隔离 | 网络/容器 | 高风险或联网工具可切独立容器与受控网络；默认仍以宿主机执行为主 |
| 🛡️ 契约校验 | 输出校验 | 强类型中文报错 + 重试引导，不信任任何 LLM 原始输出 |
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

### 完整工作流

```
                    ┌─────────────────────────────────────┐
                    │           造物主（用户）               │
                    │                                     │
                    │    IM 连接：nerv-gendo / nerv-misato  │
                    └──────────┬────────┬─────────────────┘
                   复杂需求     │        │   日常任务
                    ┌──────────▼──┐  ┌──▼──────────┐
                    │ 碇源堂 Gendo │  │ 美里 Misato  │
                    │ 需求翻译     │  │ 快通道直达    │
                    │ 工具发现     │──▶│ DAG 编排     │
                    │ 结果反馈     │◀──│ 汇总回报     │
                    └─────────────┘  └──────┬──────┘
                                           │ DISPATCH
                          ┌────────────────┼────────────────┐
                    ┌─────▼─────┐    ┌─────▼─────┐    ┌────▼────┐
                    │ 代码流水线  │    │ 数据流水线  │    │ 基础设施 │
                    │ ritsuko   │    │ shinji    │    │         │
                    │ ├ asuka   │    │ ├ mari    │    │ rei     │
                    │ ├ kaworu  │    │ ├ eva-03  │    │ seele   │
                    │ └ eva-01  │    │ ├ eva-00  │    │ eva-01  │
                    │           │    │ ├ eva-13  │    │         │
                    │           │    │ ├ eva-02  │    │         │
                    │           │    │ └ eva-s   │    │         │
                    └───────────┘    └──────────┘    └─────────┘
```

### 四层隔离 · 最小权限

| 层级 | 角色 | 原则 |
|:-----|:-----|:-----|
| **战略层** | gendo | 不直接干活，只把需求翻成结构化草案：需求翻译 · 工具发现 · 结果确认 |
| **战术层** | misato | 不做内容生产，只管 DAG 路由 · 任务分发 · 终态收口 · task-scoped session 调度 |
| **编排层** | ritsuko · shinji · rei · seele | 局部自治 · 管辖下游 · 聚合评估 · 审计对账 |
| **作战层** | 10 台机体 | 一次性电池 · 最小权限 · 完成即销毁 |
| **Cron 层** | Spear · Probe · Purify | 无人值守脚本 · 不消耗 LLM Token |

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
          eva-01: 独立执行环境封装与隔离部署（必要时 Docker）
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

## ⚡ 部署与连接

### 前置条件

- [OpenClaw](https://openclaw.ai) 已安装
- Node.js 18+
- macOS / Linux

### 安装

```bash
git clone https://github.com/你的用户名/nerv.git
cd nerv
chmod +x install.sh && ./install.sh
openclaw restart
```

安装脚本自动完成：
- ✅ 如果当前仓库不在 `~/.openclaw/nerv`，自动同步到标准路径后继续安装
- ✅ 注册 15 个 NERV Agent 到 `openclaw.json`
- ✅ 初始化 `nerv.db`（SQLite WAL 模式 + 8 张表 + 种子 Skill）
- ✅ **Schema 自动迁移**——旧版数据库自动补齐新列（`ALTER TABLE`）
- ✅ 写入 `skills.load.extraDirs`，统一发现 `nerv/skills` 与 workflow skills
- ✅ 刷新 Skill 注册表并生成安装后验证快照
- ✅ **注册 Cron Job**（Spear 巡检 / SEELE 安全 / Rei 提纯 / Adam 通知）
- ✅ 备份你的原始 `openclaw.json`（可一键恢复）
- ✅ 不影响你现有的任何 Agent

> ⚠️ **Config 变更说明**
>
> 安装时会修改你的 `openclaw.json` 中以下两项：
>
> | 配置项 | 修改方式 | 原因 |
> |:-------|:--------|:-----|
> | `tools.agentToAgent.allow` | **追加合并** — NERV Agent ID 会被加入你现有的允许列表，不会覆盖 | 15 个 Agent 需要互相通信 |
> | `session.visibility` | **强制设为 `all`** | 多 Agent 系统要求所有 session 互相可见，否则 `sessions_send` 无法路由 |
>
> 如果你在安装后需要调整 `session.visibility`，可以在 `openclaw.json` 中手动修改。
> 但请注意：设为非 `all` 可能导致 NERV Agent 间通信失败。

### 🔗 IM 连接（推荐）

我们推荐你将 IM 通讯工具（飞书 / Slack / Discord）**只连接两个 Agent**：

| Agent | ID | 你跟他说什么 |
|:------|:---|:------------|
| **碇源堂** | `nerv-gendo` | 复杂需求、战略决策、新工具审批 |
| **葛城美里** | `nerv-misato` | 日常任务执行、状态查询、简单操作 |

其他 13 个 Agent 不需要连接 IM — 它们由 Gendo 和 Misato 通过 `sessions_send` 内部调度。

### 📌 什么时候找 Gendo，什么时候找 Misato？

| 场景 | 找谁 | 为什么 |
|:-----|:-----|:------|
| 「帮我做一个每天定时推送 AI 晨报的系统」 | **Gendo** | 复杂需求，需要翻译意图 + 判断工具是否足够 |
| 「帮我搜一下 XX 竞品分析」 | **Misato** | 单步任务，快通道直达 eva-03 |
| 「这段代码有 Bug，帮我修」 | **Misato** | 单步任务，快通道直达 asuka |
| 「我需要一个能抓抖音视频的工具」 | **Gendo** | 需要工具发现流程（搜索→审查→部署→注册） |
| 「系统状态怎么样？」 | **Misato** | 状态查询，Misato 直接回答 |
| 「把这篇文章翻译成中文存到 Obsidian」 | **Misato** | 多步任务，Misato 编排 DAG：mari(抓网页)→eva13(翻译)→写入 |
| 「之前那个抓取任务的结果满意吗？需要固化为定期任务吗？」 | **Gendo** | 结果反馈 + 决策确认 |

**简单记忆法**：
- **Gendo = 先把需求拆明白**（战略层：聊需求、审方案、确认结果，输出草案）
- **Misato = 收到草案后执行**（执行层：拆任务、派活、追进度）

补充：
- 不要要求 Misato 为了“雨露均沾”把所有 Agent 都塞进同一条 DAG。
- 不要因为某个 Agent 上下文正热，就把后续不同性质节点继续交给它。
- 真正的节点分流，优先看角色边界，再看 skill 是否可用。
- 如果 Gendo 和 Misato 不在同一聊天入口，用户本人就是两者之间的转交层。

### 验证

```bash
openclaw agent nerv-misato "系统状态报告"
```

### 📡 Adam 通知管道（推荐）

当 NERV 团队在后台执行复杂任务时（可能需要几十分钟），**Adam** 负责在任务完成后主动通知你。

只需一步：在飞书群中添加一个自定义机器人（Webhook），然后把 URL 写入 `nerv/.env`：

```bash
# 在 nerv/.env 中添加：
FEISHU_WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/你的webhook-id
```

完成。从此 NERV 会在以下场景自动推送飞书卡片：

| 场景 | 触发者 | 卡片样式 |
|:-----|:------|:--------|
| 待审批项目（新工具部署等） | Cron 定时扫描 | 🔔 橙色卡片 |
| DAG 任务完成/失败 | Misato / Gendo | ✅ 绿色 / 🚨 红色 |
| 安全告警 | SEELE | ⚠️ 橙色 |

> **原理**：Adam 使用飞书 Webhook 直接 HTTP POST，不依赖任何 Agent 的 session 上下文。
> 即使所有 IM Bot 都未配置，只要有这一个 Webhook，你就能收到通知。

---

## 👥 全员阵列

先看 workflow 能力，再看角色分工。NERV 的人物表不是为了做设定，而是为了让你知道每条真实可跑通的 DAG 该交给谁。

### 指挥层（三柱体制）

| 机体 | 代号 | 职责 | 权限 |
|:-----|:-----|:-----|:-----|
| 🎯 碇源堂 | `nerv-gendo` | 首席戰略顧問 · 用户沟通 · 方案推荐 · 工具发现决策 · 发布授权 | read, memory_search, sessions_send, exec (仅限 nerv-publisher) |
| 🗡️ 葛城美里 | `nerv-misato` | 作戦指揮官 · DAG 路由 · 任务分派 · 状态巡检 | read, write, exec (工具脚本), sessions_send |
| 🔒 SEELE | `nerv-seele` | 安全審計会 · 风控熔断 · 敏感拦截 · 全链路审计 | read, write, exec (仅 security_probe.js + seele_breaker.js) |

### 编排层

| 机体 | 代号 | 职责 | 权限 |
|:-----|:-----|:-----|:-----|
| 🔬 赤木律子 | `nerv-ritsuko` | 代码 Pipeline 编排 · 质量验收 | read, write, exec |
| ⚡ 碇真嗣 | `nerv-shinji` | 数据 Pipeline 编排 · Schema 锚点 | read, write, exec, memory_search |
| 🌙 绫波零 | `nerv-rei` | 记忆守护 · 向量检索 · Skill GC · 损坏文件隔离 | read, write, memory_search |

### 作战层（一次性电池）

| 机体 | 代号 | 职责 | 特殊能力 |
|:-----|:-----|:-----|:---------|
| 🔥 式波明日香 | `nerv-asuka` | 代码调试 · Bug 定位 | exec |
| 🎵 渚薰 | `nerv-kaworu` | 代码审查 · 安全审计 | 三层 Skill 矩阵 (codex/gstack/aider) |
| 🕷️ 真希波 | `nerv-mari` | 爬虫采集 · 平台适配 | exec, 403 退避协议 |
| 📡 二号机 | `nerv-eva02` | 舆情监控 · 趋势预警 | read, write |
| 🔍 三号机 | `nerv-eva03` | **深度搜索 + 工具发现** | exec (gh CLI), 双模式 |
| 🧹 零号机 | `nerv-eva00` | 数据清洗 · 字段白名单 · 完整性评分 | read, write |
| ✍️ 十三号机 | `nerv-eva13` | 文案生成 · 多语言 | read, write |
| 🛠️ 初号机 | `nerv-eva01` | 部署运维 · Docker / 宿主机工具链 | exec, 幂等部署 |
| 🎨 量产机 | `nerv-eva-series` | 视觉生成 · 配图 | read, write, image-gen |

### 神明节点（功能函数，非 Agent）

| 节点 | 实现 | 触发条件 |
|:-----|:-----|:---------|
| 亚当 (Adam) | `adam_notifier.py` 飞书 Webhook | ① 审批推送：SEELE 标记风险 → 推送待审批卡片 ② **任务交付**：DAG 完成 → 推送结果通知。造物主的唯一信使 |
| 莉莉丝 (Lilith) | Cron 脚本 | 每日 03:00 备份 nerv.db |
| 朗基努斯之枪 (Spear) | `spear_sync.js` 状态对齐 | 每 5 分钟扫描孤岛/漏调度/环路/异常节点，负责发现和标记异常 |

---

## 🌐 领域扩张路线 v1

NERV 的下一阶段，不靠继续新增 Agent，也不靠把 prompt 写成百科全书。

我们用三层扩张：

1. **Domain**
   - 先回答“这是哪一类业务”
2. **Skill Pack**
   - 再回答“这类业务常用哪些能力包”
3. **Workflow Template**
   - 最后回答“这类业务该怎么编排成 DAG”

### 一级领域

| 一级 domain | 内部分支 | 说明 |
|:------------|:---------|:-----|
| `general` | - | 通用任务、通用内容、通用协作 |
| `commerce_operations` | `social_media` / `live_commerce` / `ecommerce_ops` | 运营相关需求统一归这里，不拆成三套互不相认的系统 |
| `project_ops` | - | 多项目、资源、纪要、排期、状态流 |
| `finance_info` | - | 财讯、政策、观察名单、信息服务 |

### 五维路由

后续所有需求统一先落到五个槽位：

- `family`
- `domain`
- `source`
- `artifact`
- `risk`

这意味着：

- `Gendo` 先识别业务域，再出结构化草案
- `Misato` 再按路由矩阵做最终 owner 校验
- `compatible_agents` 只回答“谁能用”，不回答“谁最该做”

### 第一波优先级

第一波先做：

- `commerce_operations / social_media`

原因：

- 最贴近真实用户
- 最容易验证“采集 -> 清洗 -> 成稿 -> 通知 -> 记忆”的完整闭环
- 最适合在真实使用和开源复用之间取得平衡

### 角色扩张的原则

- **Gendo**：扩“业务目标翻译”，不扩执行权
- **Misato**：扩“跨 workflow 编排”，不扩内容生产
- **Shinji**：扩“业务数据 lane”，不扩成前线采集工
- **Mari / Eva-02 / Eva-03**：扩前线数据面，但各守边界
- **Eva-00 / Eva-13**：扩加工和成稿，不扩路由
- **Rei**：扩 SOP 和经验资产，不扩主状态职责

一句话：

> 人格少变，Domain 增加，Skill Pack 增加，Workflow Template 增加。

### 已验证 workflow 能力

先看能跑通什么，再看谁负责。NERV 对外真正能讲清楚的，不只是“找谁”，而是“这条 DAG 能做什么、怎么触发、会产出什么”。

| 中文触发 | 命中的 workflow | 核心产物 | 主责角色 |
|:--|:--|:--|:--|
| `帮我把这场直播复盘一下` / `整理下次优化点` | `live-replay-summary` | 复盘总结、问题聚类、下一场优化清单 | `Misato` → `Eva-00` → `Eva-13` → `Rei` |
| `把这场直播的脚本做出来` / `给我一套能直接上播的话术` | `live-session-script` | `offer_pack.json`、`script.md`、`selling_points.md`、`cta.md` | `Misato` → `Eva-00` → `Eva-13` → `Rei` |
| `给微博/小红书/抖音各出一版内容` | `social-copy-studio` | 平台分发文案、视频脚本、口播稿 | `Misato` → `Eva-00` → `Eva-13` → `Rei` |
| `把这批商品评价整理成洞察` / `做一版 SKU 卖点简报` | `product-review-insight` | 卖点洞察、痛点聚类、SKU 简报 | `Misato` → `Eva-00` → `Eva-13` |
| `把这段会议纪要转成任务清单` / `把周会内容拆成 owner 和 deadline` | `meeting-to-task` | 任务清单、owner、deadline、状态摘要 | `Misato` → `Shinji` → `Eva-00`/`Eva-13` |
| `给我做一版今天的财讯简报` / `看一下这只股票最近有什么值得关注` | `finance-brief` | 财讯简报、风险卡片、观察重点 | `Misato` → `Eva-02` → `Eva-00` → `Eva-13` |
| `我想看今天的社媒热点` / `先给我一版内容选题` | `social-topic-daily` | 热点简报、选题推荐、标题建议 | `Eva-02` → `Eva-00` → `Eva-13` → `Misato` |

这些 workflow 不是“会话里说得出来”就算成立，而是已经能在 `nerv.db`、`task_scoped session`、`workflow template` 里对得上。用户真正看见的，是成品和通知，不是中间的术语。

如果你要系统先编排再执行，最好直接加一句：

- `先给我 DAG 草案，再交给 Misato 执行`

如果你已经知道要直接开跑，可以说：

- `按 DAG 方式处理`

当前第一批固定资产位于：

- `skill-packs/commerce_operations/social_media/`
- `workflow-templates/commerce_operations/social_media/`

### 怎么用中文触发这些新能力

用户不需要记内部英文名。真正该说的是中文任务语境，系统再把它翻成对应 workflow。

如果输入里提到了截图、图片、附件，别只说“我发过图了”，最好直接给：

- 文件绝对路径
- 或者图片里的文字内容

否则 DAG 可能能建出来，但会在读取输入时卡住。

更完整的中文触发映射见：

- [`docs/workflow-trigger-phrases-v1.md`](docs/workflow-trigger-phrases-v1.md)

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

## 🎬 真实循环案例

下面这些不是概念演示，而是已经在当前体系里真实跑过、并且反过来修正过架构的案例。

### 1. 直播脚本链路：`live-session-script`

目标：

- 用户手工提供商品清单、卖点、福利、目标人群、直播目标
- 系统生成：
  - `offer_pack.json`
  - `script.md`
  - `selling_points.md`
  - `cta.md`

当前主链：

```
eva00（归一化商品包） → eva13（成稿） → misato（通知） → rei（异步记忆）
```

这条链的价值不在于“自动控制平台”，而在于先把直播业务里最核心、最稳定的一段跑通：

- 输入天然可控
- 不依赖平台采集
- 不依赖浏览器自动化
- 最适合先验证 `manual_input` 模式

这也是 NERV 在 `live_commerce` 的第一条正式路线。

### 2. 晨报链路：`daily-rss-intelligence`

目标：

- 聚合过去 24 小时的 RSS / 已接入信息
- 清洗、去重、排序、翻译
- 生成晨报并推送

典型主链：

```
原始信号 → clean_rank → translate → featured_select → compile + notify
```

这条链已经证明了两件事：

1. **DAG 非常适合信息型任务**
   - 采集、清洗、翻译、汇总天然就是多节点链路

2. **失败不一定是 Cron 失败**
   - 真正的问题可能是模型超时
   - 也可能是某个中间节点卡住
   - 所以用户不能只看“今天有没有推送”，还要看任务终态和节点状态

### 3. 翻译链路：网页抓取 → 翻译 → 写入

目标：

- 抓网页全文和图片
- 翻成中文
- 最终写入知识库或文档系统

真实链路里，已经暴露出两个非常典型的问题：

1. **节点完成 ≠ 整条任务完成**
   - `mari-fetch` 完成，只代表抓取节点完成
   - 不代表翻译和写入已经完成

2. **抓取成功 ≠ 下游一定能消费**
   - 如果上游直接把体积过大的 HTML 交给下游
   - 下游会因为输入不合适而拒绝

这个案例很重要，因为它逼着系统把“通知边界”和“中间 artifact 契约”写清楚，而不是只靠会话感觉往下走。

### 4. 小红书 Smoke：平台能力验证，不等于正式业务能力

这条链的意义不是“系统已经彻底会做小红书运营”，而是：

- 验证浏览器 / MCP 路径是否能跑
- 验证平台风控、验证码、登录态会不会把链路拦住

因此：

- Smoke 成功，只代表能力路径被验证
- 不代表该平台已经升级成正式 `collect` 主链能力

这也是为什么 NERV 需要单独维护**平台能力目录**，而不是把 smoke 成功误判成正式生产能力。

---

## 📣 终态通知与失败收敛原则

这是最近真实运行里最值得记住的一组原则。

### 1. 节点完成通知，不等于任务完成通知

用户真正该看的有两层：

- **节点层**
  - 哪个机体完成了自己那一段
  - 这是进度信号

- **任务层**
  - 整条 DAG 是否真正进入终态
  - 这是交付信号

NERV 的原则应该始终是：

- `NODE_COMPLETED` = 节点回报
- `DAG_COMPLETE` = 整条任务收口
- 用户最终以**任务终态**为准

### 2. 真相源不在聊天窗口，在数据库

真正决定任务是否完成的，不是某句“做完了”，而是：

- `tasks.status`
- `dag_nodes.status`
- `audit_logs`

聊天消息只是观察面，不是真相源。

### 3. 失败要明确落在哪一层

失败不能只说“没跑起来”，而要说明：

- **输入层失败**
  - 缺商品清单、缺信号源、缺关键参数

- **能力层失败**
  - 平台能力是 `gap / partial`
  - 浏览器/MCP 不可达
  - 工具权限不足

- **节点层失败**
  - 上游完成了，但下游没被触发
  - 或下游收到的 artifact 不符合契约

- **模型层失败**
  - LLM 超时
  - 模型不可用

### 4. Misato、Recorder、Spear、Adam 的分工必须清楚

- **Misato**
  - 接单、建图、派发、收尾

- **Recorder**
  - 记录 `NODE_COMPLETED / NODE_FAILED`
  - 把事件写入 `nerv.db`

- **Spear**
  - 巡检孤岛、漏调度、异常节点
  - 负责兜底，不是主业务编排器

- **Adam**
  - 对外通知
  - 是信使，不是 DAG 判断器

### 5. 当前体系的收敛目标

NERV 后续的所有 workflow，都要朝这个方向收敛：

1. **先判断能不能跑**
2. **再建 DAG**
3. **节点终态由标准事件回收**
4. **任务终态由 DB 收敛**
5. **最终由 Adam 统一对外交付**

热血可以保留，判断不能含糊。

---

---

## 対領域 (A.T.Field)

每个 Agent 在运行层面尽量隔离：
- 独立 workspace · 独立 SOUL.md · 独立 session 上下文
- 通信只通过 `sessions_send`，消息即时化
- misato **无状态上下文注入**：不依赖 Session 历史，启动时读取 `MEMORY.md` + 最近 3 天 `memory/` 作为战术简报
- 作战层 Agent 是一次性电池：完成即销毁，不污染上下文
- 系统开启自动 compaction，防止上下文无限增长
- 默认以宿主机执行为主；sandbox / 容器隔离只在运行面确认可用时启用，不做配置层面的虚假承诺

这不是 metaphor，而是 NERV 当前的运行边界模型：**独立上下文 + 任务契约 + DB 真相源**。

---

## 死海文書庫 (Scrolls of the Sea)

NERV 的长期记忆系统：
- rei（绫波零）守护的知识库
- 任务完成后自动沉淀关键信息到 `memory_queue/`
- **物理后置记忆注入**：当 DAG 节点从 FAILED → 重试 → DONE（治愈），`db.js` 自动提取 `{ 原始错误, 重试次数, 修复结果 }` 写入 `memory_queue/healed_*.json`——用系统机制代替 LLM 的主观意愿
- 凌晨 Cron 提纯：去重 → Embedding → 写入向量库
- **无状态执行 + 有状态上下文注入 (SSCI)**：Misato 不依赖 Session 历史，启动时读取 Rei 提纯的 `MEMORY.md` 作为战术简报——兼顾可靠性与上下文感知
- 下次同类任务时，rei 主动注入历史上下文
- 损坏文件隔离：JSON 异常 → `corrupted/` + SECURITY_ALERT（不无限重试）
- Skill GC：`discovered` 类工具 30 天未用自动清理（`native` 类永不自动删除）

---

## 🔧 技术栈

| 组件 | 技术 |
|:-----|:-----|
| Agent 运行时 | OpenClaw Gateway |
| 任务/会话 | `task_scoped session` + `session_recorder.py` |
| Agent 通信 | sessions_send (A2A) |
| 状态存储 | SQLite WAL (nerv.db) · busy_timeout 5000ms |
| DAG 编排 | `Misato` + `tasks / dag_nodes / dag_edges` |
| 工作流资产 | `skill_registry` + `workflow-templates` + 安装后验证 |
| 工具发现 | MARDUK v2（GitHub CLI + Web Search + 安全审查） |
| 物理安全 | seele_breaker.js + adapter_lint.js + schema_validator.py |
| 战情室 | React + Vite · SSE 实时推送 · 六角几何 UI |
| 代码沙箱 | 宿主机执行（默认） · Docker（可选增强） |
| 长期记忆 | LanceDB / Obsidian MCP |
| Skill 路由 | nerv.db → skill_registry（native + discovered 分层）|
| 通知与巡检 | Adam / Spear / healthcheck / launchd |

---

## 参考与致谢

NERV 在公开设计上明确参考了以下开源项目，但不把它们作为直接运行时依赖：

- [agency-agents](https://github.com/msitarzewski/agency-agents)
  - 用于职业角色、交付物结构、交接模板与阶段手册的设计参考
  - 不直接复刻其 agent 架构或整份提示词
- [OpenHarness](https://github.com/HKUDS/OpenHarness)
  - 用于 Agent Harness 的任务、权限、技能发现与安装体验参考
  - 不替代 OpenClaw，也不直接引入其 provider stack、TUI 或 agent loop

更具体的吸收方式和差异说明见：

- [`docs/external-references.md`](./docs/external-references.md)
- [`docs/external-reference-matrix.md`](./docs/external-reference-matrix.md)
- [`docs/openharness-adoption-matrix.md`](./docs/openharness-adoption-matrix.md)

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
