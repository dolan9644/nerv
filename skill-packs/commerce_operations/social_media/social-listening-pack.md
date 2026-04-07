# social-listening-pack

## 元数据

- domain: `commerce_operations`
- subdomain: `social_media`
- family: `monitor` / `collect`
- primary_owner: `nerv-eva02`
- upstream: `nerv-misato`, `nerv-shinji`
- downstream: `nerv-eva00`, `nerv-rei`

## 适用场景

- 热点话题监听
- 竞品账号观察
- 评论/反馈收集
- 平台讨论风向判断

## 输入

- 关键词列表
- 账号列表
- 平台范围
- 时间窗
- 可选观察名单

## 输出

- `monitor.json`
- 必须至少包含：
  - `source`
  - `timestamp`
  - `url`
  - `title` 或 `snippet`
  - `change_type`
  - `priority`

## 对齐规则

- 监控结果只负责“发现变化”，不负责最终解释
- 没有明确高优先级变化时，也可以正常完成，但要明确 `changes_detected=false`
- 如需补证据，交由 `nerv-eva03`

## 验收标准

- 输出结构化
- 能被 `nerv-eva00` 直接消费
- 能支持热点追踪流或选题日报流的下游成稿
