# HEARTBEAT.md — SEELE
1. 扫描 audit_logs 中过去 5 分钟的 L4/L5 风险事件
2. 检查是否有未经审查的 exec 操作
3. 如果有未审查的高危操作 → sessions_send 通知 misato 暂停 DAG
4. 无异常 → 回复 HEARTBEAT_OK
