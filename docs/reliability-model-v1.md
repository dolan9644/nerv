# NERV Reliability Model v1

## 目标

NERV 的目标不是“永不失败”，而是让复杂任务在用户不理解内部结构的情况下，仍然能被系统稳定接单、稳定执行、稳定收敛。

用户只应看到：

- 已接单
- 正在处理
- 完成
- 明确失败 / 缺口

用户不需要理解：

- `task_id`
- `dispatch_id`
- sessionKey
- `nerv.db`

这些都属于控制面职责。

## 核心原则

### 1. 复杂请求自动任务化

满足任一条件就必须自动创建 `task_id`：

- 多步执行
- 多 Agent 协作
- 异步执行
- 写 artifact
- 后续需要追踪进度 / 结果

简单问答和即时状态查询继续留在 `main session`。

### 2. session 是执行容器，不是任务真相

任务型请求默认使用：

- orchestrator: `agent:nerv-misato:task:<task_id>`
- worker: `agent:<agent_id>:task:<task_id>`

单轮问答继续使用：

- `agent:<agent_id>:main`

跨天恢复时，只允许依赖：

- `tasks`
- `dag_nodes`
- `audit_logs`
- artifact 路径

禁止依赖 memory 或旧聊天上下文去猜任务进度。

### 3. DB 是唯一真相源

任何 DAG 派发必须满足：

1. `tasks` 已创建
2. `dag_nodes` 已写全
3. `dag_edges` 已写全
4. session 映射已落库
5. dispatch audit 已可追踪
6. 然后才允许派发第一个节点

### 4. Agent 只做节点，不定义整任务成功

- `Gendo` 只做草案和策略建议
- `Misato` 负责任务化、建图、派发、终态收敛
- 终端 Agent 只负责本节点输入/输出和 `NODE_COMPLETED / NODE_FAILED`
- `session_recorder` / `spear_sync` / `Adam Notifier` 负责控制面收敛

### 5. 失败必须被系统自己发现和表达

系统必须自己完成：

- 派发前校验
- 运行中对账和孤儿修复
- 失败阻断下游
- 终态通知收敛

禁止 silent failure。

## 自查自纠三层模型

### 派发前校验

- DAG 完整
- owner 符合 routing matrix
- skill/runtime 能执行
- 输入契约齐全
- 平台能力满足

不满足直接 `TOOL_GAP`。

### 运行中纠偏

- orphan 检测
- 漏调度检测
- stale / timeout 检测
- 下游自动 `BLOCKED`
- recorder 对账修正漂移状态

### 用户态收敛

对用户只允许暴露：

- `DONE`
- `PARTIAL`
- `FAILED / TOOL_GAP`

中间节点成功不得冒充整任务成功。

## Reliability Gate

任何新进入主链的 `domain / skill pack / workflow template` 都必须满足：

- 明确输入契约
- 明确输出 artifact
- 明确 canonical owner
- 明确 node contract
- 明确失败路径 / 降级路径
- recorder 能识别
- spear 能对齐
- notifier 能正确表达终态
- 至少有一条标准样例跑过
- 不依赖用户理解内部结构

当前优先应用对象：

- `live-session-script`
- `social-topic-daily`

后续扩展对象：

- `live-replay-summary`
- `ecommerce_ops`
- `project_ops`
- `finance_info`

## 当前 v1 边界

- 不修改 OpenClaw 核心机制
- 不新增 Agent
- `task-scoped session` 只覆盖异步 DAG 任务
- SQLite 继续作为底层存储
- `Misato` 继续作为唯一用户态接单入口
