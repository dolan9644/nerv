# NERV Multi-Agent 编排逻辑

## 1. 核心目标
- 把晨报、翻译、脚本生成、监控等任务拆成可并行、可追踪、可回放的多 Agent DAG。
- 以 `Misato` 做总调度，`EVA` 系列做执行层，`SOUL.md` 只定义角色边界，`skills/` 只定义工具能力。
- 目标不是单轮回答，而是形成稳定可重复的任务流水线。

## 2. 核心架构设计
- 触发层：`cron/jobs.json` 或用户入口触发。
- 编排层：`nerv-gendo` 产草案，`nerv-misato` 建图并派发。
- 执行层：节点按 canonical owner 落到对应 Agent。
  - `nerv-eva02`：监控 / coverage
  - `nerv-eva00`：清洗 / 排序 / 结构化
  - `nerv-eva13`：翻译 / 成稿 / 摘要
  - `nerv-mari`：采集
  - `nerv-rei`：异步记忆沉淀
- 状态层：`nerv.db` 记录 `tasks / dag_nodes / dag_edges / audit_logs / task_session_bindings`。
- 产物层：`raw.json / monitor.json / ranked.json / script.md / summary.md / sent.json`。

```json
{
  "task_id": "social-topic-daily-20260407",
  "dag": ["monitor-social", "rank-topics", "compose-brief", "notify-brief", "memory-note"],
  "orchestrator": "nerv-misato"
}
```

## 3. 关键坑与约束
- `compatible_agents` 只是能力过滤器，不是最终 owner。
- `sessionKey` 只是执行容器，不是任务真相源。
- 不能把节点完成通知成整任务完成。
- 不能让 README、SOUL、workflow template 各写一套 owner 逻辑。
- 不能依赖 memory 或旧聊天记录恢复任务。

## 4. 已验证模式
- `social_media` 已形成 `signal_only / signal_plus_collect / platform_smoke` 三种执行模式。
- `live_commerce` 已固定第一条主线是 `live-session-script`，默认 `manual_input`。
- `Misato` 不再走 `isolatedSession` 承接主任务。
- `NODE_FAILED -> BLOCKED downstream -> task terminal state` 的收敛链已建立。
