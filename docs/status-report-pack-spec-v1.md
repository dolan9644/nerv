# Status Report Pack Spec v1

## 目标

`status-report-pack` 用来把项目阶段进展、已完成事项、待推进事项和 blocker 收成正式状态周报，而不是零散同步消息。

它服务的第一条正式 workflow 是：

- `status-report`

## 适用范围

- 项目状态周报
- 阶段进展摘要
- blocker / 风险同步
- 对管理层或协作方的执行摘要

默认不做：

- 自动排期决策
- 项目资源自动分配
- 未经确认的 owner 脑补

## 输入契约

必填输入：

- `report_meta`
- `status_source`
- `report_goal`

其中 `status_source` 至少命中其一：

- `manual_status_notes`
- `task_snapshot`
- `meeting_outputs`
- `blocker_notes`

可选输入：

- `participants`
- `report_audience`
- `must_include`
- `must_avoid`
- `existing_commitments`

## 输出契约

结构化中间层：

- `status_snapshot.json`
- `blockers.json`

最终交付：

- `weekly_report.md`
- `summary_card.md`
- 可选 `memory_note.json`

## 节点分工

- `nerv-eva00`
  - 负责进展、未完成项、风险和 blocker 结构化
- `nerv-eva13`
  - 负责把结构化输入写成正式周报和摘要卡
- `nerv-misato`
  - 负责通知和最终交付
- `nerv-rei`
  - 负责沉淀通用状态表达模式和 blocker 分类

## 验收标准

- `status_snapshot.json` 至少包含：
  - `done_items`
  - `in_progress_items`
  - `next_steps`
  - `owner_gaps`
- `blockers.json` 至少包含：
  - `blocker`
  - `impact`
  - `needed_action`
- `weekly_report.md` 至少覆盖：
  - 本周完成
  - 当前推进中
  - 风险 / blocker
  - 下一步安排

## fallback / TOOL_GAP

- 缺少 `report_meta` 或 `report_goal`：
  - `TOOL_GAP`
- 没有任何有效状态输入：
  - `TOOL_GAP`
- owner 无法判断：
  - 允许标记 `owner = pending_assignment`
  - 不能硬猜具体负责人
- 只有情绪化描述，没有进展事实：
  - 允许 `PARTIAL`
  - 但必须明确“仅形成状态摘要，未形成可发送周报”

## 外部参考

来源吸收：

- `agency-agents`
  - 吸收 `status report / executive summary / handoff` 结构
- `OpenHarness`
  - 吸收 `acceptance suite`、`terminal state` 和 `install validation` 的底座要求
