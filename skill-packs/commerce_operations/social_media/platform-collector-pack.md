# platform-collector-pack

## 元数据

- domain: `commerce_operations`
- subdomain: `social_media`
- family: `collect`
- primary_owner: `nerv-mari`
- upstream: `nerv-shinji`
- downstream: `nerv-eva00`

## 适用场景

- 微博公开页抓取
- 小红书公开内容抓取
- 抖音公开内容抓取
- 账号页 / 帖子页 / 评论页采集

## 输入

- 平台
- URL / 账号 / 帖子 ID
- 抓取深度
- 记录上限

## 输出

- `raw.json`
- 每条记录至少包含：
  - `id`
  - `source`
  - `url`
  - `timestamp`
  - `title` 或 `content`

## 对齐规则

- 只抓公开可访问数据
- 只负责采集，不负责排序与内容判断
- 若遇 403 / 封禁 / 验证码，按 `mari` 的退避协议回报

## 验收标准

- 输出可被 `nerv-eva00` 清洗
- 字段统一、来源明确
- 不把采集行为扩展成分析行为
