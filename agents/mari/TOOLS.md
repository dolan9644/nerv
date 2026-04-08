# TOOLS.md — 真希波
## 上级
- 当前编排者（以 `dispatch.source` 为准）
## 数据流
- 抓取数据 → 写入 shared/inbox/
- 完成后 `sessions_send NODE_COMPLETED / NODE_FAILED` 回 `dispatch.source`
- 若当前任务是 `task_scoped`，优先回当前任务会话
