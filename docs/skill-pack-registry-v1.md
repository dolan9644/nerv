# NERV Skill Pack Registry v1

## 目标

`Skill Pack Registry v1` 用来回答三个问题：

1. 某个业务域到底需要哪些能力包
2. 这些能力包应该挂给谁主用、谁来衔接
3. 这些能力包的输入、输出和验收标准是什么

这里的 `skill pack` 不是新 Agent，也不是一长段 prompt。
它是一组可复用的能力说明，必须能被当前 OpenClaw / NERV 稳定调用。

## 设计约束

每个 skill pack 都必须明确：

- `domain`
- `subdomain`（如适用）
- `family`
- `primary_owner`
- `upstream`
- `downstream`
- 依赖的 OpenClaw 能力面
- 输入
- 输出
- 验收标准

默认能力边界：

- 只基于当前稳定能力：
  - `sessions_send`
  - `exec`
  - `read`
  - `write`
  - `memory_search`
  - 已注册 `skill / adapter`
- 不假设额外 RPC
- 不假设常驻浏览器代理
- 不假设某个 Agent 会在运行中自行学会新平台操作
- 未通过 `docs/reliability-model-v1.md` 的 Reliability Gate 前，不进入正式主链

## 能力缺口策略

当某个 skill pack 需要浏览器、exec 或平台私有适配器时，必须同时明确：

- `required_capabilities`
- `approved_fallbacks`
- `TOOL_GAP` 触发条件

原则是：

1. 先查当前已注册的 skill / adapter
2. 再查是否有官方或已验证的 MCP / adapter 可用
3. 如果主责 Agent 的 runtime 不具备该能力，禁止强派
4. 由 `Misato` 记录 `fallback_reason`，并改派到有能力的 Agent
5. 如果仍无可用能力，必须回传 `TOOL_GAP`，不要静默降级成“假完成”
6. 公开可验证、但需要自建服务的 RSS/API/browser 方案，也可以算作 `partial`，前提是已在平台能力目录登记

对 `commerce_operations / social_media`，还要额外服从：

- `docs/platform-capability-catalog-v1.md`
- 平台能力目录优先于人格直觉
- `compatible_agents` 只能说明“谁能挂 pack”，不能说明“这个平台已经可执行”

---

## 第一波：`commerce_operations / social_media`

### 1. `social-listening-pack`

| 项目 | 内容 |
|:-----|:-----|
| domain | `commerce_operations` |
| subdomain | `social_media` |
| family | `monitor` / `collect` |
| primary_owner | `nerv-eva02` |
| upstream | `nerv-misato` / `nerv-shinji` |
| downstream | `nerv-eva00` / `nerv-rei` |
| 作用 | 热点、话题、竞品账号、评论/反馈监听 |
| 输入 | 关键词、账号清单、平台清单、时间窗 |
| 输出 | `monitor.json` / `raw.json` |
| 依赖能力 | `sessions_send`, `read`, `write`, 监控类 skill / adapter |
| 验收标准 | 输出至少包含来源、时间、链接、摘要或正文片段、变化标记 |
| approved_sources | RSS / 已接入信号、self-hosted RSS/API、browser_mcp、官方或已验证公开 adapter / MCP |

能力缺口处理：

- `nerv-eva02` 只负责 RSS / 已接入信号的变化监控
- 需要浏览器 / exec / 搜索引擎补证据时，改派 `nerv-eva03`
- 如果某个平台需要官方或 Clawhub 已验证的 MCP / adapter，优先用已注册能力；没有就回传 `TOOL_GAP`
- 如果平台能力目录已登记为 `partial`，且对应 self-hosted RSS/API 服务已部署，则可以在主链中实例化

### 2. `platform-collector-pack`

| 项目 | 内容 |
|:-----|:-----|
| domain | `commerce_operations` |
| subdomain | `social_media` |
| family | `collect` |
| primary_owner | `nerv-mari` |
| upstream | `nerv-shinji` |
| downstream | `nerv-eva00` |
| 作用 | 微博/小红书/抖音等公开页面抓取 |
| 输入 | 平台、URL、账号、帖子、评论页、抓取约束 |
| 输出 | `raw.json` |
| 依赖能力 | `exec`, `read`, `write`, 已注册平台采集适配器 |
| 验收标准 | 输出结构化记录，至少含 `id/source/title|content/url/timestamp` |
| approved_sources | 官方 plugin / adapter / MCP、已验证公开采集 skill、公开可验证的 self-hosted RSS/API/browser 服务 |

能力缺口处理：

- 平台若存在官方/已验证 MCP 或 adapter，优先接入该能力
- 若平台采集需要浏览器或 exec，而主责 runtime 不具备，则不强派给当前节点
- `nerv-mari` 仅承担公开页抓取；若仍无法覆盖目标平台，回传 `TOOL_GAP`

