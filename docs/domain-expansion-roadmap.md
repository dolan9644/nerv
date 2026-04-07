# NERV Domain Expansion Roadmap

## 项目目标

在不增加 Agent 数量的前提下，扩张 NERV 的业务覆盖面，并保证：

1. 角色边界不乱
2. prompt 不膨胀
3. 路由不退化
4. skill 与 workflow 可持续扩展

## 总原则

- 先稳控制面，再扩业务面
- 先做 taxonomy，再做 skill pack，再做 workflow
- 先做模板，再做自动化固化
- 行业能力优先进入 `skill + workflow`，最后才考虑写进 SOUL

## Phase 0：保持现有链路稳定

目标：

- 继续验证现有路由矩阵
- 继续验证 `sessions_send`、`session_recorder`、`spear_sync`、`adam_notifier`
- 确保扩张前主链路稳定

完成标准：

- 至少 2 条不同类型 DAG 能稳定闭环
- `nerv.db` 状态与产物状态一致
- 主要角色无明显错路由

## Phase 1：建立 Domain 抽象

目标：

- 正式引入 `domain`
- 确立一级 domain 清单
- 为每个 domain 指定主责角色和候选 skill pack

产物：

- `domain-taxonomy-v1.md`
- `ROUTING_MATRIX` 中的 domain 维度说明

## Phase 2：建立 Skill Pack Registry

目标：

- 把领域能力从 prompt 中剥离出来
- 形成按 domain 分组的技能清单

建议结构：

- `social-listening-pack`
- `platform-collector-pack`
- `topic-ranking-pack`
- `social-copy-pack`
- `live-script-pack`
- `ecommerce-collector-pack`
- `project-planning-pack`
- `market-watch-pack`

每个 skill pack 需要明确：

- 适用 domain
- 主责角色
- 输入输出契约
- 对应 workflow 节点

## Phase 3：建立 Workflow Template Catalog

目标：

- 把高频业务做成模板
- 降低每次从零拆 DAG 的成本

第一批推荐模板：

1. 社媒内容工厂流
2. 直播复盘流
3. 商品评价洞察流
4. 会议转任务流
5. 财讯简报流

每个模板至少包含：

- 适用场景
- 节点顺序
- canonical owner
- 输入输出 artifact
- fallback 策略

## Phase 4：回写角色说明

目标：

- 只把确实稳定下来的角色扩张写进 SOUL
- 不把具体行业流程塞成 prompt 污染

应该写进 SOUL 的内容：

- 新的职责边界
- 路由原则
- 哪些 domain 归谁主责

不应该写进 SOUL 的内容：

- 具体平台操作步骤
- 具体 campaign 细节
- 每一个 workflow 的逐步脚本

## 第一批优先级

### P1

- `commerce_operations / social_media`

### P2

- `commerce_operations / live_commerce`
- `commerce_operations / ecommerce_ops`
- `project_ops`
- `finance_info`

## `live_commerce` 下一步

`social_media` 跑通后，下一条优先业务线不是继续加平台 smoke，而是正式进入 `live_commerce`。

第一条 roadmap 固定为：

- `live-session-script`

原因：

- 不强依赖平台采集
- 不依赖常驻浏览器
- 输入可以直接来自用户商品信息和活动目标
- 最容易形成真实可交付产物

建议顺序：

1. 先跑 `live-session-script`
2. 再做 `live-replay-summary`
3. 同步启动 `ecommerce_ops / project_ops / finance_info` 各自第一条模板
4. 最后做 `live-objection-bank`

对应文档：

- `docs/live-commerce-roadmap-v1.md`

### 暂缓

- 重工程开发域
- 高维护成本的专业技术域

## 风险控制

### 风险 1：SOUL 再次膨胀

应对：

- 行业细节只放 skill pack / workflow template
- SOUL 只写边界和原则

### 风险 2：错路由复发

应对：

- 任何新增 domain 先挂 `ROUTING_MATRIX`
- 先指定 canonical owner，再讨论工具

### 风险 3：系统能聊但不能跑

应对：

- 每个新模板先跑至少 1 条真实 DAG
- 必须验证 recorder / db / notifier / runtime 收敛

## 接下来建议的实际顺序

1. 确认 `domain-taxonomy-v1`
2. 产出 `skill-pack-registry-v1`
3. 产出 `workflow-template-catalog-v1`
4. 产出 `role-expansion-notes-v1`
5. 在 `skill-packs/` 和 `workflow-templates/` 下落第一批可引用资产
6. 选一个 P1 workflow 先做
7. 先跑通一条真实 workflow
8. 再扩第二条

## 下一轮执行清单

为了避免后续推进时只盯着单个 DAG，下一轮的具体承接清单单独放在：

- `docs/next-round-actions-v1.md`
- `docs/reliability-model-v1.md`
- `docs/external-reference-matrix.md`
- `docs/openharness-adoption-matrix.md`
- `docs/external-references.md`

这份清单的作用是：

- 固定下一轮优先级
- 明确哪些线是收口，哪些线是扩张
- 给后续所有 domain / skill / workflow 扩张提供统一可靠性底座
- 防止 `ecommerce_ops / project_ops / finance_info` 这些已立项板块被遗忘
- 固定外部参考项目的吸收边界，避免后续变成“想到什么抄什么”
