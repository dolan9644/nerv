---
name: platform-collector-pack
description: commerce_operations 平台采集能力包。覆盖微博、小红书、抖音及其他公开页的内容、评论、账号和商品采集。由 Mari 主用，Shinji 编排。
user-invocable: false
disable-model-invocation: false
tags:
  - nerv
  - commerce_operations
  - social_media
  - live_commerce
  - ecommerce_ops
  - collect
  - workflow-pack
metadata: { "openclaw": { "emoji": "🕷️", "os": ["darwin", "linux"], "compatible_agents": ["nerv-mari", "nerv-shinji"] } }
---

# platform-collector-pack

## 用途

这是 `commerce_operations` 的原始采集能力包。

适用对象：

- 微博/小红书/抖音公开页
- 账号页
- 评论页
- 达人页
- 商品页

## 能力边界

- 优先使用官方或已验证的 adapter / MCP
- 若平台采集需要浏览器、登录流或额外脚本，但当前 runtime 只允许公开页抓取，则不得强派给不具备能力的节点
- `nerv-mari` 负责公开页与脚本化抓取；若仍无法覆盖目标平台，回传 `TOOL_GAP`

## 主责

- 主用：`nerv-mari`
- 编排衔接：`nerv-shinji`

## 输入

- 平台
- URL / 页面目标
- 抓取深度
- 记录上限
- 输出目录

## required_capabilities

- `exec`
- `read`
- `write`
- 已批准的公开 adapter / MCP，或公开页脚本化采集能力

可接受的公开能力来源包括：

- self-hosted RSS/Feed 服务
- self-hosted API 服务
- self-hosted browser_mcp / Chromium MCP
- 官方 plugin / adapter / MCP
- ClawHub / 公开仓库中已验证的采集 skill

可能需要但当前默认不假设：

- 浏览器
- 外部 token
- 登录态

## 输出

- `raw.json`

## 交付要求

输出至少应包含：

- `id`
- `source`
- `title` 或 `content`
- `url`
- `timestamp`

## 边界

- 只负责拿到原始数据
- 不负责排序
- 不负责摘要
- 不负责业务判断
- 若平台对应的官方/Clawhub 已验证 MCP 存在，优先复用该能力；若不存在，写明 `fallback_reason`

## approved_sources

第一阶段只接受：

1. OpenClaw 当前已注册且可稳定调用的公开 skill / adapter
2. 官方 plugin / adapter / MCP
3. ClawHub / 公开仓库中已验证、依赖明确、可在当前运行面落地的 skill
4. 公开可验证、但需要自建服务的 RSS/API/browser 方案，例如 self-hosted RSSHub、self-hosted 抖音 API、browser_mcp

明确排除：

- 私有本地平台 skill
- 需要登录态和人工值守的操作脚本
- 需要浏览器常驻但当前 NERV 没有稳定浏览器运行面的方案
- 未部署或不可访问的 self-hosted RSS/API 服务
- 未部署或不可访问的 browser_mcp / Chromium MCP

## tool_gap_policy

- 若平台状态为 `ready` / `partial`：
  - 可以实例化 `collect` 节点
- 若平台状态为 `gap` / `gap_private_only`：
  - 不创建执行型 `collect` 节点
  - 由 `Misato` 返回 `TOOL_GAP` 或收缩成仅监控/补证据路径

## 常见下游

- `topic-ranking-pack`
- `review-clustering-pack`
- `social-media-topic-daily` workflow
