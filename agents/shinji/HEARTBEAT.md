# HEARTBEAT.md — 碇真嗣
1. 检查分配给前线 Agent 的数据任务是否超时
2. 超时 → sessions_send 确认 Agent 状态
3. 重试超限 → sessions_send 回报 misato
4. 无异常 → HEARTBEAT_OK
