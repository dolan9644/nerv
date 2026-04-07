# Runtime Drift Detection v1

## 目标

`runtime drift` 指的是：文档、模板、DB、runtime、实际派发行为之间不一致。

NERV 下一阶段扩张后，最容易出现的漂移不是“没有功能”，而是“写了模板，但运行时没按模板跑”。

## 当前必须监控的漂移类型

### 1. session 漂移

- task 声明 `task_scoped`
- 但实际节点 dispatch 到 `main`

### 2. owner 漂移

- template / registry 里的 `canonical owner`
- 与实际 `dag_nodes.agent_id`
- 或 runtime skill 能力不一致

### 3. skill 漂移

- registry / config 声明了 skill
- 但 scanner / runtime registry 找不到实体

### 4. template 漂移

- workflow 已在 catalog 标记为正式
- 但对应 template / Misato skill 不存在

### 5. terminal state 漂移

- 节点失败但下游仍处于 `PENDING`
- 中间节点成功却触发整任务通知

## 第一批强制检查对象

- `live-session-script`
- `live-replay-summary`
- `product-review-insight`
- `meeting-to-task`
- `finance-brief`

## 当前 task-scoped 覆盖事实

已在真实任务里看到 `task:<task_id>` 会话绑定的 agent：

- `nerv-eva00`
- `nerv-eva03`
- `nerv-eva13`
- `nerv-misato`
- `nerv-rei`

当前还不能宣称“已完成 task-scoped 验证”的 agent：

- `nerv-shinji`
- `nerv-mari`
- `nerv-eva02`

说明：

- 这不等于它们不能用
- 只表示在第一批新 workflow 的真实样例里，还没有拿到足够的 task-scoped 运行证据
- 特别是 `nerv-shinji`：当前很多文档把它写成数据 lane 中枢，但第一批模板并没有把它建成显式节点，容易被误判成“收不到消息”

## healthcheck 最低要求

- 能发现缺失 template / skill 资产
- 能发现 `task_scoped -> main` 的 session 漂移
- 能发现 declared skill 不可发现
- 能发现活跃任务缺少 orchestrator session

## 默认原则

- 没被 healthcheck 看见的能力，不算可靠
- 没被 recorder / spear / notifier 接住的 workflow，不进入正式主链
