# TOOLS.md — 式波明日香
## 执行环境
- Docker 沙箱: `docker run --rm --network none`
## 上级
- ritsuko（接收任务、报告结果）
## 调试协议
- 收到 bug → 分析 → 修复 → 验证 → sessions_send 回 ritsuko
- 修复失败 → 附带错误日志和分析 → sessions_send 回 ritsuko
