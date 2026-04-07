# NERV Node Contract v1

## 目的

`Node Contract v1` 不是新的 `SOUL.md`。

它是给 NERV harness 读的、机器可读的节点执行契约，用来回答四个问题：

1. 这个节点怎么被派发。
2. 这个节点怎样才算真的完成。
3. `session_recorder` 应该依据什么证据落账。
4. `spear_sync` 在什么超时/重试条件下应该接管。

它的目标是把“Agent 口头说完成了”变成“系统有证据承认完成了”。

> `Node Contract` 不负责定义通信关联 ID。
> `dispatch_id` 属于 sessions 协议层，应该由 `DISPATCH` 携带，并由 `NODE_COMPLETED / NODE_FAILED` 原样继承。

## 放置位置

第一阶段不改表结构。

直接把契约放进 DAG JSON 的 `nodes[].contract`，由现有 [create_dag_task.js](/Users/dolan/.openclaw/nerv/scripts/tools/create_dag_task.js) 写入 `tasks.dag_json`。

[db.js](/Users/dolan/.openclaw/nerv/scripts/db.js#L548) 当前已经把 `nodes` 原样序列化进 `dag_json`，所以这是一条兼容现状的接入路径。

## 最小结构

```json
{
  "node_id": "eva03-scan",
  "agent_id": "nerv-eva03",
  "description": "扫描当前记忆与状态，确认可复用上下文",
  "contract": {
    "version": "1.0",
    "dispatch_contract": {
      "mode": "agent_session",
      "target_agent": "nerv-eva03",
      "output_dir": "/Users/dolan/.openclaw/nerv/data/sandbox_io/eva03-scan"
    },
    "completion_contract": {
      "mode": "event_and_artifact",
      "accepted_events": ["NODE_COMPLETED", "NODE_FAILED"],
      "required_artifacts": ["scan_report.json"],
      "artifact_match_mode": "all",
      "require_task_id_match": true,
      "require_node_id_match": true,
      "result_path_from": "first_required_artifact"
    },
    "runtime_contract": {
      "timeout_seconds": 300,
      "max_retries": 2,
      "retry_backoff_seconds": 30,
      "orphan_threshold_seconds": 180
    },
    "observation_contract": {
      "sources": ["session_event", "artifact_fs"],
      "dedupe_key_template": "task_id:node_id:event:artifact",
      "artifact_root": "/Users/dolan/.openclaw/nerv/data/sandbox_io/eva03-scan"
    }
  }
}
```

## 字段解释

### `dispatch_contract`

定义节点如何被派发，而不是让 SOUL 猜。

- `mode`
  - `agent_session`: 通过 `sessions_send` 派发给 Agent
    - 对异步 DAG，默认使用 `agent:<agentId>:task:<task_id>`
    - 对单轮问答，才继续使用 `agent:<agentId>:main`
  - `tool_exec`: 由脚本直接执行
  - `approval_gate`: 等待审批后放行
  - `human_input`: 需要用户外部输入
  - `cron_only`: 只由 Cron 触发
- `target_agent`
  - 预期接收节点的 agent_id
- `output_dir`
  - 该节点应该写入 artifact 的目录
- `input_artifacts`
  - 上游必须已存在的输入文件

### `completion_contract`

定义“完成”的判断标准。

- `mode`
  - `event_only`
  - `artifact_only`
  - `event_and_artifact`
  - `event_or_artifact`
  - `approval_only`
- `accepted_events`
  - 当前建议白名单：
    - `NODE_COMPLETED`
    - `NODE_FAILED`
    - `NODE_OBSERVED_DONE`
    - `NODE_OBSERVED_FAILED`
- `required_artifacts`
  - 节点完成时必须存在的输出文件名
- `artifact_match_mode`
  - `all`: 所有必需 artifact 都要存在
  - `any`: 命中任一即可
- `require_task_id_match`
  - Recorder 只接受和当前 `task_id` 匹配的事件
- `require_node_id_match`
  - Recorder 只接受和当前 `node_id` 匹配的事件
- `result_path_from`
  - 后续落入 `dag_nodes.result_path` 的来源

### `runtime_contract`

定义恢复逻辑要用的运行参数。

- `timeout_seconds`
  - 节点超时阈值
- `max_retries`
  - 最大重试次数
- `retry_backoff_seconds`
  - 重试回退间隔
- `orphan_threshold_seconds`
  - 由 `spear_sync` 判断孤岛节点的阈值

### `observation_contract`

定义 Scanner / Recorder 如何收集证据。

- `sources`
  - 允许的观察源：
    - `session_event`
    - `artifact_fs`
    - `audit_log`
    - `approval_table`
    - `cron_health`
- `dedupe_key_template`
  - 当前建议：
    - `task_id:node_id:event`
    - `task_id:node_id:artifact`
    - `task_id:node_id:event:artifact`
- `artifact_root`
  - Recorder 扫描 artifact 时的根目录

## 为什么这比继续加 SOUL 更重要

SOUL 解决的是“应该怎么做”。

Node Contract 解决的是“系统凭什么承认你做完了”。

这是两件不同的事。

你已经在实际运行里看到：

- Agent 会优先解决用户当前显性需求
- Agent 不会稳定履行后台义务
- 如果没有 artifact 契约，`NODE_COMPLETED` 很容易漂移到错误的任务上

所以关键不是继续要求 Agent 自觉，而是让 harness 有独立的判定标准。

## 与现有脚本的接入点

### 第一阶段：落库

- Misato 生成 DAG JSON 时把 `nodes[].contract` 一起写进去
- [create_dag_task.js](/Users/dolan/.openclaw/nerv/scripts/tools/create_dag_task.js) 继续原子建图
- [db.js](/Users/dolan/.openclaw/nerv/scripts/db.js#L548) 把 contract 连同节点定义存入 `tasks.dag_json`

### 第二阶段：Recorder 读 `completion_contract`（已接入）

[session_recorder.py](/Users/dolan/.openclaw/nerv/scripts/session_recorder.py) 当前已经执行：

1. 从 `tasks.dag_json` 找到当前节点的 `contract`
2. 校验事件中的 `task_id/node_id`
3. 校验必需 artifact 是否存在
4. 只有满足契约时才写 `DONE/FAILED`
5. 用 `dedupe_key_template` 做强幂等

### 第三阶段：Spear 读 `runtime_contract`（已接入基础判定）

[spear_sync.js](/Users/dolan/.openclaw/nerv/scripts/spear_sync.js) 当前已经执行：

1. 读取节点的 `orphan_threshold_seconds`
2. 读取 `max_retries`
3. 漏调度时给出 `REDISPATCH_REQUIRED`，不再假装已经完成重派发

## 三类节点的推荐默认值

### `scan` 节点

- `completion_contract.mode = event_and_artifact`
- `required_artifacts = ["scan_report.json"]`

### `build/test` 节点

- `completion_contract.mode = event_and_artifact`
- `required_artifacts = ["build_report.json"]` 或 `["test_report.json"]`

### `notify/publish` 节点

- `completion_contract.mode = event_only`
- 但必须附带 `detail` 中的外部回执 ID 或 URL

## 当前最适合先接入的节点

先不要全系统一起改。

建议优先给这三类节点加 contract：

1. `eva03-scan`
2. `skill-scan`
3. `compile / notify / publish`

它们最容易出现“聊天里完成，系统里没完成”的漂移。

## 非目标

这份规范不负责：

1. 替代 SOUL
2. 替代 DAG 结构本身
3. 立即修改 `dag_nodes` 表结构
4. 立即接管全部旧任务

它的第一阶段目标只有一个：

让新的 DAG 节点从一开始就是“可判定、可补录、可恢复”的。
