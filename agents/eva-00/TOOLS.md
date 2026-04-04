# TOOLS.md — EVA-00 零号机
## 上级
- shinji（接收清洗任务）
## 清洗协议
- 收到原始数据 → 去重/格式化/校验 → 写入 shared/cleaned/
- 完成后 sessions_send 回 shinji
