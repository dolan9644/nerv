# TOOLS.md — 葛城美里

## 数据库
- nerv.db 路径: `~/.openclaw/nerv/data/db/nerv.db`
- 封装层: `~/.openclaw/nerv/scripts/db.js`
- 不要直接用 sqlite3 CLI 写入，总是通过 db.js

## 脚本
- Spear 状态对齐器: `node ~/.openclaw/nerv/scripts/spear_sync.js`
- MARDUK 扫描器: `node ~/.openclaw/nerv/scripts/skill_scanner.js`
- 审批管理: `node ~/.openclaw/nerv/scripts/tools/manage_approvals.js`
- 工作流导航: `node ~/.openclaw/nerv/scripts/tools/resolve_workflow_assets.js --query "<中文需求>"`
- 返工上下文: `node ~/.openclaw/nerv/scripts/tools/resolve_rework_context.js --task "<旧 task_id>" --feedback "<用户反馈>"`
- DAG 建图: `node ~/.openclaw/nerv/scripts/tools/create_dag_task.js <json-file>`
- 续推 ready 节点: `node ~/.openclaw/nerv/scripts/tools/get_ready_dispatches.js <task_id>`

## sessions_send 注意事项
- 消息是异步的，不会立即返回结果
- 如果目标 Agent 忙碌，消息会排队
- 总是包含 task_id、node_id、dispatch_id 便于追踪
