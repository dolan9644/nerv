# NERV 通信规范

## sessions_send 格式

sessionKey 格式: `agent:<agentId>:main`

示例:
```
sessions_send(sessionKey="agent:nerv-gendo:main", message="...", timeoutSeconds=0)
```

**禁止** 使用裸 agentId（如 `nerv-gendo`）或省略前缀（如 `nerv-gendo:main`）。

### timeoutSeconds 策略

| 场景 | timeoutSeconds | 说明 |
|:-----|:--------------|:-----|
| DISPATCH 任务分发 | `0` | 异步，通过 NODE_COMPLETED 事件回收结果 |
| DAG 并行节点同时分发 | `0` | **必须异步**，避免并发 LLM 请求全部超时 |
| 广播通知（战备/全员） | `0` | **必须异步**，不等回复 |
| 单个 Agent 问答 | `60` | 需等待回复，给足 LLM 推理时间 |
| 紧急指令 | `30` | 默认值，简单任务够用 |

> 说明：以上 `timeoutSeconds` 仅用于 **需要同步读回** 的问答/状态确认。
> DAG 节点分发、节点回报、状态巡检都不应把 `sessions_send` 当成 RPC callback 来等待。
> 节点完成/失败的唯一收口仍然是 `NODE_COMPLETED` / `NODE_FAILED` 事件。

### ⚠️ 并发限制

```
绝对禁止同时给多个 Agent 发 timeoutSeconds > 0 的消息。
每条 sessions_send 都会触发目标 Agent 的一次 LLM 推理。
并发过多 → LLM 排队 → 全部超时 → 连锁崩溃。
```

### announce 回传机制（内置）

OpenClaw 的 `sessions_send` 自带 announce 投递：
- 发送者发出消息 → 目标 Agent 处理并回复 → announce 机制自动把回复投递回发送者的 IM 频道
- 支持最多 5 轮 Ping-Pong 来回对话
- `timeoutSeconds: 0` 也有 announce（后台异步投递）
- **不要把 announce 当成 DAG 的同步 callback**
  - 它只是可观察的消息回传，不是任务完成判定
  - DAG 任务是否完成，必须看 `NODE_COMPLETED / NODE_FAILED`

**关键原则**：
```
向下游派发任务 → timeoutSeconds: 0（不等回复，通过 NODE_COMPLETED 事件回收）
向上游回报结果 → 不设 timeoutSeconds（让 announce 机制投递到用户的 IM）
```

### 用户接单确认（NERV 约定）

当 `misato` 接到造物主的 DAG 任务时，交互顺序固定为：

```
1. 创建 task / DAG
2. 对 ready 节点执行 sessions_send(timeoutSeconds=0)
3. 在同一轮末尾立即回复造物主：
   - task_id
   - 已派发节点
   - 等待中的节点
   - “最终结果通过 Adam Notifier 发送”
```

禁止反过来：

```
先回复造物主 → 再尝试后台派发
```

原因：
- OpenClaw 支持 `sessions_send(timeoutSeconds=0)` 异步后台运行
- 但 final reply 发出后，本轮不能再依赖同一轮继续做控制面动作
- 所以必须先派发，再确认

### `dispatch_id` 规则

`dispatch_id` 是一次具体派发尝试的关联键，不是节点 ID 的替代品。

- 每次发送 `DISPATCH` / `STATUS_CHECK` / `ABORT` 时，都应该带 `dispatch_id`
- 同一节点重试或重派发时，必须生成新的 `dispatch_id`
- 下游 Agent 回 `NODE_COMPLETED` / `NODE_FAILED` 时，必须原样回传收到的 `dispatch_id`
- 如果上游没有给 `dispatch_id`，兼容旧任务时可回退到 `task_id + node_id` 做弱关联；新任务不要省略

推荐格式：
```
<task_id>:<node_id>:<attempt-id>
```

所有任务完成/失败时，必须 sessions_send 回报给派发者：

```json
{
  "event": "NODE_COMPLETED",
  "dispatch_id": "从DISPATCH继承",
  "source": "nerv-<自己的id>",
  "task_id": "从DISPATCH继承",
  "node_id": "从DISPATCH继承",
  "outputs": ["/path/to/result"],
  "duration_ms": 12000,
  "error": null
}
```

失败时 event 改为 `NODE_FAILED`，error 填写原因。
