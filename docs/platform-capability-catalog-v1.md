# NERV Platform Capability Catalog v1

## 目标

`Platform Capability Catalog v1` 是 `commerce_operations / social_media` 的平台能力前置真相。

它回答的不是“理论上哪个 Agent 最像这个平台”，而是：

1. 当前主链里这个平台到底能不能跑
2. 能跑的是 `monitor`、`collect` 还是两者都不行
3. 需要什么运行面
4. 是否存在**已批准进入主链**的公开能力来源
5. 缺口出现时，`Misato / Shinji / Mari / Eva-02 / Eva-03` 应该怎么处理

> 这份目录只记录**已批准进入主链**的平台能力，不记录私有实验资产。
> 私有能力可以作为参考，但不能让 `Misato` 把它当成默认可执行能力。

---

## 适用范围

本轮只覆盖：

- `weibo`
- `xiaohongshu`
- `douyin`

只做：

- `monitor`
- `collect`

不做：

- 登录
- 发布
- 评论互动
- 私信
- 账号运营动作

---

## 判定规则

### 状态定义

| status | 含义 |
|:-------|:-----|
| `ready` | 当前环境里已有公开、已批准、可稳定进入主链的能力 |
| `partial` | 有公开能力候选，但仍有运行面限制；只能在特定条件下实例化 |
| `gap` | 当前没有可批准进入主链的公开能力 |
| `gap_private_only` | 只有私有/本地实验能力可用，不能进入主链 |

### 主链准入规则

第一阶段只允许这三类来源进入主链：

1. OpenClaw 当前已注册且可稳定调用的 skill / adapter
2. 官方 plugin / adapter / MCP
3. ClawHub / 公开仓库中已验证、依赖明确、可在当前运行面落地的 skill
4. 公开可验证的 browser / Chromium / Playwright MCP 或同类自建适配器

明确排除：

- 私有 `xiaowang/xiaohongshu-skills`
- 需要登录态和人工维护的操作型脚本
- 需要浏览器常驻但当前 NERV 没有稳定浏览器运行面的方案

---

## 平台矩阵

### 1. `weibo`

| 字段 | 值 |
|:-----|:---|
| platform | `weibo` |
| mode | `monitor`, `collect` |
| source_type | `rss`, `public_page`, `adapter`, `mcp`, `browser_mcp` |
| owner_lane | `Shinji -> Eva-02 / Mari / Eva-03` |
| required_capabilities | `monitor`: `read/write/sessions_send`；`collect`: `exec/read/write`、`browser_mcp`、或公开 adapter/MCP |
| status | `partial` |
| approved_source | `RSSHub`（self-hosted, open source） / `browser_mcp` |
| fallback_order | `self-hosted RSSHub -> browser_mcp -> eva03 补证据 -> TOOL_GAP` |
| tool_gap_policy | 若未部署 self-hosted RSSHub 或可用 browser_mcp，或目标要求超出当前能力，直接 `TOOL_GAP`，不创建执行型 DAG |

当前说明：

- 微博第一版可执行路径是 self-hosted RSSHub，若没有则可退到 browser_mcp
- 这不是“零门槛公共服务”，而是“公开可验证、但需要自建服务/浏览器能力”的 partial 能力
- 现有 [`weibo-style`](/Users/dolan/.openclaw/skills/weibo-style/SKILL.md) 只是文风 skill，不是采集能力
- 因此：
  - `eva02` 只能处理微博相关的 **RSS / 已接入信号**
  - 当 RSSHub 已部署且可访问时，`Shinji` 才可把微博采集实例化给 `Mari`
  - 若存在可用 browser_mcp，`Shinji` 可把微博页面采集实例化给 `Mari`
  - 微博页面直抓仍不能默认派给 `Mari`

---

### 2. `xiaohongshu`

| 字段 | 值 |
|:-----|:---|
| platform | `xiaohongshu` |
| mode | `monitor`, `collect` |
| source_type | `rss`, `public_page`, `adapter`, `mcp`, `browser_mcp` |
| owner_lane | `Shinji -> Eva-02 / Mari / Eva-03` |
| required_capabilities | `monitor`: `read/write/sessions_send`；`collect`: `exec/read/write`、`browser_mcp` 或公开 adapter/MCP |
| status | `partial` |
| approved_source | `browser_mcp` / `Chromium MCP / Playwright MCP` / `xiaohongshu-mcp` 这类公开非官方 xhs MCP（已验证） |
| fallback_order | `xiaohongshu-mcp -> browser_mcp -> eva03 补证据 -> TOOL_GAP` |
| tool_gap_policy | 若当前没有已验证的 browser/MCP 路径，或运行中命中登录/验证码/IP 风控页，则直接 `TOOL_GAP` 或 `NODE_FAILED`，不得把私有 skill 当默认主链能力 |

当前说明：

- 仓库里存在私有本地资产：
  - [`agents/xiaowang/xiaohongshu-skills/SKILL.md`](/Users/dolan/.openclaw/agents/xiaowang/xiaohongshu-skills/SKILL.md)
