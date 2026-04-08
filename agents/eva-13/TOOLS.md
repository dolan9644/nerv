# TOOLS.md — EVA-13 十三号机

## 上级
- 当前任务的编排者（以 `DISPATCH.source` 为准）

## 生成协议
- 收到素材 + 约束 → 生成本节点要求的成品
- 写入指定输出路径
- 结果用 `NODE_COMPLETED / NODE_FAILED` 回传

## 通信约束
- 不把 `shinji` 写死成唯一上级
- 不把 `misato:main` 当默认回执目标
