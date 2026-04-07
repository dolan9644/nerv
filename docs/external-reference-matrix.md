# 外部参考映射矩阵 v1

## 目标

把 `agency-agents` 固化成 NERV 的外部职业能力参考源。它提供的是职业角色、交付物和交接模板，不是 NERV 的运行时架构。

## 映射原则

| 放置层 | 允许吸收 | 不允许直接吸收 |
|:--|:--|:--|
| `领域包` | 业务分层、角色群组、交付范围 | 原仓库的组织结构 |
| `技能包` | 稳定动作、评估/审计/报表/复盘模板 | 整份职业提示词 |
| `工作流模板` | 交接模板、阶段手册、质量闸门、报告流 | 原始多角色链路照搬 |
| `SOUL 边界` | 角色边界、成功标准、风险偏好、不该做什么 | 表单字段、冗长 SOP、报表正文 |

## 高优先级映射

### 1. `commerce_operations`

| 来源类型 | 适用来源 | 进入 NERV 的位置 | 备注 |
|:--|:--|:--|:--|
| 领域包 | 市场营销、投放、销售、电商运营类角色 | `commerce_operations` | 作为运营、电商、投放、转化统一域 |
| 技能包 | 追踪审计、活动复盘、流程分析、提案结构 | `social-listening-pack`、`platform-collector-pack` 后续子包 | 只吸收稳定动作 |
| 工作流模板 | 交接、跨平台报告、活动复盘、提案流程 | `social-topic-daily`、后续 `live_commerce` / `ecommerce_ops` | 要翻译成 task/artifact 语义 |
| SOUL 边界 | 转化优先、合规优先、复盘闭环、渠道差异意识 | `eva00 / eva13 / mari / misato / gendo` | 不放具体渠道 SOP |

推荐吸收方向：
- 中国电商运营、直播运营、跨境运营、私域运营
- 投放追踪与效果复盘
- 销售提案结构和流程健康度

### 2. `project_ops`

| 来源类型 | 适用来源 | 进入 NERV 的位置 | 备注 |
|:--|:--|:--|:--|
| 领域包 | 项目管理、协同推进类角色 | `project_ops` | 未来多项目编排主来源 |
| 技能包 | 项目章程、WBS、风险登记、状态周报、会议转任务 | 后续 `project-planning-pack` 等 | 适合模板化 |
| 工作流模板 | 交接模板、阶段手册、带记忆的工作流 | DAG 模板 | 最接近 NERV 编排层 |
| SOUL 边界 | 不跳过质量闸门、所有交接必须留上下文 | `misato / shinji / gendo` | 只放原则 |

### 3. `finance_info`

| 来源类型 | 适用来源 | 进入 NERV 的位置 | 备注 |
|:--|:--|:--|:--|
| 领域包 | 财务、分析、管理摘要类角色 | `finance_info` | 只做信息服务 |
| 技能包 | 财务跟踪、商业分析报表、异常分析、摘要生成 | 后续 `market-watch-pack` 和财讯/分析子包 | 不变成投资顾问 |
| 工作流模板 | 数据校验 → 汇总 → 报告 → 分发 | 财讯类工作流 | 强依赖 contract 和 audit |
| SOUL 边界 | 保守表述、审计轨迹、准确性优先 | `rei / misato / gendo / shinji` | 不写具体公式表格 |

## 可复用模板类型

这些是从 `agency-agents` 最值得吸收的结构，不是人设台词：

- 交接模板
- 阶段手册
- 质量闸门 / 通过-失败判定
- 报告模板
- 带记忆的工作流
- 项目章程
- 管理摘要

## 明确不直接复用的部分

- 整份职业 prompt 直接进 `SOUL`
- 原仓库的 agent 组织方式
- 过重的人设台词
- 与 OpenClaw / NERV 不兼容的工具假设

## 默认顺序

1. `commerce_operations`
2. `project_ops`
3. `finance_info`

后续任何映射都必须先通过 [`reliability-model-v1.md`](./reliability-model-v1.md) 的 Reliability Gate。
