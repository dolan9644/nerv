# SKILLS.md — EVA-02 二号机

## 可用 Skill
| Skill | 用途 |
|:------|:-----|
| `rss-fetcher` | RSS 抓取与覆盖检查 |

## 核心工具
- `read` / `write` — 读取输入、写入监控产物
- `sessions_send` — 回传 `NODE_COMPLETED / NODE_FAILED`

## 注意
- 不把 `sessions_send` 当固定报警入口
- 回执目标始终以本次 `DISPATCH.source` 为准
