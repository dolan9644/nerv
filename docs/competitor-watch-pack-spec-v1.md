# Competitor Watch Pack Spec v1

## 目标

`competitor-watch-pack` 用来把竞品商品、活动、价格带、卖点变化和评价风向收成可追踪差异，不是泛泛的竞品观察笔记。

它服务的第一条正式 workflow 是：

- `competitor-watch`

## 适用范围

- 竞品卖点跟踪
- 活动/价格带变化观察
- 评价风向差异整理
- 上新前对照简报

默认不做：

- 平台内自动抓取控制
- 侵入式监控
- 商业决策拍板

## 输入契约

必填输入：

- `watch_meta`
- `competitor_source`
- `watch_goal`

其中 `competitor_source` 至少命中其一：

- `manual_competitor_notes`
- `competitor_urls`
- `competitor_samples`
- `manual_delta_points`

可选输入：

- `our_product_context`
- `price_band_rules`
- `must_include`
- `must_avoid`
- `time_window`

## 输出契约

结构化中间层：

- `watch.json`
- `delta.json`

最终交付：

- `competitor_watch.md`
- 可选 `memory_note.json`

## 节点分工

- `nerv-eva02`
  - 负责已接入竞品信号或变化清单监控
- `nerv-mari`
  - 仅在公开竞品页可达时做补采
- `nerv-eva00`
  - 负责差异聚类、价格带对照、卖点变化整理
- `nerv-eva13`
  - 负责把差异结果写成运营/商品可直接使用的竞品跟踪稿
- `nerv-rei`
  - 负责沉淀高复用竞品对照模式

## 验收标准

- `delta.json` 至少包含：
  - `competitor_name`
  - `change_type`
  - `delta_summary`
  - `impact_note`
  - `source_ref`
- `competitor_watch.md` 至少覆盖：
  - 核心差异
  - 新变化
  - 价格/卖点/评价风向
  - 需要继续跟踪的点

## fallback / TOOL_GAP

- 缺少 `watch_meta` 或 `watch_goal`：
  - `TOOL_GAP`
- 没有任何有效竞品输入：
  - `TOOL_GAP`
- 公开竞品页不可采集：
  - 允许只基于手工记录继续
  - `fallback_reason = competitor_inputs_manual_only`
- 未形成明确差异：
  - 不允许直接进入正式简报

## 外部参考

来源吸收：

- `agency-agents`
  - 吸收 `audit / competitor review / delta summary` 结构
- `OpenHarness`
  - 吸收 `plugin discoverability`、`install validation` 和 `background task` 的底座要求
