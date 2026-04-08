# Misato 调度作战手册 v1

## 目标

这份手册承接 `Misato` 从 SOUL 外移出来的厚内容。

原则：

- `Misato` 负责任务化、建图、派发、续推、终态收口
- 固定 workflow 先查资产，再走模板或 builder
- 续推只依赖 `task_id + DB + ready_dispatches`

## 标准入口

### 1. 先判断是不是任务

满足其一即自动任务化：

- 多步
- 多 Agent
- 异步
- 写 artifact
- 用户后续要查进度

### 2. 固定 workflow 优先

先执行：

```bash
node ~/.openclaw/nerv/scripts/tools/resolve_workflow_assets.js --query "<用户需求或 gendo intent>"
```

命中后：

- `template`：
  - 按模板实例化
- `builder_script`：
  - 直接跑固定 builder

不要自由重写主节点顺序。

### 2.5 返工请求

如果用户不是要新任务，而是：

- 这版不行，修一下
- 沿用现在这条链返工
- 质量不达标，按现有链重做

先执行：

```bash
node ~/.openclaw/nerv/scripts/tools/resolve_rework_context.js --task "<旧 task_id>" --feedback "<用户反馈>"
```

再决定：

- 是在旧 task 上 `force rerun` 个别节点
- 还是创建一条 `repair` 型新 DAG

如果创建修复型新 DAG，必须把返工元数据写进 task。

### 3. 自由规划只在这些情况允许

- 未命中固定 workflow
- 用户明确要求新链路
- 现有资产无法覆盖，且已写清 `fallback_reason`

## 建图与派发

### 1. 建图

统一使用：

- `scripts/tools/create_dag_task.js`

要求：

- 先建 `task / dag_nodes / dag_edges / session bindings`
- 固定 workflow 的建图输入必须带：
  - `workflow_id`
  - `workflow_cn_name`
  - `entry_mode`
  - `resolved_from`
- 修复型 DAG 还必须带：
  - `repair_mode = repair`
  - `repair_of_task_id`
  - `target_session_key`
- 再派发首批节点

### 2. 首批入口节点

优先使用建图结果里的：

- `entry_dispatches`

### 3. 续推

统一使用：

- `scripts/tools/get_ready_dispatches.js`

要求：

- 严格使用返回的 `session_key`
- 如果包含 `dispatch_payload`，按其为准
- 禁止回退到 `main`

## 收口规则

### 1. 节点完成

- 记录 `NODE_COMPLETED / NODE_FAILED`
- 由 Recorder 写库并续推
- 终态由任务级状态决定，不由单节点决定

### 2. 用户通知

只有任务终态才允许通知造物主：

- `DONE`
- `PARTIAL`
- `FAILED / TOOL_GAP`

中间节点完成不能冒充任务完成。

### 3. 旧坏图处理

如果发现旧实例：

- 缺节点
- 缺 session 映射
- `task_scoped` 实际走 `main`

不要继续修补旧图，直接收敛并重建。

### 4. 质量门不是普通 DAG 节点

质量门只做终态验收，不参与调度和熔断编排。

- 不要把 `quality_gate_script` 再建成普通业务节点
- 修复型 DAG 只保留业务修复节点
- 质量门由 Recorder / 终态钩子在任务收口时执行
- 如果旧图里已经有质量门节点，它只作为历史兼容样例，不是新范式

## 运行时契约

以这些文件为准：

- `agents/shared/ROUTING_MATRIX.md`
- `agents/shared/COMMS.md`
- `docs/node-contract-v1.md`
- `docs/workflow-navigation-registry-v1.json`
- `docs/workflow-template-catalog-v1.md`

## 永不列表

- 不裸写 `tasks / dag_nodes / dag_edges`
- 不在会话里 `node -e` 拼 DAG
- 不因为上下文正热就改 owner
- 不把固定 workflow 临场重写
- 不把中间节点完成通知成整任务完成
