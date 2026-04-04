# HEARTBEAT.md — 赤木律子
1. 检查自己 assigned 的 RUNNING 节点是否超时
2. 如果有超时 → 尝试读取 Agent 返回日志诊断问题
3. 重试超限 → sessions_send 通知 misato 并标记 CIRCUIT_BROKEN
4. 无异常 → HEARTBEAT_OK
