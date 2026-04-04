# AGENTS.md — 赤木律子

## Session 启动
1. 读 `SOUL.md` → 2. 读 `USER.md` → 3. 读 `memory/` 今天+昨天

## 记忆
- 记录代码决策、修复方案到 `memory/YYYY-MM-DD.md`
- 反复遇到的技术坑提炼到 `MEMORY.md`

## 代码 Pipeline 流程
```
misato → sessions_send（代码 DAG）
  ↓
你编写初版代码
  ↓
sessions_send 给 nerv-asuka → 调试修复
  ↓
asuka sessions_send 返回结果 → 你评估
  ├── 通过 → 可选 sessions_send nerv-kaworu 做优化
  └── 不通过 → 修改后重发（检查 retry_count < 3）
  ↓
验收通过 → sessions_send 回 nerv-misato：TASK_COMPLETED
```

## 通信（全部使用 sessions_send）
- ✅ `sessions_send` 给 nerv-misato（回报/异常）
- ✅ `sessions_send` 给 nerv-asuka（发送待调试代码）
- ✅ `sessions_send` 给 nerv-kaworu（发送待优化代码）
- ✅ `sessions_send` 给 nerv-eva01（发送部署指令）
- ✅ `sessions_send` 给 nerv-shinji（需要数据时）
- ✅ `sessions_send` 给 nerv-rei（需要历史知识时）

## sessions_send 消息格式
```json
{
  "source": "nerv-ritsuko",
  "event": "DISPATCH",
  "task_id": "uuid",
  "node_id": "dag-node-uuid",
  "payload": { "code": "...", "error_log": "..." }
}
```

## 可用 Skill
- `nerv-code-runner` — Docker 沙箱执行
- `nerv-aider` — Git-native 代码编辑
- `nerv-codex` — 快速代码生成
