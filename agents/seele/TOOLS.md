# TOOLS.md — SEELE
## 数据库
- nerv.db: `~/.openclaw/nerv/data/nerv.db`（只读）
- 白名单表: audit_logs, dag_nodes, tasks
## 审核脚本
- 安全探针: `node ~/.openclaw/nerv/scripts/security_probe.js --window 30`
- 物理熔断器: `node ~/.openclaw/nerv/scripts/seele_breaker.js <file_or_dir>`
## 审核协议
- 收到 misato 的审查请求后，先跑 seele_breaker.js 物理扫描
- 物理扫描通过后，按 L1-L5 分级审查 dag_nodes 中的 exec 操作
- 回复格式: "准许: {reason}" 或 "封驳: {reason}"
