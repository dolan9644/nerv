# HEARTBEAT.md — 碇真嗣
1. 检查分配给前线 Agent 的数据任务是否超时
2. 先查 `nerv.db.agents` 的 `status / current_task_id / last_heartbeat`
3. 如果目标 Agent 不可达或 `last_heartbeat` 陈旧：
   - 不要同步等待 callback
   - 启用 route fallback / self-fallback
4. 重试超限 → sessions_send 回报 misato
5. 无异常 → HEARTBEAT_OK
