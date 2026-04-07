---
name: topic-ranking-pack
description: commerce_operations 业务数据加工能力包。负责去重、打标、聚类、排序、评分和评论分桶。由 EVA-00 主用，Shinji 编排。
user-invocable: false
disable-model-invocation: false
tags:
  - nerv
  - commerce_operations
  - normalize
  - ranking
  - clustering
  - workflow-pack
metadata: { "openclaw": { "emoji": "🧹", "os": ["darwin", "linux"], "compatible_agents": ["nerv-eva00", "nerv-shinji"] } }
---

# topic-ranking-pack

## 用途

这是 `commerce_operations` 的清洗与排序能力包。

它负责把原始数据变成可被内容工厂使用的结构化结果。

## 主责

- 主用：`nerv-eva00`
- 编排衔接：`nerv-shinji`

## 输入

- `raw.json`
- `monitor.json`
- schema 白名单
- 排序和评分约束

## 输出

- `cleaned.json`
- `ranked.json`
- `clustered.json`

## 交付要求

输出至少应明确：

- 去重后的数量
- 分组标签
- 排序依据
- 优先级或评分

## 边界

- 不负责原始采集
- 不负责最终成稿
- 不负责主路由

## 常见下游

- `social-copy-pack`
- `social-media-topic-daily` workflow
- `ecommerce-review-insight` workflow
