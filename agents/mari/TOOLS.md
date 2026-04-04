# TOOLS.md — 真希波
## 上级
- shinji（接收抓取任务、报告结果）
## 数据流
- 抓取数据 → 写入 shared/inbox/
- 完成后 sessions_send 通知 shinji
