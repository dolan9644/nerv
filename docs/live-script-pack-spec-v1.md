# NERV Live Script Pack Spec v1

## 目标

`live-script-pack` 的目标不是“生成一份能看懂的文案”，而是生成一套**能直接交给主播和运营使用**的直播脚本包。

它必须同时满足：

- 主播可直接照着讲
- 运营能看懂商品顺序和福利节奏
- 下一场直播可以复用其中的结构
- Recorder / Spear / Rei 能识别并沉淀

这份文档是 `live-session-script` 的单一事实源。
相关 `roadmap / registry / workflow template / skill` 都应以这里为准。

## 输入规格

### 顶层必填

- `session_meta`
- `product_list`
- `promotion_and_benefits`
- `live_goal`
- `target_audience`

### 顶层可选

- `style_constraints`
- `session_plan`
- `must_include`
- `must_avoid`
- `historical_feedback`

### `session_meta` 必填字段

- `theme`
- `duration_minutes`
- `price_band`
- `primary_goal`
- `secondary_goals`

### `product_list` 最小字段

每个商品至少包含：

- `name`
- `role`
  - `引流款 / 主推款 / 利润款 / 搭配款`
- `price`
- `category`
- `core_selling_points`
  - 至少 `2` 条
- `material_or_fabric`
- `fit_or_version`
- `color_options`
- `scenes`
  - 至少 `1` 个，如 `通勤 / 约会 / 出游`
- `target_body_or_user`
- `objections`
  - 至少 `1` 条真实异议

推荐附加：

- `size_notes`
- `bundle_suggestion`
- `demonstration_points`
- `inventory_signal`
- `anchor_emphasis`

### `promotion_and_benefits` 必填字段

- `price_rule`
- `discount_rule`
- `gift_rule`
- `scarcity_rule`
- `shipping_or_service_note`

### `target_audience` 必填字段

- `age_range`
- `gender_focus`
- `style_preference`
- `decision_triggers`
- `pain_points`

## `offer_pack.json` 规格

`EVA-00` 不能只输出抽象槽位，必须输出可直接驱动成稿的结构化讲解卡。

至少包含：

- `session_meta`
- `run_of_show`
  - 开场、每个商品段、收尾的时间分配
- `product_cards`
  - 每个商品一张卡
- `objection_map`
- `pricing_beats`
- `interaction_hooks`
- `compliance_notes`

### `product_cards` 最小字段

- `product_name`
- `role`
- `opening_hook`
- `top_selling_points`
- `demonstration_order`
- `scene_lines`
- `objection_answers`
- `price_lines`
- `bundle_lines`
- `cta_lines`

## `script.md` 交付标准

`EVA-13` 输出的 `script.md` 必须是**主播台本**，不是“说明书式概要”。

至少包含：

- `开播前 3 分钟抓人段`
- `逐商品完整讲解段`
- `互动问答段`
- `价格提醒与逼单段`
- `切款过渡段`
- `收尾清单`

每个商品段至少要有：

- 开场钩子
- 卖点展开
- 试穿/展示提示
- 异议回应
- 价格与福利提醒
- 下单 CTA

## `selling_points.md` 交付标准

它不是摘要，而是给运营和主播看的**商品讲解卡**。

每个商品至少要写清：

- 商品定位
- 价格与福利
- 3-5 个核心卖点
- 适合谁
- 常见异议与回答
- 禁忌表述

## `cta.md` 交付标准

必须拆成：

- 全场通用 CTA
- 单商品 CTA
- 价格提醒 CTA
- 最后 3 分钟收尾 CTA

并显式给出：

- 适用时机
- 节奏频率
- 合规红线

## 不合格表现

出现以下情况，视为“能跑但不可交付”：

- 商品只有抽象角色，没有真实商品信息
- 只有大纲，没有可直接上播的话术
- 没有异议回应与互动段
- 没有价格提醒和收尾节奏
- `offer_pack.json` 不能反推出完整讲解顺序

## 第一轮验收标准

`live-session-script` 至少满足：

1. `offer_pack.json` 能体现真实商品卡，而不是抽象槽位
2. `script.md` 至少覆盖开场、逐商品、互动、切款、收尾
3. `selling_points.md` 可直接给运营复核
4. `cta.md` 能直接给主播贴片使用
5. 缺少关键商品字段时，必须稳定 `TOOL_GAP`
