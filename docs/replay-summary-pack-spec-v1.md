# Replay Summary Pack Spec v1

## 目标

`replay-summary-pack` 用来把一场直播后的评论、复盘笔记、问题点和有效动作收成可执行复盘，而不是泛泛而谈的总结。

它服务的第一条正式 workflow 是：

- `live-replay-summary`

## 适用范围

- 单场直播复盘
- 评论/反馈整理
- 话术有效动作归纳
- 下一场优化清单生成

默认不做：

- 平台内自动采集控制
- 实时直播间调度
- 交易或投流决策建议

## 输入契约

必填输入：

- `session_meta`
- `replay_source`
- `review_goal`

其中 `replay_source` 至少命中其一：

- `manual_notes`
- `feedback_items`
- `comment_summary`

可选输入：

- `public_replay_url`
- `raw_comments`
- `conversion_notes`
- `operator_notes`
- `must_include`
- `must_avoid`

## 输出契约

结构化中间层：

- `clustered.json`
- `issues.md`
- `next_round_actions.md`

最终交付：

- `replay_summary.md`
- 可选 `memory_note.json`

## 节点分工

- `nerv-eva02`
  - 只负责已接入反馈/评论信号的监控补充
- `nerv-mari`
  - 只在公开回放/公开评论可访问时做补采
- `nerv-eva00`
  - 负责聚类问题、有效动作、价格节奏、异议点
- `nerv-eva13`
  - 负责把聚类结果收成正式复盘稿
- `nerv-rei`
  - 负责把可复用模式写回记忆

## 验收标准

- `clustered.json` 至少包含：
  - `issues`
  - `effective_moves`
  - `objections`
  - `next_round_actions`
- `replay_summary.md` 至少覆盖：
  - 本场目标
  - 主要问题
  - 有效动作
  - 需要修正的节奏/话术
  - 下一场建议
- 如果输入只有零散情绪，不足以支撑复盘：
  - 直接 `TOOL_GAP`
  - 不允许硬写成“看起来很完整”的复盘

## fallback / TOOL_GAP

- 缺少 `session_meta` 或 `review_goal`：
  - `TOOL_GAP`
- 没有任何可用反馈源：
  - `TOOL_GAP`
- 公开回放不可达：
  - 允许只基于手工复盘继续
  - `fallback_reason = replay_inputs_manual_only`
- `clustered.json` 没有形成明确问题和动作分类：
  - 不允许直接进入 `replay_summary.md`

## 外部参考

来源吸收：

- `agency-agents`
  - 吸收 `review / retrospective / action-items` 结构
- `OpenHarness`
  - 吸收 `background task lifecycle` 和 `terminal state` 的任务收敛方式

不直接照搬：

- 原始职业 prompt
- 原始 agent loop
- 原始 TUI / provider 体系
