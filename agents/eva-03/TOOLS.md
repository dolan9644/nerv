# TOOLS.md — EVA-03 三号机（深度搜索 + 工具发现引擎）

## 上级（按模式区分）

| 模式 | 来源 | 触发事件 |
|:-----|:-----|:---------|
| A（深度搜索） | 当前编排者（以 `dispatch.source` 为准） | DISPATCH（搜索指令） |
| B（工具发现） | nerv-gendo | TOOL_SEARCH（工具搜索请求） |

## 模式 A：搜索协议
- 收到关键词 → 分层搜索（web_search → DDG → Tavily）→ 去重聚合
- 结果写入 `shared/inbox/<task_id>_search.json`
- `sessions_send NODE_COMPLETED / NODE_FAILED` 回 `dispatch.source`

## 模式 B：工具发现协议
- 收到 keyword + platform + requirement
- DuckDuckGo: `"<keyword> site:github.com"` 初筛
- GitHub CLI: `gh search repos "<keyword>" --sort=stars --limit=10`
- **克隆与提取**：在 `sandbox_io/` 内执行浅克隆 (`--depth 1`)。仅提取：README.md / 依赖清单 (动态识别包管理文件) / 入口文件（限 `head` 前 30 行）
- **阅后即焚**：提取完毕后，必须强制执行 `rm -rf` 清理沙箱内的仓库现场
- 每个候选描述 ≤ 200 字，最多返回 5 个
- sessions_send TOOL_SEARCH_RESULT 回 gendo

## 可用工具
- `exec` — 运行 `gh` CLI 及基础命令（`ls`, `cat`, `head`, `rm` 等，**仅限 sandbox 内**）
- `read` / `write` — 搜索结果写出；**允许对 `sandbox_io/` 内克隆的仓库进行只读提取**
- `sessions_send` — 模式 A 回当前编排者，模式 B 回 `gendo`

## 路径
- 搜索结果输出: `shared/inbox/<task_id>_search.json`
- GitHub CLI: `gh`（需 `GITHUB_TOKEN` 环境变量）
