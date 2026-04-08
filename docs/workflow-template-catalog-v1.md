# NERV Workflow Template Catalog v1

## 目标

`Workflow Template Catalog v1` 用来把高频业务需求沉成标准 DAG 模板。

模板的作用不是替代 `Gendo` 和 `Misato`，而是给它们一个稳定的骨架：

- `Gendo` 参考模板输出更稳定的草案
- `Misato` 参考模板减少错路由和错 owner
- Recorder / Spear / Memory 能更稳定地接住整条链

## 模板约束（强制）

每个 workflow template 至少要定义：

- 适用 `domain`
- 适用场景
- 节点顺序
- `canonical owner`
- `platform_requirements`（如涉及平台）
- `optional_nodes`
- `capability_gate`
- 输入 artifact
- 输出 artifact
- fallback 规则
- Adam Notifier 的最终交付方式
- Memory 写入条件

所有模板默认约束：

- 使用标准 `task_id`
- 通过 `docs/reliability-model-v1.md` 的 Reliability Gate 后才允许进入正式主链
- 产物优先写入 task-scoped `output_dir`
- 节点派发统一 `sessions_send(timeoutSeconds=0)`
- 最终状态以 `NODE_COMPLETED / NODE_FAILED + Recorder` 为准
- 对 `commerce_operations / social_media`，模板实例化前先查 `docs/platform-capability-catalog-v1.md`

## v1 运行面说明

当前第一批正式模板里，`shinji` 仍主要是**路由与数据 lane 的文档角色**，不是每条 workflow 都会把它实例化成显式 DAG 节点。

这意味着：

- 文档里出现 `misato -> shinji -> ...`
  - 更偏向职责链说明
- 真实运行中是否能看到 `nerv-shinji`
  - 取决于模板是否真的把它建成节点
- 在没有显式节点和 task-scoped 证据前，不要把 `shinji` 当成“本轮已经验证过的 task-scoped worker”

---

## 第一波：`commerce_operations / social_media`

### 模板 0：社媒内容工厂流

**适用场景**

- 微博文案
- 小红书文案
- 抖音标题/配文
- 短视频脚本
- 口播稿 / 旁白稿

**推荐执行模式**

- 默认：`manual_brief`

说明：

- 这是 `social_media` 当前最核心的交付线
- 它不依赖平台采集，不要求先跑监控
- 先解决内容生产，再补运营与采集

**拓扑**

```text
misato
  -> shinji
      -> eva00 (normalize-brief)
      -> eva13 (compose-copy)
  -> misato (notify)
  -> rei (memory, 异步后置)
```

**节点**

| node_id | family | canonical owner | 输入 | 输出 |
|:--------|:-------|:----------------|:-----|:-----|
| `normalize-brief` | `normalize` | `nerv-eva00` | 手工 brief / 话题 / 商品 / 风格约束 | `copy_brief.json` |
| `compose-copy` | `compose` | `nerv-eva13` | `copy_brief.json` | `post_copy.md` / `title_options.md` / `video_script.md` / `voiceover_script.md` |
| `notify-copy` | `notify` | `nerv-misato` | 成稿内容包 | `sent.json` |
| `memory-copy-pattern` | `memory` | `nerv-rei` | 成稿内容包 / `copy_brief.json` | `memory_note.json` |

**fallback**

- 缺少核心 brief：
  - 直接 `TOOL_GAP`
  - 不允许 `eva13` 猜用户要什么
- `compose-copy` 不可达：
  - 本 workflow 直接失败
  - 不允许其他节点代写终稿

**Memory 写入条件**

- `notify-copy` 成功
- 至少产出一份可复用的成稿
- `rei` 提纯为 `platform-tone-pattern` / `hook-pattern` / `cta-pattern`

### 模板 1：选题日报流

**适用场景**

- 每日选题池
- 平台热点整理
- KOL/竞品账号观察后的日报

**推荐执行模式**

- 默认：`signal_only`
- 可升级：`signal_plus_collect`

说明：

- `signal_only` 用于 RSS / 已接入信号 + 可选补证据
- `signal_plus_collect` 只在平台 `collect` 能力真实满足时启用
- 不允许把浏览器/MCP smoke 验证误当成长期稳定的 topic-daily collect 能力

**拓扑**

```text
misato
  -> shinji
      -> eva02 (monitor / rss-watch)
      -> eva03 (search evidence, 可选)
      -> mari (collect, 可选)
      -> eva00 (normalize/rank)
      -> eva13 (compose)
  -> misato (notify)
  -> rei (memory, 异步后置)
```

