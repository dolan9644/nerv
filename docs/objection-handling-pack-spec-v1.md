# Objection Handling Pack Spec v1

## 目标

`objection-handling-pack` 用来把直播评论、用户异议、拒绝点和客服常见问答收成可复用异议答复库，而不是零散话术。

它服务的第一条正式 workflow 是：

- `live-objection-bank`

## 适用范围

- 直播间评论异议整理
- 客服常见拒绝点归类
- 商品级答复模板沉淀
- 下一场直播异议预判准备

默认不做：

- 实时直播控场
- 平台内自动运营动作
- 违规承诺或绝对化话术

## 输入契约

必填输入：

- `session_meta`
- `objection_source`
- `output_goal`

其中 `objection_source` 至少命中其一：

- `comment_samples`
- `manual_objections`
- `customer_service_notes`
- `replay_objection_notes`

可选输入：

- `product_list`
- `existing_answers`
- `must_include`
- `must_avoid`
- `tone_rules`

## 输出契约

结构化中间层：

- `objection_clusters.json`
- `answer_map.json`

最终交付：

- `qa_bank.md`
- `qa_bank.json`
- 可选 `memory_note.json`

## 节点分工

- `nerv-eva00`
  - 负责异议聚类、优先级、风险标签和商品映射
- `nerv-eva13`
  - 负责把异议聚类写成主播/客服可直接使用的答复库
- `nerv-rei`
  - 负责提纯高复用答复模式和禁用表达

## 验收标准

- `objection_clusters.json` 至少包含：
  - `cluster_tag`
  - `trigger_quote`
  - `target_product`
  - `risk_level`
  - `answer_direction`
- `qa_bank.md` 至少覆盖：
  - 高频异议
  - 推荐答复
  - 不建议使用的话术
  - 适用商品或适用场景
- `qa_bank.json` 必须支持按异议类别检索

## fallback / TOOL_GAP

- 缺少 `session_meta` 或 `output_goal`：
  - `TOOL_GAP`
- 没有任何有效异议输入：
  - `TOOL_GAP`
- 只有情绪化评价，没有明确问题或拒绝点：
  - 允许 `PARTIAL`
  - 但必须明确“仅形成情绪摘要，未形成可复用答复库”
- `objection_clusters.json` 未形成稳定聚类：
  - 不允许直接进入 `qa_bank.md`

## 外部参考

来源吸收：

- `agency-agents`
  - 吸收 `qa / objection handling / handoff note` 结构
- `OpenHarness`
  - 吸收 `terminal state`、`task lifecycle` 和 `acceptance gate` 的底座表达

不直接照搬：

- 原始职业 prompt
- 原始 agent loop
- 原始交互界面和 provider 体系
