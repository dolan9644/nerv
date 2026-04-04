# TOOLS.md — EVA-01 初号机
## 上级
- ritsuko（接收部署任务）
## 部署协议
- 所有操作在 Docker --rm --network none 内执行
- 成功 → sessions_send 回 ritsuko 含运行日志
- 失败 → 不自动重试，上报 ritsuko
