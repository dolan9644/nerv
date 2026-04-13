# Product Review Insight Spec v1

## 目标

`product-review-insight` 对应 `ecommerce_ops` 的第一条正式工作流。它的作用是把商品评价、卖点、痛点和上新语义收成一个可直接给运营、商品和内容团队使用的商品洞察包。

## 适用范围

- 商品评价洞察
- SKU 卖点归纳
- 上新前内容支持
- 竞品/用户痛点抽样对照

## 输入契约

必填输入：

- `product_meta`
- `review_source`
- `analysis_goal`

`review_source` 至少命中其一：

- `manual_reviews`
- `review_samples`
- `raw_review_json`
- `review_image_paths`
- `review_image_text`

可选输入：

- `competitor_context`
- `launch_context`
- `must_include`
- `must_avoid`
- `format_constraints`

### 图片 / 截图输入规则

如果评价输入来自截图、聊天图片或附件，必须满足其一：

- 提供图片的绝对路径，进入 `review_image_paths`
- 先把图片里的评价文字转出来，进入 `review_image_text`

以下情况不算有效输入：

- 只说“我发过截图”
- 只在上游对话里上传图片，但路径没有进入 DAG payload
- 只有图片数量说明，没有文字内容、没有路径

## 输出契约

结构化中间层：

- `clustered.json`
- `selling_points.json`
- `painpoints.json`

最终交付：

- `review_insight.md`
- `sku_brief.md`
- 可选 `memory_note.json`

## 节点分工

- `nerv-mari`
  - 仅在公开商品页/评价页可达时做补采
- `nerv-eva00`
  - 负责评价聚类、卖点/痛点分桶、优先级和上新角度整理
- `nerv-eva13`
  - 负责把聚类结果写成商品洞察和 SKU 简报
- `nerv-rei`
  - 负责沉淀高复用的卖点角度和负反馈模式

## 验收标准

- `clustered.json` 至少包含：
  - `positive_clusters`
  - `negative_clusters`
  - `selling_points`
  - `painpoints`
- `review_insight.md` 必须覆盖：
  - 用户最认可的卖点
  - 主要负反馈
  - 推荐对外表达方式
  - 不建议继续强化的表述
- `sku_brief.md` 必须能直接给运营/商品侧使用

## fallback / TOOL_GAP

- 缺少 `product_meta` 或 `analysis_goal`：
  - `TOOL_GAP`
- 没有任何有效评价输入：
  - `TOOL_GAP`
- 只有截图提示，但没有图片路径或图片文字：
  - `TOOL_GAP`
  - `fallback_reason = review_images_missing_paths_or_text`
- 公开评价不可采集：
  - 允许只使用手工评论样本
  - `fallback_reason = review_inputs_manual_only`
- 没有形成稳定卖点/痛点聚类：
  - 不允许直接写正式洞察

## 外部参考

来源吸收：

- `agency-agents`
  - 吸收 `audit / review / brief / competitor summary` 结构
- `OpenHarness`
  - 吸收 `task lifecycle / acceptance / terminal state` 的系统表达
