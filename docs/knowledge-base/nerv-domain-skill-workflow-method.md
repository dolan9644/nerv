# NERV 业务域扩张与 Skill/Workflow 方法论

## Idea
NERV 扩张业务域，不靠新增 Agent，而靠 `domain + skill pack + workflow template` 三层收敛。

## 核心逻辑
- 角色层只固定边界：
  - `Gendo`：需求翻译与草案
  - `Misato`：建图、派发、收口
  - `Shinji`：数据 lane
  - `Eva00 / Eva13 / Mari / Eva03 / Rei`：终端执行
- 行业能力优先落到：
  - `skill pack`
  - `workflow template`
- SOUL 只保留：
  - 角色边界
  - 成功标准
  - 风险偏好

## 结构
- 一级域：
  - `commerce_operations`
  - `project_ops`
  - `finance_info`
- 当前优先顺序：
  1. `social_media`
  2. `live_commerce`
  3. `ecommerce_ops`

## 关键模式
```text
domain: commerce_operations
subdomain: social_media
owner: nerv-mari
downstream: nerv-eva00 -> nerv-eva13 -> nerv-misato
fallback: TOOL_GAP
```

## 已验证原则
- `compatible_agents` 只能回答“谁能用”，不能决定“谁最该做”。
- 新能力先过 Reliability Gate，再进正式主链。
- 先做模板化工作流，再谈大规模自动化。
