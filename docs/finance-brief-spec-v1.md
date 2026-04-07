# Finance Brief Spec v1

## 目标

`finance-brief` 用来把财讯、政策、观察名单变化收成一份清晰的信息服务简报，不提供交易建议。

它是 `finance_info` 的第一条正式工作流。

## 适用范围

- 财讯简报
- 政策变化摘要
- 观察名单变化提醒
- 主题/板块事件卡片

## 输入契约

必填输入：

- `brief_scope`
- `signal_source`
- `output_goal`

`signal_source` 至少命中其一：

- `rss_items`
- `manual_news_items`
- `watchlist_changes`
- `manual_company_facts`
- `manual_watch_notes`

可选输入：

- `time_window`
- `audience_profile`
- `must_include`
- `must_avoid`
- `compliance_notes`

### 速度优先规则

如果用户已经提供了较完整的手工事实，例如：

- 股票代码 / 公司名
- 时间窗
- 若干关键公告、财务数字、调研要点

那么默认优先走 `manual_facts_first` 的轻量路径：

- 允许直接基于 `manual_news_items / manual_company_facts / manual_watch_notes` 进入整理与成稿
- 外部补证据不是必选项
- 只有用户明确要求“再补背景 / 再补市场证据 / 再补观察名单变化”时，才升级为较慢的信号补充路径

## 输出契约

结构化中间层：

- `watch.json`
- `ranked.json`

最终交付：

- `finance_brief.md`
- `risk_cards.md`

## 节点分工

- `nerv-eva02`
  - 负责信号监控和变化发现
- `nerv-eva03`
  - 负责必要补证据
- `nerv-eva00`
  - 负责去重、排序、分类
- `nerv-eva13`
  - 负责简报成稿和风险卡片
- `nerv-misato`
  - 负责最终通知

## 验收标准

- `watch.json` 必须保留来源、时间、标题/摘要
- `finance_brief.md` 必须覆盖：
  - 重要变化
  - 为什么值得关注
  - 可能影响什么
  - 哪些仍需观察
- 语言必须保持信息服务口径：
  - 不给买卖建议
  - 不做价格预测

## fallback / TOOL_GAP

- 缺少 `brief_scope` 或 `output_goal`：
  - `TOOL_GAP`
- 没有任何有效信号输入：
  - `TOOL_GAP`
- 无法补证据：
  - 允许只输出信号摘要
  - `fallback_reason = evidence_optional_signal_only`
- 用户已给足手工事实：
  - 不应因为“还能再搜”就强制走长采集路径
  - `fallback_reason = manual_facts_first`

## 外部参考

来源吸收：

- `agency-agents`
  - 吸收 `executive summary / analytics summary` 结构
- `OpenHarness`
  - 吸收 `task lifecycle / validation / terminal notification` 约束
