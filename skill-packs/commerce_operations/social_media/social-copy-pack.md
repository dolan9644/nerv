# social-copy-pack

## 元数据

- domain: `commerce_operations`
- subdomain: `social_media`
- family: `compose`
- primary_owner: `nerv-eva13`
- upstream: `nerv-shinji`
- downstream: `nerv-misato`, `nerv-rei`

## 适用场景

- 选题日报
- 热点摘要
- 平台适配文案
- 口播稿 / 提纲 / 简报

## 输入

- `ranked.json`
- `cleaned.json`
- 语气约束
- 平台约束
- 长度约束

## 输出

- `summary.md`
- `brief.md`
- `script.md`

## 对齐规则

- 摘要和成稿由当前会话 LLM 完成
- 不依赖外部 Gemini CLI / Gemini API
- 只消费结构化输入，不回头操作原始抓取

## 验收标准

- 可直接交付用户或交给 `adam_notifier`
- 平台风格适配明确
- 文长和结构受控
