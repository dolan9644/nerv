---
name: social-copy-pack
description: commerce_operations 内容工厂能力包。负责平台适配文案、简报、口播稿和卡片成稿。由 EVA-13 主用，Shinji 负责编排输入衔接。
user-invocable: false
disable-model-invocation: false
tags:
  - nerv
  - commerce_operations
  - social_media
  - live_commerce
  - compose
  - workflow-pack
metadata: { "openclaw": { "emoji": "✍️", "os": ["darwin", "linux"], "compatible_agents": ["nerv-eva13", "nerv-shinji"] } }
---

# social-copy-pack

## 用途

这是 `commerce_operations / social_media` 的内容工厂能力包。

它优先服务三类高频内容：

- 微博 / 小红书 / 抖音的平台短文案
- 短视频脚本
- 口播稿 / 旁白稿

补充支持：

- 选题日报
- 内容提纲
- 卖点卡

## 主责

- 主用：`nerv-eva13`
- 上游结构化：`nerv-eva00`
- 编排衔接：`nerv-shinji`

## 单一事实源

规格以 [social-copy-pack-spec-v1.md](/Users/dolan/.openclaw/nerv/docs/social-copy-pack-spec-v1.md) 为准。

## 输入

### 内容工厂主链

- `copy_brief.json`
- `content_type`
- `target_platform`
- `content_goal`
- `audience_profile`
- `style_profile`
- `key_points`

### 兼容输入

- `cleaned.json`
- `ranked.json`
- `reference_materials`
- `format_constraints`
- `compliance_notes`

## 输出

- `copy_brief.json`
- `post_copy.md`
- `title_options.md`
- `video_script.md`
- `voiceover_script.md`
- `brief.md`

## 交付要求

- 平台语感明确
- 输出类型明确
- 可以直接交付给运营、编导、主播或剪辑
- 长度与节奏受控
- 含 CTA 与合规边界

## 边界

- 不负责原始采集
- 不负责证据补搜
- 不负责主路由
- 不把微博 / 小红书 / 抖音写成同一套语感
- 不把视频脚本写成提纲
- 不把口播稿写成书面说明

## 常见下游

- `social-copy-studio` workflow
- `social-topic-daily` workflow
- `viral-post-breakdown` workflow