**节点**

| node_id | family | canonical owner | 输入 | 输出 |
|:--------|:-------|:----------------|:-----|:-----|
| `monitor-social` | `monitor` | `nerv-eva02` | RSS / 已接入信号的关键词/账号/时间窗 | `monitor.json` |
| `supplement-search` | `search` | `nerv-eva03` | `monitor.json` | `evidence.json` |
| `collect-posts` | `collect` | `nerv-mari` | 平台公开页目标 | `raw.json` |
| `rank-topics` | `normalize` | `nerv-eva00` | `monitor.json/raw.json/evidence.json` | `ranked.json` |
| `compose-brief` | `compose` | `nerv-eva13` | `ranked.json` | `topic_brief.md` |
| `notify-brief` | `notify` | `nerv-misato` | `topic_brief.md` | `sent.json` |

**fallback**

- `nerv-mari` 不可达：
  - 仅保留 `eva02` 监控结果继续跑
  - 记录 `fallback_reason = collect_skipped_monitor_only`
- `nerv-eva02` 只产出 RSS/已接入信号结果：
  - 如需浏览器 / exec / 搜索引擎补证据，实例化 `supplement-search` 到 `nerv-eva03`
  - 若平台需要官方/Clawhub 已验证 MCP / adapter，而当前没有可用能力：
    - 记录 `fallback_reason = capability_gap_needs_adapter`
    - 不强派 `nerv-eva02` 执行搜索

**Memory 写入条件**

- `notify-brief` 成功
- 选题日报含至少 3 条有效题材
- `rei` 提纯为 `topic-pattern` / `headline-pattern` / `audience-note`

---

### 模板 1a：小红书 smoke / 最小可跑通 DAG

**适用场景**

- 验证小红书采集能力是否真的可用
- 作为 `commerce_operations / social_media` 的最小可跑通样例
- 以浏览器 / Chromium / Playwright MCP 为主的公开采集 smoke test

**拓扑**

```text
misato
  -> shinji
      -> mari (collect-xhs)
      -> eva00 (normalize/rank)
      -> eva13 (compose-brief)
  -> misato (notify)
```

**节点**

| node_id | family | canonical owner | 输入 | 输出 |
|:--------|:-------|:----------------|:-----|:-----|
| `collect-xhs` | `collect` | `nerv-mari` | 小红书关键词/账号/时间窗 | `raw.json` |
| `rank-xhs` | `normalize` | `nerv-eva00` | `raw.json` | `ranked.json` |
| `compose-xhs-brief` | `compose` | `nerv-eva13` | `ranked.json` | `xhs_brief.md` |
| `notify-xhs-brief` | `notify` | `nerv-misato` | `xhs_brief.md` | `sent.json` |

**平台要求**

- 目标平台只允许小红书
- 平台能力目录必须允许 `partial` 路径
- `browser_mcp` / `xiaohongshu-mcp` / Chromium MCP 至少命中其一
- 若当前运行面没有已批准的浏览器能力，直接 `TOOL_GAP`
- 若能力可启动但页面命中验证码、风险提示或登录态失效，视为当前环境下不可执行

**fallback**

- `collect-xhs` 不可达：
  - 直接失败，不做空跑
  - 记录 `fallback_reason = xhs_collect_requires_browser_mcp_login_and_non_blocked_page`
- `collect-xhs` 命中验证码 / 风控页：
  - 返回 `NODE_FAILED`
  - error 需明确写 `CAPTCHA_BLOCKED` / `IP_RISK_BLOCKED` / `LOGIN_REQUIRED`
- `rank-xhs` 无有效原始数据：
  - 不允许直接跳到成稿
- `compose-xhs-brief` 不可达：
  - 本 workflow 直接失败，不让其他 Agent 代写成稿

**Memory 写入条件**

- `notify-xhs-brief` 成功
- 至少有 3 条有效笔记记录进入 `ranked.json`
- `rei` 可选异步沉淀为 `topic-pattern` / `platform-note`

---

### 模板 2：热点追踪流

**适用场景**

- 指定主题/品牌/账号持续观察
- 突发热点提醒
- 风险和机会摘要

**拓扑**

```text
misato
  -> shinji
      -> eva02 (watch)
      -> eva03 (evidence, 可选)
      -> eva13 (summary)
  -> misato (notify)
  -> rei (memory, 异步后置)
```

**节点**