### 3. `topic-ranking-pack`

| 项目 | 内容 |
|:-----|:-----|
| domain | `commerce_operations` |
| subdomain | `social_media` |
| family | `normalize` |
| primary_owner | `nerv-eva00` |
| upstream | `nerv-shinji` |
| downstream | `nerv-eva13` / `nerv-rei` |
| 作用 | 去重、打标、聚类、优先级、评论槽点/卖点排序 |
| 输入 | 原始数据或监控结果 |
| 输出 | `cleaned.json` / `ranked.json` |
| 依赖能力 | `read`, `write`, `schema_validator.py`、清洗逻辑 |
| 验收标准 | 记录数、去重后数量、分组标签、排序依据完整 |

### 4. `social-copy-pack`

| 项目 | 内容 |
|:-----|:-----|
| domain | `commerce_operations` |
| subdomain | `social_media` |
| family | `compose` |
| primary_owner | `nerv-eva13` |
| upstream | `nerv-eva00` / `nerv-shinji` |
| downstream | `nerv-misato` / `nerv-rei` |
| 作用 | 微博 / 小红书 / 抖音文案、短视频脚本、口播稿、选题成稿 |
| 输入 | `copy_brief.json` / `cleaned.json` / `ranked.json` / 风格与合规约束 |
| 输出 | `post_copy.md` / `title_options.md` / `video_script.md` / `voiceover_script.md` / `brief.md` |
| 依赖能力 | `read`, `write`, 当前会话 LLM |
| 验收标准 | 平台语感清楚、内容类型清楚、CTA 可执行、可直接交付用户 |

补充说明：

- 规格以 [social-copy-pack-spec-v1.md](/Users/dolan/.openclaw/nerv/docs/social-copy-pack-spec-v1.md) 为准
- `nerv-eva00` 先把目标、受众、风格、钩子、信息层级整理成 `copy_brief.json`
- `nerv-eva13` 再按 `content_type` 成稿，不允许同一套语感通吃微博 / 小红书 / 抖音
- 文案类输出必须区分：
  - 平台短文案
  - 视频脚本
  - 口播稿

---

## 第二波：`commerce_operations / live_commerce`

### 5. `live-script-pack`

| 项目 | 内容 |
|:-----|:-----|
| domain | `commerce_operations` |
| subdomain | `live_commerce` |
| family | `normalize` + `compose` |
| primary_owner | `nerv-eva13`（成稿） / `nerv-eva00`（结构化） |
| upstream | `nerv-gendo` / `nerv-misato` / `nerv-shinji` |
| downstream | `nerv-misato` / `nerv-rei` |
| 作用 | 直播脚本生成、商品讲解卡、CTA、异议回应结构化 |
| 输入 | `session_meta`、`product_list`、`promotion_and_benefits`、`live_goal`、`target_audience` |
| 输出 | `offer_pack.json`、`script.md`、`selling_points.md`、`cta.md` |
| 验收标准 | 主播可直接照着讲、运营可复核商品卖点和福利节奏、缺字段时稳定 `TOOL_GAP` |

补充说明：

- 规格以 [live-script-pack-spec-v1.md](/Users/dolan/.openclaw/nerv/docs/live-script-pack-spec-v1.md) 为准
- `nerv-eva00` 负责把手工输入收成真实商品卡、讲解顺序、异议映射、价格节奏
- `nerv-eva13` 负责把 `offer_pack.json` 成稿成主播可直接使用的台本
- 不允许 `offer_pack.json` 只有抽象槽位，也不允许 `script.md` 只有大纲

### 6. `objection-handling-pack`

| 项目 | 内容 |
|:-----|:-----|
| domain | `commerce_operations` |
| subdomain | `live_commerce` |
| family | `compose` / `normalize` |
| primary_owner | `nerv-eva13` |
| upstream | `nerv-eva00` / `nerv-shinji` |
| downstream | `nerv-rei` |
| 作用 | 用户异议分类、答复模板、话术库更新 |
| 输出 | `qa_bank.md` / `qa_bank.json` |
| 验收标准 | 能按异议类别检索和直接复用 |

### 7. `livestream-monitor-pack`

| 项目 | 内容 |
|:-----|:-----|
| domain | `commerce_operations` |
| subdomain | `live_commerce` |
| family | `monitor` |
| primary_owner | `nerv-eva02` |
| upstream | `nerv-shinji` |
| downstream | `nerv-eva00` / `nerv-eva13` |
| 作用 | 直播间评论、节奏、异常变化监控 |
| 输出 | `monitor.json` |
| 验收标准 | 能标记高优先级变化和异常波动 |

### 8. `replay-summary-pack`

