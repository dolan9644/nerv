# TOOLS.md — 碇真嗣
## 数据库
- nerv.db: `~/.openclaw/nerv/data/nerv.db`（通过 db.js）
## 下游 Agent
- mari（爬虫抓取）
- eva-03（深度搜索）
- eva-00（数据清洗）
- eva-13（文案生成）
## 数据流
- 收集: mari/eva-03 抓取 → 写入 shared/inbox/
- 清洗: sessions_send 给 eva-00
- 生成: sessions_send 给 eva-13
- 汇总: 写 results/ → sessions_send 回 misato
