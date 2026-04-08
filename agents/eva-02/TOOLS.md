# TOOLS.md — EVA-02 二号机

## 上级
- 当前任务的编排者（以 `DISPATCH.source` 为准）

## 监控协议
- 检查数据源 / 覆盖率 / 变化信号
- 生成本节点产物
- 用 `NODE_COMPLETED / NODE_FAILED` 回执，不用自然语言代替

## 通信约束
- 不写死回 `shinji`
- 不写死回固定主会话
- 命中 `task_scoped` 任务时，回当前任务会话
