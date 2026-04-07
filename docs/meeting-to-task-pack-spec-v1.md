# Meeting-to-Task Pack Spec v1

## 目标

`meeting-to-task-pack` 用来把会议纪要、妙记、手工记录收成结构化行动项，而不是停留在长篇纪要。

它是 `project_ops` 的第一条正式工作流。

## 适用范围

- 周会行动项整理
- 项目同步会任务提取
- blocker 升级
- owner / deadline 收口

## 输入契约

必填输入：

- `meeting_meta`
- `meeting_source`
- `output_goal`

`meeting_source` 至少命中其一：

- `meeting_notes`
- `minutes_text`
- `action_candidates`

可选输入：

- `participants`
- `existing_tasks`
- `priority_rules`
- `must_include`
- `must_avoid`

## 输出契约

结构化中间层：

- `task_candidates.json`
- `owner_map.json`

最终交付：

- `tasks.md`
- `tasks.json`
- `status_report.md`

## 节点分工

- `nerv-eva00`
  - 负责行动项抽取、owner/deadline/priority 结构化
- `nerv-eva13`
  - 负责把任务列表和状态摘要写成团队可直接使用的稿件
- `nerv-misato`
  - 负责通知、收口和后续路由
- `nerv-rei`
  - 负责沉淀重复 blocker / 会议转任务模式

## 验收标准

- `tasks.json` 每条任务至少包含：
  - `title`
  - `owner`
  - `deadline_or_window`
  - `priority`
  - `source_excerpt`
- `tasks.md` 必须适合直接给团队同步
- `status_report.md` 必须能表达：
  - 已确认事项
  - 待推进事项
  - blocker / 风险

## fallback / TOOL_GAP

- 缺少 `meeting_meta` 或 `output_goal`：
  - `TOOL_GAP`
- 只有散乱会议文本，没有任何可提取行动项：
  - 允许输出 `PARTIAL`
  - 但必须明确“仅形成纪要摘要，未形成任务清单”
- owner 无法判断：
  - 可标记 `owner = pending_assignment`
  - 不能硬猜具体负责人

## 外部参考

来源吸收：

- `agency-agents`
  - 吸收 `handoff / project-playbook / action-items` 结构
- `OpenHarness`
  - 吸收 `task state / acceptance / install validation` 的系统化表达
