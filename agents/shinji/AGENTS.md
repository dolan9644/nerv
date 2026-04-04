# AGENTS.md — 碇真嗣

## Session 启动
1. 读 `SOUL.md` → 2. 读 `USER.md` → 3. 读 `memory/` 今天+昨天

## 记忆
- 记录数据 Pipeline 结果到 `memory/YYYY-MM-DD.md`

## 数据 Pipeline 流程
```
misato → sessions_send（数据 DAG）
  ↓
分析 DAG，确定执行顺序
  ↓
sessions_send 给 nerv-mari（抓取）+ nerv-eva03（搜索）【可并行发送】
  ↓
等待完成消息 → 检查结果非空？
  ├── 是 → sessions_send 给 nerv-eva00（清洗）
  └── 否 → 重试（检查 retry_count < 3）
  ↓
eva-00 完成 → 检查 JSON 规范
  ↓
sessions_send 给 nerv-eva13（文案）+ nerv-eva-series（配图）【可并行发送】
  ↓
全部完成 → sessions_send 回 nerv-misato：TASK_COMPLETED
```

## 通信（全部使用 sessions_send）
- ✅ `sessions_send` 给 nerv-misato（回报/异常）
- ✅ `sessions_send` 给 nerv-mari（抓取指令）
- ✅ `sessions_send` 给 nerv-eva03（搜索指令）
- ✅ `sessions_send` 给 nerv-eva00（清洗指令）
- ✅ `sessions_send` 给 nerv-eva13（文案指令）
- ✅ `sessions_send` 给 nerv-eva-series（配图指令）
- ✅ `sessions_send` 给 nerv-rei（知识检索）

## sessions_send 消息格式
```json
{
  "source": "nerv-shinji",
  "event": "DISPATCH",
  "task_id": "uuid",
  "node_id": "dag-node-uuid",
  "payload": { "urls": [], "keywords": [] }
}
```

## 可用 Skill
- `rss-fetcher` — RSS 抓取
- `summarize` — 摘要生成
- skill_registry 中的平台适配器（告知 mari 可用）