| node_id | family | canonical owner | 输入 | 输出 |
|:--------|:-------|:----------------|:-----|:-----|
| `watch-topic` | `monitor` | `nerv-eva02` | 主题/账号/观察名单 | `watch.json` |
| `supplement-evidence` | `search` | `nerv-eva03` | `watch.json` | `evidence.json` |
| `compose-alert` | `compose` | `nerv-eva13` | `watch.json/evidence.json` | `alert.md` |
| `notify-alert` | `notify` | `nerv-misato` | `alert.md` | `sent.json` |

**fallback**

- `eva03` 不可达：
  - 允许只根据监控结果继续成稿
  - 记录 `fallback_reason = evidence_optional_path`

**Memory 写入条件**

- 出现高优先级变化
- 或一次成功提醒后触发复盘沉淀

---

### 模板 3：爆文拆解流

**适用场景**

- 复盘某篇爆文/热视频/高互动内容
- 提炼结构、标题、开头、节奏

**拓扑**

```text
misato
  -> shinji
      -> mari (collect)
      -> eva03 (evidence, 可选)
      -> eva00 (normalize)
      -> eva13 (compose pattern)
  -> rei (memory)
```

**节点**

| node_id | family | canonical owner | 输入 | 输出 |
|:--------|:-------|:----------------|:-----|:-----|
| `collect-reference` | `collect` | `nerv-mari` | 内容链接/账号 | `raw.json` |
| `supplement-context` | `search` | `nerv-eva03` | 原始内容 | `evidence.json` |
| `extract-structure` | `normalize` | `nerv-eva00` | `raw.json/evidence.json` | `patterns.json` |
| `compose-breakdown` | `compose` | `nerv-eva13` | `patterns.json` | `breakdown.md` |

**Memory 写入条件**

- 输出被判定为可复用模板
- `rei` 沉淀为 `headline-pattern` / `opening-pattern` / `rhythm-pattern`

---

## 第二波：`commerce_operations / live_commerce`

### 模板 4：直播脚本生成流

**适用场景**

- 新品直播前准备
- 单场直播脚本生成
- 商品讲解顺序梳理
- 开场、转场、收尾话术整理

**推荐执行模式**

- 默认：`manual_input`
- 可升级：`manual_input_plus_feedback`

说明：

- `manual_input` 只依赖用户给出的商品、福利、目标、人群信息
- `manual_input_plus_feedback` 允许在输入中增加过往评论、异议、复盘笔记
- 第一条正式 `live_commerce` workflow 默认只做 `manual_input`
- 输入/输出规格统一以 [live-script-pack-spec-v1.md](/Users/dolan/.openclaw/nerv/docs/live-script-pack-spec-v1.md) 为准

**拓扑**

```text
gendo
  -> misato
      -> shinji
          -> eva00 (normalize-offer)
          -> eva13 (compose-script)
  -> misato (notify)
  -> rei (memory, 异步后置)
```

**节点**

| node_id | family | canonical owner | 输入 | 输出 |
|:--------|:-------|:----------------|:-----|:-----|
| `normalize-offer` | `normalize` | `nerv-eva00` | `session_meta`、`product_list`、`promotion_and_benefits`、`live_goal`、`target_audience` | `offer_pack.json` |
| `compose-script` | `compose` | `nerv-eva13` | `offer_pack.json` | `script.md` / `selling_points.md` / `cta.md` |
| `notify-script` | `notify` | `nerv-misato` | `script.md` / `selling_points.md` / `cta.md` | `sent.json` |
| `memory-script-pattern` | `memory` | `nerv-rei` | `script.md` / `offer_pack.json` | `memory_note.json` |

**fallback**

- `normalize-offer` 缺少关键商品输入：
  - 直接 `TOOL_GAP`
  - 记录 `fallback_reason = missing_offer_inputs`
- `normalize-offer` 只输出抽象槽位、缺少真实商品卡：
  - 视为不合格中间层
  - 不允许直接进入成稿
- `compose-script` 不可达：
  - 本 workflow 失败
  - 不允许让其他节点临时代写完整脚本

**Memory 写入条件**

- `notify-script` 成功
- `script.md` 包含至少完整的开场、逐商品讲解段、互动段、价格提醒、收尾 CTA
- `selling_points.md` 可直接给运营复核
- `cta.md` 可直接给主播贴片使用
- `rei` 提纯为 `live-script-pattern` / `selling-angle` / `cta-pattern`

### 模板 5：直播复盘流

**适用场景**

- 单场直播结束后的复盘
- 评论/节奏/转化问题整理
- 优化下一场直播脚本与答复策略

**拓扑**

```text
misato
  -> shinji
      -> eva02 (watch comments/signals, 可选)
      -> mari (collect replay/public comments, 可选)
      -> eva00 (cluster-issues)
      -> eva13 (compose-replay-summary)
  -> rei (memory)
```

