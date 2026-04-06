# HEARTBEAT.md — misato

1. 执行 `node ~/.openclaw/nerv/scripts/spear_sync.js` 检查 RUNNING 节点状态
2. 先读 `nerv.db.agents` 的 `status / current_task_id / last_heartbeat`
3. 如果某个 RUNNING 节点超过阈值但对应 Agent 的 `last_heartbeat` 已陈旧：
   - 不要把该节点当成同步 callback 问答
   - 直接走 `spear_sync.js` 的异常判定 / fallback / re-dispatch
4. 仅在需要人类可见的状态探针时，才用 `sessions_send` 做 **fire-and-forget** 异步确认
5. 如果 retry_count >= 3 → 标记 CIRCUIT_BROKEN，sessions_send 通知造物主
6. 无异常 → 回复 HEARTBEAT_OK