| 项目 | 内容 |
|:-----|:-----|
| domain | `commerce_operations` |
| subdomain | `live_commerce` |
| family | `compose` / `memory` |
| primary_owner | `nerv-rei` |
| upstream | `nerv-eva13` / `nerv-shinji` |
| downstream | `nerv-gendo` / `nerv-misato` |
| 作用 | 直播复盘、经验沉淀、失败教训资产化 |
| 输出 | `replay_summary.md` / `memory_note.json` |
| 验收标准 | 至少提炼结论、问题、改进项三类信息 |

补充说明：

- 规格以 [replay-summary-pack-spec-v1.md](/Users/dolan/.openclaw/nerv/docs/replay-summary-pack-spec-v1.md) 为准
- `nerv-eva00` 负责把手工复盘、评论反馈和回放信息收成 `clustered.json`
- `nerv-eva13` 负责把聚类结果写成正式复盘稿和下一场行动清单
- 允许 `manual_review` 路径，不强依赖平台回放采集

---

## 第三波：`commerce_operations / ecommerce_ops`

### 9. `ecommerce-collector-pack`

| 项目 | 内容 |
|:-----|:-----|
| domain | `commerce_operations` |
| subdomain | `ecommerce_ops` |
| family | `collect` |
| primary_owner | `nerv-mari` |
| upstream | `nerv-shinji` |
| downstream | `nerv-eva00` |
| 作用 | 商品页、评价页、竞品页采集 |
| 输出 | `raw.json` |
| 验收标准 | 商品、评价、链接、时间、基础指标齐全 |

### 10. `review-clustering-pack`

| 项目 | 内容 |
|:-----|:-----|
| domain | `commerce_operations` |
| subdomain | `ecommerce_ops` |
| family | `normalize` |
| primary_owner | `nerv-eva00` |
| upstream | `nerv-shinji` |
| downstream | `nerv-eva13` / `nerv-rei` |
| 作用 | 评价聚类、痛点/卖点分桶、情绪标签 |
| 输出 | `clustered.json` |
| 验收标准 | 类别清楚，能支持后续文案和策略使用 |

补充说明：

- 规格以 [product-review-insight-spec-v1.md](/Users/dolan/.openclaw/nerv/docs/product-review-insight-spec-v1.md) 为准
- 第一条正式 workflow 是 `product-review-insight`
- `nerv-eva00` 负责形成 `selling_points.json` / `painpoints.json`

### 11. `sku-brief-pack`

| 项目 | 内容 |
|:-----|:-----|
| domain | `commerce_operations` |
| subdomain | `ecommerce_ops` |
| family | `compose` |
| primary_owner | `nerv-eva13` |
| upstream | `nerv-eva00` |
| downstream | `nerv-misato` |
| 作用 | 商品卖点卡、SKU 简报、上新说明 |
| 输出 | `sku_brief.md` |
| 验收标准 | 卖点明确、结构化、适合销售/内容侧直接使用 |

补充说明：

- 与 `review-clustering-pack` 共同服务 `product-review-insight`
- 规格以 [product-review-insight-spec-v1.md](/Users/dolan/.openclaw/nerv/docs/product-review-insight-spec-v1.md) 为准

### 12. `competitor-watch-pack`

| 项目 | 内容 |
|:-----|:-----|
| domain | `commerce_operations` |
| subdomain | `ecommerce_ops` |
| family | `monitor` / `compose` |
| primary_owner | `nerv-eva02` |
| upstream | `nerv-shinji` |
| downstream | `nerv-eva13` / `nerv-rei` |
| 作用 | 竞品卖点、活动、评价风向跟踪 |
| 输出 | `watch_summary.md` / `watch.json` |
| 验收标准 | 能输出变化摘要和重点差异 |

补充说明：

- 规格以 [competitor-watch-pack-spec-v1.md](/Users/dolan/.openclaw/nerv/docs/competitor-watch-pack-spec-v1.md) 为准
- 第一条正式 workflow 是 `competitor-watch`
- `nerv-eva00` 负责形成 `delta.json`
- `nerv-eva13` 负责写 `competitor_watch.md`

---

## 第二梯队：`project_ops`

### 13. `project-planning-pack`

| 项目 | 内容 |
|:-----|:-----|
| domain | `project_ops` |
| family | `translate` / `route` |
| primary_owner | `nerv-gendo` |
| upstream | 造物主 |
| downstream | `nerv-misato` |
| 作用 | 项目目标拆解、优先级初判、资源建议 |
| 输出 | `brief.md` / `dispatch.json` |
| 验收标准 | 能直接转交执行层，不需要二次脑补 |

### 14. `meeting-to-task-pack`

