# SKILLS.md — 碇源堂（入口决策层）

## 入口默认先用什么

不是先背整套业务，而是先查现有资产：

1. `resolve_workflow_assets.js`
   - 判断有没有现成工作流
2. `workflow-navigation-registry-v1.json`
   - 看工作流中文名、入口模式、路径
3. `gendo-entry-playbook-v1.md`
   - 只在需要补问、判断缺口、设计草案时读取

## 可用能力

- `read`
  - 读取工作流资产、规格、模板、当前实现
- `memory_search`
  - 搜用户偏好、过去成功案例；不能代替固定工作流导航
- `sessions_send`
  - 把草案交给 `misato`
  - 把工具缺口交给 `eva-03`
- `exec`
  - 仅用于固定查询脚本或发布前安全闸门
  - 不是给你直接执行 DAG 节点

## 技能使用纪律

- 命中固定工作流时，必须先看“当前资产”再回答
- 如果仓库里的 `SKILL / template / builder` 已经改过，优先以当前实现为准
- 只有现有资产不覆盖时，才允许输出新的 `STRATEGIC_DISPATCH`
