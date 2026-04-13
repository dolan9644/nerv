# NERV Social Copy Pack Spec v1

## 目标

`social-copy-pack` 的目标不是泛泛地“写一段文案”，而是生成一套**可以直接交付给运营、编导、剪辑或主播使用**的社媒内容包。

这条能力优先覆盖三类高频需求：

1. 平台短文案
   - 微博文案
   - 小红书文案
   - 抖音标题/配文
2. 视频脚本
   - 短视频分镜脚本
   - 讲解型视频脚本
3. 口播稿
   - 主播口播
   - 短视频旁白
   - 直播切片口播

这份文档描述的是用户侧可直接使用的多平台内容能力边界、输入要求和交付标准。

## 输入规格

### 顶层必填

- `content_type`
- `target_platform`
- `content_goal`
- `audience_profile`
- `style_profile`
- `key_points`

### 顶层可选

- `product_or_topic_context`
- `reference_materials`
- `format_constraints`
- `must_include`
- `must_avoid`
- `compliance_notes`
- `asset_context`
- `detail_preference`
- `hook_preference`
- `hook_intensity`
- `script_depth`
- `platform_style_examples`

### `content_type` 允许值

- `weibo_post`
- `xiaohongshu_post`
- `douyin_caption`
- `video_script`
- `voiceover_script`

### `target_platform` 允许值

- `weibo`
- `xiaohongshu`
- `douyin`
- `cross_platform`

### `content_goal` 最小字段

- `primary_goal`
  - 如 `涨粉 / 种草 / 引流 / 转化 / 互动`
- `call_to_action`
- `success_signal`

### `audience_profile` 最小字段

- `target_people`
- `pain_points`
- `decision_triggers`
- `tone_preference`

### `style_profile` 最小字段

- `voice`
  - 如 `专业 / 犀利 / 松弛 / 甜感 / 克制`
- `rhythm`
  - 如 `快节奏 / 叙述型 / 强钩子`
- `platform_fit`
  - 平台语感约束
- `risk_boundary`
  - 禁止出现的承诺、敏感词、违规表达

### `key_points` 最小字段

- 至少 `3` 条核心信息
- 每条必须是可展开的事实、卖点、观点或情绪点

推荐附加：

- `hook_candidates`
- `objections`
- `faq`
- `scene_examples`
- `title_direction`

### 质量敏感输入

这几项不是所有场景都必填，但一旦缺失，`Gendo` 不应急着给完整草案，而应先补问：

- `detail_preference`
  - 用户偏好 `简洁 / 适中 / 详尽`
- `hook_preference`
  - 用户是否重视爆款标题、强钩子、反差开头
- `hook_intensity`
  - 用户接受 `克制 / 中等 / 强钩子`
- `script_depth`
  - 视频脚本需要 `提纲级 / 可拍摄级 / 可直接录制级`
- `platform_style_examples`
  - 用户是否已有喜欢的账号、文风或参考样例

如果请求命中以下任一情况，默认先补问再出草案：

- 同时要求小红书、抖音、微博三平台，但未说明风格差异
- 明确要“爆款”“吸引人”“有 Hook”，但没有说明强度偏好
- 要视频脚本或口播稿，但没有说明要到什么完成度
- 领域不止服饰，而是更泛的其他品类，但未提供类目语感或约束

## `copy_brief.json` 规格

`EVA-00` 不能只把输入原样转述，必须先整理成可成稿的结构化 brief。

至少包含：

- `content_type`
- `target_platform`
- `goal_frame`
- `audience_frame`
- `style_frame`
- `message_hierarchy`
- `hook_bank`
- `proof_or_scene_bank`
- `cta_options`
- `compliance_notes`

### `message_hierarchy` 最小字段

- `primary_message`
- `secondary_messages`
- `discarded_points`

### `hook_bank` 最小字段

- 至少 `3` 条候选开头
- 区分：
  - `情绪型`
  - `利益型`
  - `反差型`
- 并标明建议适用的平台与强度

## 交付物标准

### 1. 平台短文案

适用于：

- `weibo_post`
- `xiaohongshu_post`
- `douyin_caption`

至少输出：

- `post_copy.md`
- `title_options.md`

必须包含：

- 平台适配标题
- 正文主稿
- 至少 `3` 个备选开头
- 至少 `3` 个 CTA 句式
- 平台语感说明

#### 平台差异要求

**微博**

- 更短
- 节奏更快
- 观点和态度更先行
- 允许明显的话题带动和讨论引导

**小红书**

- 更像个人经验和生活表达
- 要有场景感和感受词
- 不能只像广告词
- 默认要有更明显的写作技巧，而不是把信息平铺写完
- 当用户偏好未说明时，至少同时给出 `自然版` 与 `强钩子版` 两种开头方向

**抖音**

- 标题和配文要更强钩子
- 语言更口语
- 更适合和视频画面/口播联动
- 不能只写“衣服信息”，必须优先处理开头停留、转折、节奏和评论引导

### 2. 视频脚本

适用于：

- `video_script`

至少输出：

- `video_script.md`

必须包含：

- 开头钩子
- 镜头段落拆分
- 每段的核心信息
- 画面建议或动作建议
- 结尾 CTA
- 明确的 Hook 结构
  - 开头 `3` 秒抓人点
  - 中段留人点
  - 结尾评论/下单/关注引导

如果输入允许，还应包含：

- 节奏点
- 字幕重点
- 评论区引导

### 3. 口播稿

适用于：

- `voiceover_script`

至少输出：

- `voiceover_script.md`

必须包含：

- 逐段口播正文
- 停顿与重音建议
- 口语化处理
- 评论互动句
- 结尾收口句
- 至少 `2` 套不同强度的开头版本

## 不合格表现

出现以下情况，视为“能跑但不可交付”：

- 微博、小红书、抖音使用同一套语感
- 视频脚本只有提纲，没有镜头或段落节奏
- 口播稿像书面说明，不像人会说的话
- 小红书文案只有信息堆砌，没有写法和 Hook 设计
- 抖音脚本只有产品点，没有完整 Hook 系统
- 没有 CTA 或 CTA 不能执行
- `copy_brief.json` 不能反推出成稿逻辑
- 没有写清合规边界

## 第一轮验收标准

`social-copy-pack` 至少满足：

1. `copy_brief.json` 能体现目标、受众、风格、钩子和信息层级
2. 文案类输出能明显区分微博 / 小红书 / 抖音语感
3. 小红书默认至少体现一种“自然分享”写法和一种“强钩子”写法
4. 视频脚本至少覆盖开头、段落、节奏、结尾，并明确 Hook 结构
5. 口播稿至少覆盖口语化、互动、收口，并能直接拿去录
6. 命中质量敏感输入缺口时，优先补问，不要急着完整成稿
7. 缺少关键输入且无法继续时，必须稳定 `TOOL_GAP`
