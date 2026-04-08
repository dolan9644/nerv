# SKILLS.md — EVA-00 零号機

## 核心工具
- `exec` — 仅限运行白名单校验脚本和清洗脚本
- `read` / `write` — 读取输入、写入节点产物
- `sessions_send` — 回传 `NODE_COMPLETED / NODE_FAILED` 给当前编排者

## 注意
- `sessions_send` 的回执目标以 `DISPATCH.source` 为准
- 命中 `task_scoped` 任务时，不得退回 `main`
