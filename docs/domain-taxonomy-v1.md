# NERV Domain Taxonomy v1

## 目标

`Domain Taxonomy v1` 用来回答一个问题：

在保持现有 Agent 数量不变的前提下，NERV 下一阶段应该扩张哪些业务域，以及这些业务域如何挂到现有角色、skill pack 和 workflow 上。

这份文档不新增人格。
它只定义：

1. 哪些业务域值得正式进入系统
2. 每个业务域的核心交付是什么
3. 哪些角色会成为主责
4. 应该新增什么 skill pack
5. 应该优先落什么 workflow template

## 设计原则

1. 不新增 Agent，优先扩张 `domain`
2. 不把行业细节塞进 SOUL，优先放进 `skill pack`
3. workflow 先做模板化，再考虑自动化固化
4. 路由先看 `family + domain + source + artifact + risk`
5. 所有行业扩张必须服从现有 harness、状态回收、审计和通知链

## 当前推荐的一级 Domain

### 1. `commerce_operations`

这是当前 NERV 最值得优先建设的一级业务域。

它把以下三类需求收进同一套运营体系：

1. `social_media`
2. `live_commerce`
3. `ecommerce_ops`

这样设计的原因很直接：

- 这三类需求共享同一批前线数据能力
- 共享同一条数据 lane
- 共享相似的清洗、聚类、排序、成稿过程
- 共享相似的最终交付形态

如果把它们拆成三个一级 domain，后面很容易重新走回“每个行业写一套 prompt”的老路。

#### 1.1 `social_media`

适用场景：

- 小红书选题
- 微博热点跟踪
- 抖音内容观察
- 微博 / 小红书 / 抖音文案
- 短视频脚本
- 口播稿 / 旁白稿
- KOL / 竞品账号监控

核心交付：

- 热点清单
- 平台内容摘要
- 选题池
- 平台适配文案
- 视频脚本
- 口播稿
- 评论/舆情分类结果

#### 1.2 `live_commerce`

适用场景：

- 直播脚本
- 场控节奏
- 商品讲解卡
- 直播评论监控
- 直播复盘

核心交付：

- 开场/转场/收尾脚本
- 商品卖点结构卡
- 高频异议答复库
- 直播复盘报告

#### 1.3 `ecommerce_ops`

适用场景：

- 商品评价整理
- 竞品卖点分析
- SKU 信息整合
- 上新监控
- 电商内容支持

核心交付：

- 商品评价摘要
- 竞品差异对照表
- 卖点清单
- 转化问题归因
- 商品内容素材草稿

#### `commerce_operations` 的主责角色

- `nerv-gendo`：业务目标翻译、活动/内容/直播策略拆解
- `nerv-misato`：跨节点编排、任务收口、最终交付
- `nerv-shinji`：整个运营体系的数据 lane 编排中枢
- `nerv-mari`：平台采集、页面/评论/账号/商品抓取
- `nerv-eva02`：变化监控、账号/商品/热点异动检测
- `nerv-eva03`：补充外部证据、竞品补搜、工具发现
- `nerv-eva00`：清洗、标签化、排序、聚类、评分
- `nerv-eva13`：平台文案、脚本、摘要、周报、卖点成稿
- `nerv-rei`：沉淀 SOP、话术、复盘经验

#### `commerce_operations` 的建议 skill pack

- `social-listening-pack`
- `platform-collector-pack`
- `social-copy-pack`
- `topic-ranking-pack`
- `live-script-pack`
- `objection-handling-pack`
- `livestream-monitor-pack`
- `replay-summary-pack`
- `ecommerce-collector-pack`
- `review-clustering-pack`
- `sku-brief-pack`
- `competitor-watch-pack`

#### `commerce_operations` 第一批 workflow

- 社媒选题流
- 热点日报流
- KOL 监控流
- 直播脚本生成流
- 直播复盘流
- 商品话术卡生成流
- 商品评价洞察流
- 竞品卖点跟踪流
- 上新摘要流

#### OpenClaw 对齐原则

这个 domain 只能建立在你当前 OpenClaw 可稳定调用的能力面上：

- `sessions_send`
- `exec`
- `read`
- `write`
- `memory_search`
- 已注册 skill / adapter