- 该能力**不进入主链**
- 公开非官方 xhs MCP / browser_mcp 可作为 partial 路径，`xpzouying/xiaohongshu-mcp` 是公开可审查候选之一
- 但 browser/MCP 可启动并不等于当前环境可执行：
  - 需要有效登录态（如能力路径要求）
  - 不能落到验证码页或 IP 风控页
  - 不能只拿到 200 状态码却实际进入风险拦截页面
- 当前仍不默认把小红书页面直抓当成 ready 能力

因此：

- `xiaohongshu` 可进入 `partial` 实例化路径
- 但只有在 browser/MCP、登录态、页面状态三者都满足时才允许创建执行型节点
- 若命中验证码/风控页，必须显式记为运行受阻，不得假装支持
- 当前已验证事实：
  - Playwright / Chromium 能打开小红书公开页
  - 但运行时可能命中“IP 存在风险，请切换可靠网络环境后重试”一类风控页
  - 所以“小红书 smoke 可尝试”不等于“定向监控已可稳定交付”

---

### 3. `douyin`

| 字段 | 值 |
|:-----|:---|
| platform | `douyin` |
| mode | `monitor`, `collect` |
| source_type | `rss`, `public_page`, `adapter`, `mcp`, `browser_mcp`, `search_api` |
| owner_lane | `Shinji -> Eva-02 / Mari / Eva-03` |
| required_capabilities | `monitor`: `read/write/sessions_send`；`collect`: `exec/read/write`、`browser_mcp`、cookies / self-hosted API |
| status | `partial` |
| approved_source | `Evil0ctal API`（self-hosted, open source） / `browser_mcp` / cookie-backed downloader |
| fallback_order | `self-hosted API -> browser_mcp -> eva03 补证据 -> TOOL_GAP` |
| tool_gap_policy | 若未部署 self-hosted API / browser_mcp / cookie-backed downloader，或目标要求超出该能力，直接 `TOOL_GAP` |

当前说明：

- 抖音第一版可执行路径是 self-hosted `Evil0ctal API` 或 browser_mcp + cookie-backed downloader
- 这同样不是零门槛公共服务，而是“公开可验证、但需要自建服务/浏览器能力”的 partial 能力
- 当前环境里可见的公开候选包括：
- [`media-ninja`](/Users/dolan/.openclaw/skills/media-ninja/SKILL.md)（用户自有私有资产，不能默认外发到开源主链）
  - [`video-expert-analyzer`](/Users/dolan/.openclaw/skills/video-expert-analyzer/SKILL.md)
- 这些候选更偏视频下载/分析，必须经过平台能力目录确认后再决定是否实例化为采集节点

因此：

- 若 self-hosted `Evil0ctal API`、browser_mcp 或 cookie-backed downloader 已部署且可访问，抖音采集可升级为 `partial`
- 若未部署或运行面不可达，则继续视为 `TOOL_GAP`

---

## 实例化规则

### 对 `Gendo`

当需求命中 `commerce_operations / social_media` 时，草案必须至少写出：

- `target_platforms`
- `required_modes`
- `required_capabilities`
- `approved_adapter_only: true`
- `template_hint`

不要直接拍板 owner。

### 对 `Misato`

当收到 `commerce_operations / social_media` 草案时，强制按以下顺序处理：

1. 查这份目录
2. 判断目标平台在当前环境里是 `ready / partial / gap / gap_private_only`
3. 只对 `ready / partial` 平台实例化执行型节点
4. `gap / gap_private_only` 平台转为 `TOOL_GAP`
5. 如果目标平台全是 `gap`，整条 workflow 不创建执行型 DAG

### 对 `Shinji`

`Shinji` 负责数据 lane 的实例化和 fallback，但不能绕过这份目录：

- 可以把 `eva02` 用于 RSS / 已接入信号监控
- 可以把 `eva03` 用于补证据
- 可以把 `Mari` 用于已批准的公开采集
- 不能在平台状态为 `gap / gap_private_only` 时硬派 `Mari`

---

## 第一版可执行结论

在当前环境下，`commerce_operations / social_media` 第一条可落地 workflow 的默认策略应当是：

1. 先以 **RSS / 已接入信号监控** 为主
2. 再用 `eva03` 做补证据
3. 不默认实例化微博 / 小红书 / 抖音的公开采集节点
4. 真正需要这些平台采集时，稳定回 `TOOL_GAP`

这不是功能退化，而是为了避免系统再出现：

- 文档说支持
- 路由也派下去了
- 运行时却根本跑不动

---

## 后续进入主链的条件

某个平台要从 `gap` 升到 `partial` 或 `ready`，至少要满足：

1. 能力来源是公开的、可审查的
2. 依赖面与当前 OpenClaw / NERV 运行面兼容
3. 不要求私有登录态或人工值守
4. 已经过最小闭环验证
5. 已登记到 `skill_registry` 或等价的公开 adapter 目录

在此之前，默认宁可暴露 `TOOL_GAP`，也不假装支持。
