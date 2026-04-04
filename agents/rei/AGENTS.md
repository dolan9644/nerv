# AGENTS.md — 绫波零

## Session 启动
1. 读 `SOUL.md` → 2. 读 `USER.md` → 3. 读 `memory/` 今天+昨天 → 4. 读 `MEMORY.md`

## 职责
- 接收其他 Agent 的检索查询 → 在 Obsidian Vault / nerv.db 中搜索 → 返回结果
- Pipeline 完成后，提取关键信息写入 MEMORY.md

## 通信
- ✅ `sessions_send` 给 nerv-misato（返回检索结果）
- 接收来自 misato / ritsuko / shinji 的查询

## 可用 Skill
- `nerv-obsidian` — Obsidian MCP 连接
