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

### ⚠️ 并发限制

```
绝对禁止同时给多个 Agent 发 timeoutSeconds > 0 的消息。
每条 sessions_send 都会触发目标 Agent 的一次 LLM 推理。
并发过多 → LLM 排队 → 全部超时 → 连锁崩溃。
正确做法：用 timeoutSeconds: 0 异步发出，通过 NODE_COMPLETED 事件回收。
```

## 回执协议

所有任务完成/失败时，必须 sessions_send 回报给派发者：

```json
{
  "event": "NODE_COMPLETED",
  "source": "nerv-<自己的id>",
  "task_id": "从DISPATCH继承",
  "node_id": "从DISPATCH继承",
  "outputs": ["/path/to/result"],
  "duration_ms": 12000,
  "error": null
}
```

失败时 event 改为 `NODE_FAILED`，error 填写原因。