不假设不存在的浏览器常驻代理，不假设额外的 RPC 层，也不假设某个 Agent 会“自己学会”平台操作。

### 2. `project_ops`

适用场景：

- 多项目资源分配
- 任务优先级调整
- blocker 升级
- 周会纪要转任务
- 跨 Agent 协作编排

核心交付：

- 项目优先级建议
- 资源占用盘点
- blocker 报告
- 周会行动项
- 项目状态周报

主责角色：

- `nerv-gendo`：目标拆解、优先级判断
- `nerv-misato`：工作流编排、任务收口
- `nerv-rei`：历史经验检索
- `nerv-eva13`：周报、纪要、状态稿
- `nerv-seele`：仅在高风险审批链中出现

建议的 skill pack：

- `project-planning-pack`
- `meeting-to-task-pack`
- `resource-allocation-pack`
- `status-report-pack`

建议先做的 workflow：

- 会议转任务流
- 状态周报流
- 多项目排期流
- blocker 升级流

### 3. `finance_info`

适用场景：

- 财经新闻观察
- 行业政策监控
- 个股/板块观察名单摘要
- 市场重大事件提醒

核心交付：

- 财讯日报
- 政策摘要
- 观察名单变化提醒
- 风险提示卡片

主责角色：

- `nerv-shinji`：信息流编排
- `nerv-eva02`：变化监控与提醒
- `nerv-eva03`：补充深度搜索和证据
- `nerv-eva13`：摘要与卡片
- `nerv-seele`：只在外部发布或高敏判断时介入

边界说明：

- 只做信息服务，不做交易决策
- 不提供买卖建议
- 不把财经 domain 做成投资顾问人格

建议的 skill pack：

- `market-watch-pack`
- `policy-monitor-pack`
- `finance-summary-pack`

建议先做的 workflow：

- 财讯简报流
- 政策变化提醒流
- 观察名单摘要流

## 暂不优先进入的 Domain

以下领域目前不建议进入第一阶段：

- 重工程开发扩张
- 区块链 / 智能合约
- 嵌入式 / 硬件
- 游戏开发
- 重销售自动化

原因：

- 与你当前真实用户群不匹配
- 会显著拉高适配器和运维复杂度
- 对现有 NERV 价值不如内容、电商、协作类 domain 高

## Domain 与角色的挂载原则

### `nerv-gendo`

适合新增：

- 商业目标翻译
- campaign brief
- 直播/内容/运营项目策略框架
- 多项目优先级判断

不适合新增：

- 执行型技能
- 平台抓取
- 数据清洗

### `nerv-misato`

适合新增：

- 多项目 DAG 调度
- 资源冲突协调
- 任务收口与最终交付
- 模板化 workflow 调用

不适合新增：

- 内容生产
- 代码修复
- 深度数据处理

### `nerv-shinji`

适合新增：

- 所有结构化业务数据流入口
- commerce_operations / finance / repo 类数据 lane
- domain-specific collector orchestration

这会是整个 domain expansion 的关键枢纽。

### `nerv-eva02`

适合新增：

- 变化监控
- 覆盖率监控
- 账号/商品/财讯异动
- watchlist 触发

### `nerv-mari`

适合新增：

- 平台采集
- 评论抓取
- 商品页/达人页/账号页采集

### `nerv-eva00`

适合新增：

- 标签化
- 聚类
- 评分
- 评论分桶
- 选题排序
- 商品/竞品字段归一

### `nerv-eva13`

适合新增：

- 运营内容文案
- 直播脚本
- 商品卖点卡
- 周报/月报
- 平台适配成稿

### `nerv-rei`

适合新增：

- SOP 记忆
- 行业案例沉淀
- 爆款/复盘经验资产化

## 下一步输出物

`Domain Taxonomy v1` 确认后，下一阶段应该产出三类东西：

1. `skill-pack-registry-v1`
2. `workflow-template-catalog-v1`
3. `role-expansion-notes-v1`

只有这三类东西准备好之后，才应该回头修改 SOUL。

对应文档：

- `docs/skill-pack-registry-v1.md`
- `docs/workflow-template-catalog-v1.md`
- `docs/role-expansion-notes-v1.md`

对应资产目录：

- `skill-packs/commerce_operations/social_media/`
- `workflow-templates/commerce_operations/social_media/`
