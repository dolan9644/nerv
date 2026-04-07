# 安装体验审计 v1

## 结论

旧的 `install.sh` 更像“标准路径上的同步脚本”，不是真正面向新用户的一键安装。

本轮已经做了第一阶段修正：

- 允许从非 `~/.openclaw/nerv` 路径启动安装
- 自动同步到标准路径后继续
- 安装时补 `skills.load.extraDirs`
- 安装后刷新 skill registry
- 安装后写出验证快照

## 当前安装链

1. 检查 OpenClaw / Node / Python
2. 若仓库不在标准路径：
   - 自动同步到 `~/.openclaw/nerv`
   - 从标准路径继续执行
3. 备份 `openclaw.json` / `cron/jobs.json`
4. 初始化 canonical `nerv.db`
5. 修复 DB 布局
6. 同步 runtime config
7. 刷新 skill registry
8. 安装系统级维护调度
9. 运行安装后验证

## 仍需补齐的点

- 更细的依赖验证：
  - MCP / browser / self-hosted service 是否可达
- 更明确的新用户错误提示：
  - 哪个 skill root 没挂上
  - 哪个 agent 配置没同步成功
- workflow acceptance suite：
  - 至少 1 条 `live-session-script`
  - 至少 1 条 `live-replay-summary`
  - 至少 1 条 `product-review-insight`
  - 至少 1 条 `meeting-to-task`
  - 至少 1 条 `finance-brief`
- install validation 还应检查：
  - 第一批 template 是否存在
  - 第一批 Misato workflow skill 是否存在
  - 新资产是否能被 healthcheck 识别

## 安装成功的最低标准

- `openclaw.json` 已写入 NERV agents
- `skills.load.extraDirs` 已包含 NERV roots
- `nerv.db` 已存在且 schema 对齐
- scheduler 已安装
- `data/runtime/install_validation.json` 已生成

## 默认原则

安装成功不等于功能全部 ready。
真正的产品级成功标准是：安装完成后，用户至少能跑通标准样例或得到明确缺口说明。
