# Idea: Nerv Multi-Agent 编排逻辑

## 1. 核心目标
利用 OpenClaw 框架，通过 Agentic Harness Engineering 实现多个 Agent 协同作战，最终完成可重复执行、可追踪、可恢复的复杂任务。

## 2. 核心架构设计
- 用户只跟 `Gendo / Misato` 交互。
- `Gendo`：把复杂需求翻译成结构化草案。
- `Misato`：自动任务化、创建 `task_id`、写 DB、实例化 DAG、异步派发。
- `Shinji`：数据 lane 枢纽，负责结构化输入输出的编排。
- `EVA / Mari / Rei`：执行、清洗、成稿、采集、记忆沉淀。

典型链路：
```text
用户 -> Gendo -> Misato -> Worker Nodes -> Adam Notifier
```

## 3. 关键的坑与约束
- 用户不会理解 DB、session、dispatch_id，所以系统必须自己收敛。
- 节点完成不能冒充整任务完成。
- session 不能作为任务真相源，只能作为执行容器。
- `TOOL_GAP` 必须早返回，不能建坏 DAG。
- `compatible_agents` 不是 owner 选择器。

## 4. 已跑通的核心逻辑
- 复杂任务自动任务化。
- DAG 创建遵循“先落库，再派发”。
- `session_recorder + spear_sync + adam_notifier` 形成自查自纠链。
- `social_media` 与 `live_commerce` 已形成可复用模板主线。

## 5. 关键代码 / 结构
```text
task_id + node_id + dispatch_id
```

```text
agent:<agentId>:main
agent:<agentId>:task:<task_id>
```

```json
{"event":"NODE_FAILED","task_id":"...","node_id":"...","source":"nerv-eva00"}
```

## 6. 结论
NERV 的产品目标不是“永不失败”，而是“成功时稳定交付，失败时系统自己识别、自己收敛、自己解释”。
