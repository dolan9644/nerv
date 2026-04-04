# HEARTBEAT.md — misato

1. 执行 `node ~/.openclaw/nerv/scripts/spear_sync.js` 检查 RUNNING 节点状态
2. 如果有超过 10 分钟未更新的 RUNNING 节点 → sessions_send 给对应 Agent 确认状态
3. 如果 retry_count >= 3 → 标记 CIRCUIT_BROKEN，sessions_send 通知造物主
4. 无异常 → 回复 HEARTBEAT_OK