**节点**

| node_id | family | canonical owner | 输入 | 输出 |
|:--------|:-------|:----------------|:-----|:-----|
| `watch-feedback` | `monitor` | `nerv-eva02` | 评论/反馈/信号 | `feedback.json` |
| `collect-replay` | `collect` | `nerv-mari` | 回放页/公开评论 | `raw.json` |
| `cluster-issues` | `normalize` | `nerv-eva00` | `feedback.json/raw.json` | `clustered.json` |
| `compose-replay-summary` | `compose` | `nerv-eva13` | `clustered.json` | `replay_summary.md` |
| `memory-replay-pattern` | `memory` | `nerv-rei` | `replay_summary.md` | `memory_note.json` |

**fallback**

- `watch-feedback` / `collect-replay` 不可达：
  - 允许只基于手工提供的复盘笔记继续
  - 记录 `fallback_reason = replay_inputs_manual_only`
- `cluster-issues` 无有效反馈数据：
  - 不允许直接产出正式复盘

**Memory 写入条件**

- `replay_summary.md` 成功生成
- 至少提炼出 `问题 / 有效动作 / 改进项` 三类结论

**核心交付**

- `replay_summary.md`
- `issues.md`
- `next_round_actions.md`

### 模板 6：异议答复库更新流

```text
misato -> shinji -> eva00 -> eva13 -> rei
```

**核心交付**

- `qa_bank.json`
- `qa_bank.md`

**适用场景**

- 直播高频异议整理
- 客服常见问答更新
- 下一场直播异议预判准备

**节点**

| node_id | family | canonical owner | 输入 | 输出 |
|:--------|:-------|:----------------|:-----|:-----|
| `cluster-objections` | `normalize` | `nerv-eva00` | `manual_input.json` | `objection_clusters.json` / `answer_map.json` |
| `compose-qa-bank` | `compose` | `nerv-eva13` | `objection_clusters.json` / `answer_map.json` | `qa_bank.md` / `qa_bank.json` |
| `notify-qa-bank` | `notify` | `nerv-misato` | `qa_bank.md` / `qa_bank.json` | `sent.json` |
| `memory-objection-pattern` | `memory` | `nerv-rei` | `qa_bank.md` / `qa_bank.json` | `memory_note.json` |

**fallback**

- 没有有效异议输入：
  - `TOOL_GAP`
- 只有情绪化评价，没有明确异议：
  - 允许 `PARTIAL`
  - 但必须明确未形成正式答复库

---

## 第三波：`commerce_operations / ecommerce_ops`

### 模板 7：商品评价洞察流

**适用场景**

- 商品评价样本洞察
- SKU 卖点整理
- 上新前的用户反馈归纳

**拓扑**

```text
misato
  -> shinji
      -> mari (collect-reviews, 可选)
      -> eva00 (cluster-reviews)
      -> eva13 (compose-review-insight)
  -> misato (notify)
  -> rei (memory, 异步后置)
```

**节点**

| node_id | family | canonical owner | 输入 | 输出 |
|:--------|:-------|:----------------|:-----|:-----|
| `collect-reviews` | `collect` | `nerv-mari` | 公开评价页 / 手工评价源 | `raw.json` |
| `cluster-reviews` | `normalize` | `nerv-eva00` | `manual_input.json/raw.json` | `clustered.json` / `selling_points.json` / `painpoints.json` |
| `compose-review-insight` | `compose` | `nerv-eva13` | `clustered.json` / `selling_points.json` / `painpoints.json` | `review_insight.md` / `sku_brief.md` |
| `notify-review-insight` | `notify` | `nerv-misato` | `review_insight.md` / `sku_brief.md` | `sent.json` |

**核心交付**

- `review_insight.md`
- `painpoints.json`
- `selling_points.json`

**fallback**

- 没有有效评价输入：
  - `TOOL_GAP`
- 公开评价不可达：
  - 允许只基于手工评价样本继续
  - `fallback_reason = review_inputs_manual_only`

### 模板 8：竞品卖点跟踪流

```text
misato -> shinji -> eva02/mari -> eva00 -> eva13 -> misato
```

**核心交付**

- `competitor_watch.md`
- `delta.json`

**适用场景**

- 竞品卖点变化跟踪
- 活动/价格带差异观察
- 竞品评价风向整理

**节点**

