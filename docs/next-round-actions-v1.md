# NERV Next Round Actions v1

## 目标

这份文档用来承接“今天已经定下，但还没有完全收口”的工作。

它不是长期 roadmap 的替代品，而是下一轮推进时的执行清单。作用是：

1. 防止只盯着单个 DAG，忘掉整体架构扩张
2. 把明天的优先级固定下来
3. 明确哪些线是收口，哪些线是扩张

## 当前总原则

后续继续遵守：

- 不新增 Agent
- 继续沿用 `domain + skill pack + workflow template`
- Reliability 基线统一以 `docs/reliability-model-v1.md` 为准
- `Gendo` 只做草案，不拍最终 owner
- `Misato` 查 catalog / template / routing matrix 后再实例化
- `compatible_agents` 永远只是过滤器，不是最终 owner
- 所有正式能力都必须被 Recorder / Spear / Adam / Memory 接住
- 外部参考统一以以下文档为准：
  - `docs/external-reference-matrix.md`
  - `docs/openharness-adoption-matrix.md`
  - `docs/external-references.md`

## 已定死的一级业务域

- `general`
- `commerce_operations`
  - `social_media`
  - `live_commerce`
  - `ecommerce_ops`
- `project_ops`
- `finance_info`

## 当前两条主线

### 1. 收口线

把已经跑起来的主线收成稳定模板：

- `commerce_operations / social_media`
- `commerce_operations / live_commerce`

重点：

- 用真实 DAG 结果反写 pack / template / routing 边界
- 让主线不再依赖临时 prompt 和记忆

### 2. 扩张线

继续推进今天已经定下的整套架构扩张：

- 继续扩 `domain`
- 继续扩 `skill pack`
- 继续扩 `workflow template`

重点：

- 不只围绕眼前一个 DAG 打转
- `ecommerce_ops / project_ops / finance_info` 必须继续保留在正式 backlog 中

## 当前已确认的稳定结论

### `social_media`

- `social-topic-daily` 正式主链默认是 `signal_only`
- 默认输入只接受：
  - `RSS`
  - `已接入信号`
- `follow-builders X` 不进通用主链，不进默认输入源，不进验证集
- `xiaohongshu-smoke` 只算 smoke 成功，不算正式能力成立
- 平台能力目录继续作为前置真相源

### `live_commerce`

- 第一条正式路线固定为 `live-session-script`
- 默认执行模式固定为 `manual_input`
- 不混入平台采集
- 不引入浏览器自动化
- 主链固定为：
  - `eva00`
  - `eva13`
  - `misato`
  - `rei`

### 控制面

- `Misato` 必须保持稳定接单入口
- 不再依赖 `isolatedSession` 承接主任务对话
- DAG 节点统一 `sessions_send(timeoutSeconds=0)`
- `Misato` 先派发，再立即确认
- 最终结果通过 `Adam Notifier`
- `Seele` 继续保持隔离，不动

## 明确的 skill / workflow backlog

### A. `commerce_operations`

#### `social_media`

已做第一波，下一轮只收口，不继续扩平台。

skill plan：

- `social-listening-pack`
- `platform-collector-pack`
- `topic-ranking-pack`
- `social-copy-pack`

workflow plan：

- `social-topic-daily`
- `hot-topic-watch`
- `viral-breakdown`

#### `live_commerce`

下一轮正式推进。

skill plan：

- `live-script-pack`
- `replay-summary-pack`
- `objection-handling-pack`
- `livestream-monitor-pack`

workflow plan：

- `live-session-script`
- `live-replay-summary`
- `live-objection-bank`

固定顺序：

1. `live-session-script`
2. `live-replay-summary`
3. `live-objection-bank`

#### `ecommerce_ops`

尚未正式开工，但必须保留在 backlog。

skill plan：

- `ecommerce-collector-pack`
- `review-clustering-pack`
- `sku-brief-pack`
- `competitor-watch-pack`

workflow plan：

- 商品评价洞察流
- 竞品卖点跟踪流
- 新品上新简报流

注意：

- `ecommerce_ops` 不优先于 `live_commerce`
- 但它已经是正式板块，不是可选想法

### B. `project_ops`

尚未开工，但必须继续保留。

skill plan：

- `project-planning-pack`
- `meeting-to-task-pack`
- `resource-allocation-pack`
- `status-report-pack`

workflow plan：

- 多项目优先级流
- 周会纪要转 DAG 流
- blocker 升级流

### C. `finance_info`

尚未开工，但必须继续保留。

skill plan：

- `market-watch-pack`
- 财讯摘要类 pack
- 政策观察类 pack

workflow plan：

- 财讯晚报流
- 政策变化提醒流
- 观察名单变化流

边界：

- 只做信息服务
- 不做交易决策
- 不变成投资顾问人格

## 下一轮第一优先级

### 1. 先看 `Misato` 最后那条直播 DAG

这是下一轮的第一个真相源。

要检查：

- 实际实例化了哪些节点
- 是否遵守 `live-session-script` 主链
- 是否把 `eva00` 与 `eva13` 的职责分开
- 最终产物是否完整
- `Rei` 是否真的接到了记忆沉淀

### 2. 收口 `live-session-script`

这是下一轮最重要的工作。

要完成：

- 确认 `offer_pack.json` 的最小 schema
- 确认 `script.md / selling_points.md / cta.md` 的验收标准
- 确认哪些字段必须由用户提供，哪些可有默认值
- 把真实 DAG 的结果反写回：
  - `live-commerce-roadmap-v1`
  - `workflow-template-catalog-v1`
  - `skill-pack-registry-v1`

### 3. 收尾 `social-topic-daily`

下一轮继续检查：

- `eva02` 是否已彻底回到 RSS / 已接入信号监控
- 是否仍有旧任务或旧 prompt 把它拉回 acquisition / search 路径
- `signal_only` 主链是否稳定
- `TOOL_GAP` / `NODE_FAILED` / Recorder / Spear / Adam 是否对齐

### 4. 只在前两条稳定后，再预研 `live-replay-summary`

下一轮这一步只做预研，不开工实现。

要确认：

- 输入来源
- 评论 / 反馈 / 复盘信号从哪里来
- 是否先用 `manual_input_plus_feedback`
- 还是等平台采集能力更稳后再进入

## 当前扩张同步补齐项

- `workflow-acceptance-suite-v1`
- `runtime-drift-detection-v1`
- install validation 对第一批新模板与 skill 的存在性检查
- healthcheck 对第一批新模板与 skill 的资产漂移检查

## 下一轮暂不做

- 不继续围绕 `xiaohongshu-smoke` 测试
- 不继续扩微博 / 抖音 / 小红书的平台 adapter
- 不把 `follow-builders X` 重新拉回正式主链
- 不新增 Agent
- 不把行业细节继续写进 SOUL
- 不把 `ecommerce_ops` 抢到 `live_commerce` 前面做

## 下一轮成功标准

### 最低成功标准

- `Misato` 最后那条直播 DAG 被完整复盘
- `live-session-script` 的输入、节点、输出和记忆沉淀边界被收紧
- `social-topic-daily` 的正式主链继续保持 `signal_only`
- `follow-builders X` 没有重新污染正式主链

### 更高成功标准

- `live-session-script` 被固定成第一条可复用 `live_commerce` workflow
- `Rei` 的记忆沉淀字段被明确写死
- `live-replay-summary` 的输入前提被定义清楚
- `ecommerce_ops / project_ops / finance_info` 的 skill plan 继续保持在正式 backlog 中，不被遗忘
