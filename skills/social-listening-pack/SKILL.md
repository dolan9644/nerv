---
name: social-listening-pack
description: commerce_operations/social_media 第一波能力包。用于热点、话题、账号、竞品和评论变化监听。由 EVA-02 主用，Shinji 负责编排衔接。
user-invocable: false
disable-model-invocation: false
tags:
  - nerv
  - commerce_operations
  - social_media
  - monitor
  - workflow-pack
metadata: { "openclaw": { "emoji": "📡", "os": ["darwin", "linux"], "compatible_agents": ["nerv-eva02", "nerv-shinji"] } }
---

# social-listening-pack

## 用途

这是 `commerce_operations / social_media` 的监听能力包。

它解决的问题是：

- 平台热点观察
- 关键词/主题追踪（仅限 RSS / 已接入信号；需要搜索补证据时交给 `nerv-eva03` 或已注册 adapter）
- 账号与竞品变化监听
- 评论/反馈波动发现

## 主责

- 主用：`nerv-eva02`
- 编排衔接：`nerv-shinji`

## 输入

- 关键词
- 账号清单
- 平台清单
- 时间窗
- watchlist

## required_capabilities

- `read`
- `write`
- `sessions_send`
- 已接入信号或 RSS 数据源

不要求：

- 浏览器
- Bash/exec 外部搜索
- 登录态

## 输出

- `monitor.json`
- 或供下游继续处理的结构化监控结果

## 交付要求

输出至少应包含：

- 来源平台
- 时间
- 链接
- 变化摘要
- 优先级标记

## 边界

- 它负责“发现变化”，不负责最终成稿
- 它不替代原始采集
- 当需要更深外部证据时，应升级给 `nerv-eva03`
- 当需要浏览器 / exec / 平台私有能力时，不应强行派给 `nerv-eva02`；应改派给有能力的 Agent 或已注册 adapter / MCP

## approved_sources

优先级：

1. 已注册的 RSS / 已接入信号源
2. 官方或已验证公开 adapter / MCP
3. self-hosted browser_mcp / Chromium MCP（已登记且可用）
4. `nerv-eva03` 的搜索补证据

不包括：

- 私有平台 skill
- 需要浏览器常驻的搜索能力
- 需要登录态的监控方案

## tool_gap_policy

- 如果目标平台只有页面采集能力，没有 RSS / 已接入信号：
  - 不要强派 `nerv-eva02`
  - 由 `Misato` / `Shinji` 判断是否改走 `nerv-eva03` 或 `nerv-mari`
- 如果平台能力目录把浏览器能力标成 `partial`：
  - 允许把已登记的 browser_mcp 当作补证据或采集的前置条件
- 如果没有任何已批准来源：
  - 直接 `TOOL_GAP`
  - 不创建“看起来会跑、实际上跑不动”的监控节点

## 常见下游

- `topic-ranking-pack`
- `social-media-topic-daily` workflow
- `social-media-hot-watch` workflow