| node_id | family | canonical owner | 输入 | 输出 |
|:--------|:-------|:----------------|:-----|:-----|
| `watch-competitor-signals` | `monitor` | `nerv-eva02` | `manual_input.json` | `watch.json` |
| `collect-competitor-pages` | `collect` | `nerv-mari` | `manual_input.json` | `raw.json` |
| `normalize-competitor-delta` | `normalize` | `nerv-eva00` | `manual_input.json` / `watch.json` / `raw.json` | `delta.json` |
| `compose-competitor-watch` | `compose` | `nerv-eva13` | `delta.json` | `competitor_watch.md` |
| `notify-competitor-watch` | `notify` | `nerv-misato` | `competitor_watch.md` / `delta.json` | `sent.json` |

**fallback**

- 没有有效竞品输入：
  - `TOOL_GAP`
- 公开竞品页不可达：
  - 允许只基于手工记录继续
  - `fallback_reason = competitor_inputs_manual_only`

### 模板 9：新品上新简报流

```text
misato -> shinji -> mari -> eva00 -> eva13 -> misato
```

**核心交付**

- `launch_brief.md`
- `sku_brief.md`

---

## 第二梯队模板

### `project_ops`

#### 模板 10：会议转任务流

**适用场景**

- 周会纪要转任务
- 会议行动项落地
- blocker 收口与 owner 确认

**拓扑**

```text
misato
  -> shinji
      -> eva00 (normalize-meeting-tasks)
      -> eva13 (compose-task-report)
  -> misato (notify)
  -> rei (memory, 异步后置)
```

**核心交付**

- `tasks.md`
- `tasks.json`
- `status_report.md`

**fallback**

- 缺少会议元信息或输出目标：
  - `TOOL_GAP`
- 无法判断 owner：
  - 允许 `owner = pending_assignment`
  - 不允许硬猜负责人

- 多项目优先级流
- blocker 升级流

#### 模板 11：状态周报流

**适用场景**

- 项目状态周报
- 阶段进展同步
- blocker / 风险卡片

**拓扑**

```text
misato
  -> shinji
      -> eva00 (normalize-status)
      -> eva13 (compose-status-report)
  -> misato (notify)
  -> rei (memory, 异步后置)
```

**节点**

| node_id | family | canonical owner | 输入 | 输出 |
|:--------|:-------|:----------------|:-----|:-----|
| `normalize-status` | `normalize` | `nerv-eva00` | `manual_input.json` | `status_snapshot.json` / `blockers.json` |
| `compose-status-report` | `compose` | `nerv-eva13` | `status_snapshot.json` / `blockers.json` | `weekly_report.md` / `summary_card.md` |
| `notify-status-report` | `notify` | `nerv-misato` | `weekly_report.md` / `summary_card.md` | `sent.json` |
| `memory-status-pattern` | `memory` | `nerv-rei` | `weekly_report.md` / `blockers.json` | `memory_note.json` |

**fallback**

- 缺少核心状态输入：
  - `TOOL_GAP`
- 只有情绪化描述，没有进展事实：
  - 允许 `PARTIAL`
  - 但必须明确只形成状态摘要

### `finance_info`

#### 模板 12：财讯简报流

**适用场景**

- 财讯摘要
- 政策变化提醒
- 观察名单变化总结

**拓扑**

```text
misato
  -> shinji
      -> eva02 (watch-market-signals)
      -> eva03 (supplement-finance-evidence, 可选)
      -> eva00 (rank-finance-signals)
      -> eva13 (compose-finance-brief)
  -> misato (notify)
```

**核心交付**

- `finance_brief.md`
- `risk_cards.md`

**fallback**

- 没有任何有效信号：
  - `TOOL_GAP`
- 无法补证据：
  - 允许只输出信号摘要
  - `fallback_reason = evidence_optional_signal_only`

- 政策变化提醒流
- 观察名单摘要流

这些模板当前只保留 catalog 级定义，不先做深度细化。

---

## 第一轮验收模板

第一轮正式验收优先选：

1. `live-session-script`
2. `live-replay-summary`
3. `product-review-insight`
4. `meeting-to-task`
5. `finance-brief`

理由：

- 覆盖 `commerce_operations / project_ops / finance_info`
- 能同步验证 task-scoped DAG、终态通知与失败收敛
- 能为下一轮多域并行扩张提供标准样例

## 模板进入正式系统的标准

一条 workflow 只有满足以下条件，才算正式进入系统：

1. 跑过真实 task
2. 产物能直接给用户
3. Recorder / Spear / Adam Notifier 都能接住
4. Rei 能提纯出至少一条有效记忆
5. 下一次同类任务能复用该模板而不是重新从零设计
