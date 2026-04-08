# NERV Live Commerce Roadmap v1

## 目标

`live_commerce` 是 `commerce_operations` 下的第二条正式业务线。

它的目标不是做“平台自动直播控制”，而是在当前 OpenClaw / NERV 能力边界内，先把最稳定、最容易落地的直播运营工作流跑通：

1. 直播脚本生成
2. 直播复盘沉淀
3. 高频异议答复库
4. 直播节奏与评论监控

这条路线优先服务你当前最接近的用户群：

- 直播带货团队
- 新媒体运营
- 内容/投流协同团队
- 需要快速产出脚本、复盘、答复库的中小团队

## 边界

本阶段明确不做：

- 不做平台内自动发言或互动控制
- 不做登录态自动化运营
- 不做私有后台数据写回
- 不假设常驻浏览器控制层
- 不把“直播运营”误做成“电商后台自动化”

本阶段只做：

- 输入资料归一
- 直播脚本与讲解卡成稿
- 评论/反馈/复盘信号整理
- 结构化输出与记忆沉淀

## 第一条正式路线

第一条 `live_commerce` roadmap 先做：

- `live-session-script`

原因：

1. 不强依赖平台采集
2. 不依赖浏览器长期在线
3. 最容易复用到不同用户场景
4. 能直接形成用户可消费产物
5. 可以稳定验证 `Gendo -> Misato -> Shinji -> Eva00 -> Eva13 -> Misato -> Rei`

## 第一条 workflow：`live-session-script`

### 适用场景

- 新品直播前准备
- 单场直播脚本整理
- 商品讲解顺序设计
- 开场、转场、收尾话术生成

### 输入

- `session_meta`
- `product_list`
- `promotion_and_benefits`
- `live_goal`
- `target_audience`
- 可选 `style_constraints / session_plan / historical_feedback`

输入规格以 [live-script-pack-spec-v1.md](/Users/dolan/.openclaw/nerv/docs/live-script-pack-spec-v1.md) 为准。

### 输出

- `offer_pack.json`
- `script.md`
- `selling_points.md`
- `cta.md`
- 可选 `memory_note.json`

输出规格以 [live-script-pack-spec-v1.md](/Users/dolan/.openclaw/nerv/docs/live-script-pack-spec-v1.md) 为准。

### 默认拓扑

```text
gendo
  -> misato
      -> shinji
          -> eva00 (normalize-offer)
          -> eva13 (compose-script)
      -> misato (notify)
      -> rei (memory, 异步后置)
```

### 节点建议

| node_id | family | canonical owner | 作用 |
|:--------|:-------|:----------------|:-----|
| `normalize-offer` | `normalize` | `nerv-eva00` | 把商品、福利、节奏目标整理成统一结构 |
| `compose-script` | `compose` | `nerv-eva13` | 产出开场、转场、讲解、收尾脚本 |
| `notify-script` | `notify` | `nerv-misato` | 通过 Adam Notifier 或其他标准路径交付 |
| `memory-script-pattern` | `memory` | `nerv-rei` | 沉淀脚本套路、异议结构、节奏经验 |

### 为什么它是第一条

- `nerv-eva13` 的内容工厂能力已经存在
- `nerv-eva00` 的结构化清洗能力已经存在
- `nerv-misato` 的异步接单和最终交付已基本收敛
- `nerv-rei` 可以直接接住复用模式

## 第二条路线

第一条跑通后，再做：

- `live-replay-summary`

### 作用

- 对单场直播进行复盘
- 提炼表现好的话术
- 提炼失败点和改进项
- 进入 `memory_queue`

输入与输出规格以 [replay-summary-pack-spec-v1.md](/Users/dolan/.openclaw/nerv/docs/replay-summary-pack-spec-v1.md) 为准。

### 默认拓扑

```text
misato
  -> shinji
      -> eva02 (watch comments/signals, 可选)
      -> mari (collect replay/public comments, 可选)
      -> eva00 (cluster issues)
      -> eva13 (compose replay summary)
  -> rei (memory)
```

### 注意

这条线比脚本流更依赖真实输入源，因此不适合作为第一条正式 roadmap。

但在当前并行扩张策略下，它已经进入第一批正式资产，用来验证：

- 手工复盘输入能否稳定任务化
- `eva00 -> eva13 -> rei` 的复盘链能否稳定收敛
- `manual_review` 与 `manual_review_plus_signal` 两种输入路径是否都能被正确表达

## 第三条路线

之后再做：

- `live-objection-bank`

### 作用

- 把评论、异议、拒绝点整理成答复模板
- 输出 `qa_bank.md` / `qa_bank.json`

### 主责

- `nerv-eva00`：异议聚类
- `nerv-eva13`：答复文案
- `nerv-rei`：可复用话术沉淀

## skill pack 对齐

`live_commerce` 第一批主要依赖：

- `live-script-pack`
- `objection-handling-pack`
- `livestream-monitor-pack`
- `replay-summary-pack`

建议的落地顺序：

1. `live-script-pack`
2. `replay-summary-pack`
3. `objection-handling-pack`
4. `livestream-monitor-pack`

原因：

- 先做对输入依赖最小的
- 再做依赖真实评论/监控信号的

## 路由规则

对 `live_commerce`，继续服从五维路由：

- `family`
- `domain`
- `source`
- `artifact`
- `risk`

并额外固定：

- `Gendo` 只输出直播目标、商品约束、节奏要求、交付草案
- `Misato` 负责实例化 DAG，不直接把 `compatible_agents` 当 owner
- `Shinji` 负责直播相关结构化数据 lane
- `Eva00` 不负责写完整脚本，只负责归一、排序、分段、聚类
- `Eva13` 不负责做原始采集，只负责成稿

## 第一轮验收标准

`live-session-script` 跑通时，至少满足：

1. 输入可以来自用户手工提供的商品信息，不依赖平台采集
2. `Eva00` 输出结构化 `offer_pack.json`，且包含真实商品卡、节奏点、异议映射、价格提醒
3. `Eva13` 输出完整 `script.md / selling_points.md / cta.md`
4. `Misato` 能异步派发并最终交付
5. `Rei` 能把至少一条脚本模式写入记忆

## 不合格表现

出现以下情况，视为这条 roadmap 还没成立：

- 需要临时引入平台浏览器自动化才能开始
- 脚本成稿前没有稳定的结构化中间层
- `Misato` 仍然同步等待下游回执
- `script.md` 产出像 prompt 演示，而不是可直接给主播使用的台本
- `offer_pack.json` 只有抽象槽位，没有真实商品卡
- 没有价格提醒、互动段、异议回应和收尾节奏
- 复盘/记忆没有被接住

## 下一步实现顺序

1. 继续以 `live-session-script` 作为 `live_commerce` 的可交付主线
2. 用 `live-replay-summary` 验证复盘链路和后置记忆沉淀
3. 再进入 `live-objection-bank`
4. 让 `Gendo` 按这条 roadmap 生成第一版 `live-session-script` 草案
5. 交给 `Misato` 跑第一条真实 DAG
6. 用运行结果反向收敛 pack 和 template
