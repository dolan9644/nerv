# NERV Reliability 与控制面收敛

## Idea
NERV 的可靠性不靠“Agent 更聪明”，而靠“先落库、后派发、终态统一收敛”。

## 核心逻辑
- `nerv.db` 是唯一真相源，任务推进只认：
  - `tasks`
  - `dag_nodes`
  - `audit_logs`
  - artifact 路径
- 复杂请求自动任务化：
  - 自动生成 `task_id`
  - 自动建 `dag_nodes / dag_edges`
  - 自动写 session 映射
- `session` 只做执行容器：
  - `agent:<agentId>:main`
  - `agent:<agentId>:task:<task_id>`
- 用户只看到：
  - `DONE`
  - `PARTIAL`
  - `FAILED / TOOL_GAP`

## 控制面链路
```text
tasks -> dag_nodes -> dag_edges -> task_session_bindings -> audit_logs -> dispatch
```

## 关键代码 / 协议
```text
orchestrator: agent:nerv-misato:task:<task_id>
worker: agent:<agent_id>:task:<task_id>
```

```json
{"event":"NODE_COMPLETED","task_id":"...","node_id":"...","source":"nerv-eva13"}
```

## 自查自纠
- `session_recorder.py`：回填事件、修正状态、失败阻断。
- `spear_sync.js`：查 orphan、漏调度、stale node。
- `adam_notifier.py`：只对整任务终态通知。

## 已验证约束
- 失败节点不会再让下游一直停在 `PENDING`。
- 节点完成不会再冒充整任务完成。
- 跨天恢复优先走 DB，不再依赖聊天记忆。
