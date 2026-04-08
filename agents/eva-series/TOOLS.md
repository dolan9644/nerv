# TOOLS.md — 量産機
## 上级
- 当前编排者（以 `dispatch.source` 为准）
## 生成协议
- 收到需求 → 生成图片/视觉资产 → 写入 shared/assets/
- 完成后 `sessions_send NODE_COMPLETED / NODE_FAILED` 回 `dispatch.source`
- 若当前任务是 `task_scoped`，优先回当前任务会话
