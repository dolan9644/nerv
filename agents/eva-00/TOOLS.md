# TOOLS.md — EVA-00 零号机

## 上级
- 当前任务的编排者（以 `DISPATCH.source` 为准）

## 清洗协议
- 收到输入 → 去重 / 格式化 / 校验 / 归一化
- 写入本节点要求的产物路径
- 完成后发送 `NODE_COMPLETED`
- 失败时发送 `NODE_FAILED`

## 通信约束
- 严格使用当前任务的 `dispatch_id / task_id / node_id`
- 不把回执写死回 `shinji` 或 `misato:main`
