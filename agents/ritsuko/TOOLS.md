# TOOLS.md — 赤木律子
## 数据库
- nerv.db: `~/.openclaw/nerv/data/nerv.db`
- 通过 db.js 封装操作
## 脚本
- Spear: `node ~/.openclaw/nerv/scripts/spear_sync.js`
## 代码执行
- 所有 exec 在 Docker 沙箱内: `docker run --rm --network none`
- 超时上限: 300s
## 下游 Agent
- asuka-shikinami（调试修复）
- kaworu（代码优化/Review）
