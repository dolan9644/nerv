# Workflow Acceptance Suite v1

## 目标

`Workflow Acceptance Suite` 不是测试框架实现，而是 NERV 上线前的最低验收协议。

任何新 workflow 进入正式主链前，至少要通过一条标准样例，并满足：

- `DONE / PARTIAL / FAILED / TOOL_GAP` 终态清晰
- `task_id + dag_nodes + dag_edges + audit_logs` 完整
- Adam 只在整任务终态通知

## 第一批纳入对象

- `live-session-script`
- `live-replay-summary`
- `product-review-insight`
- `meeting-to-task`
- `finance-brief`
- `social-copy-studio`
- `social-topic-daily`

## 验收维度

### 1. 输入契约

- 缺少关键输入时必须稳定 `TOOL_GAP`
- 不允许 `eva13` 或其他成稿节点替用户脑补核心业务输入

### 2. 建图完整性

- 创建任务后必须能看到：
  - `tasks`
  - `dag_nodes`
  - `dag_edges`
  - `task_session_bindings`

### 3. 终态收敛

- 中间节点完成不得冒充任务完成
- 任一关键节点失败后，下游必须 `BLOCKED`
- recorder / spear 能把历史坏状态收回到可解释终态

### 4. 用户态交付

- `DONE`：有最终交付物，且 `sent.json` 或等价终态存在
- `PARTIAL`：明确说明只完成了哪一层
- `FAILED / TOOL_GAP`：明确卡点和修复方向

## 默认原则

- 先看完成度和失败表达
- 再看内容质量
- 没有标准样例，不允许标记为“已正式落地”
