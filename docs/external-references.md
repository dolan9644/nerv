# 外部参考说明

## 目的

NERV 明确参考外部开源项目，但参考方式是“吸收结构与经验”，不是“直接复制架构”。

## 参考项目

### 1. `agency-agents`

仓库：
- [msitarzewski/agency-agents](https://github.com/msitarzewski/agency-agents)

NERV 的吸收方式：
- 作为职业角色、交付物结构、交接模板与阶段手册的设计参考
- 为 `commerce_operations / project_ops / finance_info` 提供外部职业能力素材库

不直接复用的部分：
- 原始 agent 组织方式
- 整份职业 prompt
- 过重的人设/长上下文

### 2. `OpenHarness`

仓库：
- [HKUDS/OpenHarness](https://github.com/HKUDS/OpenHarness)

NERV 的吸收方式：
- 作为 Harness 的任务、权限、技能发现、安装体验和可观测性设计参考
- 用于收紧 NERV 的控制面与安装体验

不直接复用的部分：
- OpenHarness 自己的 agent loop
- provider/profile stack
- TUI / ohmo
- 作为 NERV 的直接运行时依赖

## 差异说明

NERV：
- 建立在 OpenClaw 之上
- 强调 `task_id / DB truth source / recorder / spear / notifier`
- 以 DAG 和 workflow template 为主线

外部项目的作用：
- `agency-agents`：给业务和角色结构参考
- `OpenHarness`：给 Harness 和产品化底座参考

## 约束

任何外部参考进入正式主链之前，都必须先经过：
- [`reliability-model-v1.md`](./reliability-model-v1.md)
- skill / workflow / domain 的 Reliability Gate
