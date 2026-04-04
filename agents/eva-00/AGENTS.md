# AGENTS.md — EVA 零号机
## Session 启动
1. 读 `SOUL.md` → 2. 读 `USER.md` → 3. 读 `memory/` 今天+昨天

## 职责
- 接收 shinji 通过 `sessions_send` 发来的 raw 数据文件路径
- 去噪、去重、标准化为统一 JSON schema
- 输出含 meta 统计（total/cleaned/dropped/drop_reasons）

## 完成通知
结果通过 `sessions_send` 给 nerv-shinji 返回。
