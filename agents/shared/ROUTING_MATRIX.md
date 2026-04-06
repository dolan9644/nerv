# NERV 角色路由矩阵

> 这是 **节点归属规则**，不是技能可用性清单。
> `skill_registry.compatible_agents` 只能回答“谁能用这个 skill”，不能单独决定“谁最该拥有这个节点”。

## 路由总原则

1. **先判定节点性质，再选 Agent。**
   不要先看到某个 Agent 很强，就把整条链塞给它。
2. **角色归属优先于工具兼容。**
   `compatible_agents` 是能力过滤器，不是最终 owner 选择器。
3. **一个节点只对应一个主责 Agent。**
   如需 fallback，必须显式记录 `fallback_reason`。
4. **不要为了“人人上场”而乱派。**
   不需要代码、审计、部署的 DAG，不应该硬塞给 `ritsuko`、`seele`、`eva-01`。
5. **相邻不同性质节点，默认不要被同一个 Agent 吞掉。**
   除非：
   - 当前系统没有该领域专职 Agent
   - 或该节点是同一产物上的连续文案加工
   - 或用户明确要求走快通道

## 路由归一层

为了避免为每个新需求继续堆叠特例，所有任务先收敛到这四个槽位：

1. **family**：这一步在做什么
   - `translate` / `route` / `collect` / `normalize` / `compose`
   - `review` / `repair` / `deploy` / `memory`
2. **source**：输入来自哪里
   - `web/rss/social`
   - `repo/github/release`
   - `repo/code`
   - `session/db/audit`
   - `file/code`
   - `memory`
3. **artifact**：最后要产出什么
   - `raw.json` / `cleaned.json` / `summary.md`
   - `card` / `patch` / `audit.json`
4. **risk**：有没有发布、删除、外部写入、未受信代码
   - `low` / `medium` / `high`

### 判定顺序（强制）

1. 先归 `family`
2. 再按 `source` 选主责 Agent
3. 再校验 `artifact` 与 `risk`
4. 只有主责 Agent 明确返回 `TOOL_GAP` / `NODE_FAILED`，且原因是能力缺口时，才允许 fallback
5. 对于 `repo/github/release` 报告类采集，若 `mari` / `eva-03` 全部不可达，允许 `nerv-shinji` 直接执行固定 collector script 作为 self-fallback；必须记录 `fallback_reason = frontline_data_collectors_unavailable`

### 交付模式

- `Gendo` 默认只输出可转交的草案，不替用户自动投递给 `Misato`
- `Misato` 只执行明确到达它的草案，或用户直接发给它的指令
- 当 `Gendo` 和 `Misato` 不在同一入口时，用户就是转交层，不要假设系统内已经自动中继

### 编排层 / 终端层分发规则

- `Misato` 默认优先把**多步数据流**交给 `nerv-shinji`，而不是直接把中间节点逐个发给数据终端
- `Misato` 默认优先把**多步代码流**交给 `nerv-ritsuko`，而不是直接把中间节点逐个发给代码终端
- `nerv-eva02` / `nerv-eva03`（模式 A）/ `nerv-eva00` / `nerv-eva13` 属于**数据终端层**，通常由 `nerv-shinji` 下发
- `nerv-asuka` / `nerv-kaworu` / `nerv-eva01` 属于**代码终端层**，通常由 `nerv-ritsuko` 下发
- 只有当目标 Agent 的 SOUL 明确允许 `source = nerv-misato` 且任务为单节点快通道时，`Misato` 才允许直接派发

### 什么时候不要拆太细

- 如果某个需求在当前系统里没有一条完全自洽的多节点 lane，就不要为了形式正确硬拆
- 先选**当前能闭环的最小 DAG**
- 典型例子：OpenClaw PR 晚报这类“仓库更新 -> 内容摘要 -> 通知”的需求，默认进入**数据 lane**
  - `nerv-shinji`：负责 repo/github/release 数据采集与中间产物衔接
  - `nerv-eva13`：负责摘要与成稿
  - `nerv-misato`：负责通知与收尾
- `nerv-ritsuko` 只在该任务需要代码分析、脚本修复、测试、仓库技术审查时进入，不是默认的晚报 owner
- 等 lane 补齐后，再恢复细粒度拆分

## 节点性质 → 主责 Agent

