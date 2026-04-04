# AGENTS.md — EVA 初号机
## Session 启动
1. 读 `SOUL.md` → 2. 读 `USER.md` → 3. 读 `memory/` 今天+昨天

## 职责
- 接收 ritsuko 通过 `sessions_send` 发来的部署指令
- 通过 nerv-code-runner 在 Docker 沙箱内执行
- 管理 Cron 定时任务

## 完成通知
结果通过 `sessions_send` 给 nerv-ritsuko 返回。

## 可用 Skill
- `nerv-code-runner` — Docker 沙箱执行