| 项目 | 内容 |
|:-----|:-----|
| domain | `project_ops` |
| family | `compose` / `route` |
| primary_owner | `nerv-misato` |
| upstream | `nerv-gendo` / 会议输入 |
| downstream | `nerv-eva13` / `nerv-rei` |
| 作用 | 会议纪要转任务、行动项落地 |
| 输出 | `tasks.md` / `tasks.json` |
| 验收标准 | 任务、责任人、截止时间明确 |

补充说明：

- 规格以 [meeting-to-task-pack-spec-v1.md](/Users/dolan/.openclaw/nerv/docs/meeting-to-task-pack-spec-v1.md) 为准
- 第一条正式 workflow 是 `meeting-to-task`
- `nerv-eva00` 负责结构化，`nerv-eva13` 负责状态稿和任务清单成稿

### 15. `resource-allocation-pack`

| 项目 | 内容 |
|:-----|:-----|
| domain | `project_ops` |
| family | `route` / `review` |
| primary_owner | `nerv-misato` |
| upstream | `nerv-gendo` |
| downstream | `nerv-eva13` |
| 作用 | 多项目资源冲突、排期、负载建议 |
| 输出 | `allocation.md` |
| 验收标准 | 有优先级依据和冲突说明 |

### 16. `status-report-pack`

| 项目 | 内容 |
|:-----|:-----|
| domain | `project_ops` |
| family | `compose` |
| primary_owner | `nerv-eva13` |
| upstream | `nerv-misato` / `nerv-rei` |
| downstream | 造物主 / 团队 |
| 作用 | 周报、项目状态稿、执行摘要 |
| 输出 | `weekly_report.md` |
| 验收标准 | 能直接发送，不是纯内部技术日志 |

补充说明：

- 第一轮先作为 `meeting-to-task` 的下游成稿能力出现
- 不单独要求先做多项目 PM 自动化
- 规格以 [status-report-pack-spec-v1.md](/Users/dolan/.openclaw/nerv/docs/status-report-pack-spec-v1.md) 为准
- 第一条正式 workflow 是 `status-report`
- `nerv-eva00` 负责形成 `status_snapshot.json` / `blockers.json`
- `nerv-eva13` 负责成稿 `weekly_report.md` / `summary_card.md`

---

## 第二梯队：`finance_info`

### 17. `market-watch-pack`

| 项目 | 内容 |
|:-----|:-----|
| domain | `finance_info` |
| family | `monitor` |
| primary_owner | `nerv-eva02` |
| upstream | `nerv-shinji` |
| downstream | `nerv-eva13` |
| 作用 | 财讯、行业、观察名单变化监控 |
| 输出 | `watch.json` |
| 验收标准 | 有来源、时间、变化摘要，不给交易建议 |

补充说明：

- 第一条正式 workflow 是 `finance-brief`
- 规格以 [finance-brief-spec-v1.md](/Users/dolan/.openclaw/nerv/docs/finance-brief-spec-v1.md) 为准
- 只做 signal-only 信息服务，不做交易判断

### 18. `policy-monitor-pack`

| 项目 | 内容 |
|:-----|:-----|
| domain | `finance_info` |
| family | `collect` / `search` |
| primary_owner | `nerv-shinji` |
| upstream | `nerv-misato` |
| downstream | `nerv-eva03` / `nerv-eva13` |
| 作用 | 政策、监管、行业规则变化采集与补证据 |
| 输出 | `policy_raw.json` / `policy_note.md` |
| 验收标准 | 信息源明确，摘要和原文链路可追溯 |

### 19. `finance-summary-pack`

| 项目 | 内容 |
|:-----|:-----|
| domain | `finance_info` |
| family | `compose` |
| primary_owner | `nerv-eva13` |
| upstream | `nerv-shinji` / `nerv-eva03` |
| downstream | `nerv-misato` / `nerv-rei` |
| 作用 | 财讯摘要、政策卡片、观察名单简报 |
| 输出 | `summary.md` / `card.md` |
| 验收标准 | 信息服务为主，不出现买卖建议语言 |

补充说明：

- 在第一轮里，以 `finance-brief` 的成稿层落地
- 规格以 [finance-brief-spec-v1.md](/Users/dolan/.openclaw/nerv/docs/finance-brief-spec-v1.md) 为准

---

## 落地顺序

1. 保持 `commerce_operations / social_media` 主线稳定
2. 收口 `live-session-script`，补上 `live-replay-summary`
3. 启动 `ecommerce_ops` 第一条 workflow：`product-review-insight`
4. 同步启动 `project_ops` 第一条 workflow：`meeting-to-task`
5. 同步启动 `finance_info` 第一条 workflow：`finance-brief`
6. 所有新增 pack/template 先过 Reliability Gate，再谈深度打磨

## 使用规则

- skill pack 是能力编排层，不是新 Agent
- skill pack 先服务 workflow，再回写 SOUL
- 没有真实 workflow 验证的 pack，不算完成
