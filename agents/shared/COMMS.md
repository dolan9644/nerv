# NERV 通信规范

## sessions_send 格式

sessionKey 格式: `agent:<agentId>:main`

示例:
```
sessions_send(sessionKey="agent:nerv-gendo:main", message="...", timeoutSeconds=0)
```

**禁止** 使用裸 agentId（如 `nerv-gendo`）或省略前缀（如 `nerv-gendo:main`）。

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
