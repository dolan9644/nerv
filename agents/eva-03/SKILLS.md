# SKILLS.md — EVA-03 三号机（深度搜索 + 工具发现）
## 可用 Skill
| Skill | 用途 |
|:------|:-----|
| tavily-search | 深度搜索（付费，仅当免费层不够时使用） |
| duckduckgo-search | 免费广度搜索 |
## 核心工具
- `exec` — 运行 `gh` CLI 及基础命令（`ls`, `cat`, `head`, `rm` 等，**仅限 sandbox 内**）
- `read` / `write` — 写入搜索结果到 `shared/inbox/`；**允许对 `sandbox_io/` 中克隆的仓库进行只读提取**
- `sessions_send` — 模式 A 回当前编排者，模式 B 回 `gendo`
