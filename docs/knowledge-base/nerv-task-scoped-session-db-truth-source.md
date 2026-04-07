# NERV task-scoped session 与 DB 真相

## Idea
复杂任务必须靠 `task_id + dag_nodes + audit_logs` 收敛。`session` 只是执行容器，`nerv.db` 才是真相源。

## 核心逻辑
- 任务先落库，再派发：
  - `tasks` 记录任务级状态
  - `dag_nodes` 记录节点级状态
  - `audit_logs` 记录动作证据
- `session` 分两类：
  - `agent:<agent_id>:main`
  - `agent:<agent_id>:task:<task_id>`
- 同一个 Agent 可以反复换 session，但任务始终挂在同一个 `task_id`。

## Skill
关键事件结构已经验证可用：

```json
{"event":"DISPATCH","task_id":"live-session-script-v1","node_id":"normalize-offer","dispatch_id":"003"}
```

```json
{"event":"NODE_COMPLETED","task_id":"translate-raschka-agent","node_id":"mari-fetch","source":"nerv-mari"}
```

```text
orchestrator: agent:nerv-misato:task:<task_id>
worker: agent:<agent_id>:task:<task_id>
```

## 真实落点
- DB：`nerv/data/db/nerv.db`
- 控制面：
  - `nerv/scripts/session_recorder.py`
  - `nerv/scripts/spear_sync.js`
  - `nerv/scripts/adam_notifier.py`

## 已验证结论
- `task-scoped session` 能把同类任务隔离开，不再把旧回合和新回合混成一个线程。
- `session` 丢上下文时，任务仍可通过 DB 续跑。
- 节点级完成和任务级完成必须分开。