| 节点性质 | 主责 Agent | 说明 | 不该默认给谁 |
|:---------|:-----------|:-----|:-------------|
| 战略翻译 / 需求收窄 | `nerv-gendo` | 把用户意图翻成可执行约束 | misato / ritsuko |
| DAG 路由 / 状态推进 | `nerv-misato` | 建 DAG、派发、回收结果 | gendo / shinji |
| 数据采集 / 爬虫 | `nerv-mari` | 抓网页、平台、RSS 原始数据 | eva03 / misato |
| GitHub / Release / PR 采集（报告/监控） | `nerv-shinji` | 生成供内容链使用的结构化仓库更新数据 | eva00 / mari |
| GitHub 代码 / PR 技术分析 / 仓库脚本修复 | `nerv-ritsuko` | 面向代码、测试、脚本的技术任务 | eva00 / mari |
| RSS/社媒变化监控 | `nerv-eva02` | 监控、检测变化、给出 coverage/monitor 结果 | eva03 / eva13 |
| 深度搜索 / 证据搜集 | `nerv-eva03` | 搜索、资料聚合、工具发现 | mari / eva00 |
| 数据清洗 / 去重 / 结构化 / 评分 | `nerv-eva00` | 脏数据变干净数据，必要时物理校验 | eva03 / eva13 |
| 翻译 / 摘要 / 文案 / 报告 | `nerv-eva13` | 语言加工与内容成稿 | eva00 / misato |
| 数据流水线编排 | `nerv-shinji` | 多个数据专职节点之间的顺序与校验 | misato / eva03 |
| 代码流水线编排 | `nerv-ritsuko` | 代码编写、测试、交付协调 | misato / shinji |
| 调试修复 | `nerv-asuka` | Bug fix、失败节点修复 | misato / mari |
| 代码 / 工具安全审查 | `nerv-kaworu` | Review discovered tool / code quality & safety | misato |
| 高风险安全闸门 | `nerv-seele` | L4+ 审计、外部发布面、未受信代码 | 普通内容 DAG |
| 部署 / 运行环境 | `nerv-eva01` | Deploy、容器、运行时 | misato / eva13 |
| 记忆提纯 / 记忆分发 | `nerv-rei` | MEMORY、memory_queue、长期资产 | misato / gendo |

## Fallback 规则

只有在以下情况才能偏离主责：

1. `skill_registry` 显示主责 Agent 当前没有所需 skill / tool
2. 主责 Agent 明确返回 `TOOL_GAP` 或 `NODE_FAILED` 且原因是能力缺口
3. 当前任务被用户要求走 `fast` 快通道

偏离时必须记录：

```json
{
  "node_id": "xxx",
  "canonical_owner": "nerv-eva00",
  "actual_owner": "nerv-eva03",
  "fallback_reason": "eva00 当前无可用 skill；临时走 search+heuristic 方案"
}
```

## DAG 设计禁令

- 不要把 `eva03` 当万能数据工。
- 不要把 `misato` 当代码工或内容工。
- 不要把 `seele` 当普通流程里的常驻参与者。
- 不要让 `ritsuko` 进入纯内容 DAG，除非真的发生脚本/代码变更。
- 不要让 `gendo` 直接替代执行层交付产物。
- 不要把 `repo/github/release` 报告类采集直接派给 `eva00` 或 `eva13` 这类终端节点。

## 晨报 DAG 的正确映射

以“AI 晨报”这类**已存在原始 RSS 数据**的流程为例：

| 节点 | 正确主责 |
|:-----|:---------|
| 原始覆盖检查 / 变化确认 | `nerv-eva02` |
| 合并、去重、聚类、评分 | `nerv-eva00` |
| 翻译 / 精选文案 / Markdown 成稿 | `nerv-eva13` |
| 最终汇总、通知、DAG 收尾 | `nerv-misato` |

说明：
- `nerv-eva03` 适合“去外部搜索补证据”或“发现新工具”，不应默认承担 RSS 排名与精选。
- `nerv-seele` 不需要出现在常规晨报 DAG 中；只有当外部发布面、未受信脚本、权限边界发生变化时才介入。
- `nerv-ritsuko` 不需要出现在常规晨报 DAG 中；只有脚本坏了、要改代码时才进入。
