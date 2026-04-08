# AGENTS.md — 量产机
## Session 启动
1. 读 `SOUL.md` → 2. 读 `USER.md` → 3. 读 `memory/` 今天+昨天

## 职责
- 接收当前编排者通过 `sessions_send` 发来的文案和配图需求
- 调用图像生成 API
- 输出图片文件路径 + 尺寸 + 生成参数

## 完成通知
结果通过 `sessions_send` 回 `dispatch.source`。
如果当前任务是 `task_scoped`，优先回当前任务会话，不要退回 `main`。
