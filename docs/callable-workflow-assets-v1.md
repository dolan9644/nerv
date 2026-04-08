# NERV 可调用工作流资产 v1

## 目标

这份资产层不是给用户看的世界观，而是给入口 Agent 用的硬导航。

原则只有一句：

- `Gendo / Misato` 不应该靠长 SOUL 记住固定 workflow
- 而应该先查 `workflow-navigation-registry-v1.json`
- 再决定走模板实例化，还是走固定建图脚本

## 组成

### 1. 工作流导航注册表

路径：

- `docs/workflow-navigation-registry-v1.json`

它回答 3 个问题：

1. 这个需求更像哪条固定 workflow
2. 这条 workflow 的模板、规格、Misato skill 在哪里
3. 它应该走模板实例化还是固定 builder script

### 2. 工作流解析器

路径：

- `scripts/tools/resolve_workflow_assets.js`

它的作用不是建图，而是把中文需求或 `workflow_id` 解析成明确资产路径。

### 3. 运行时校验

`harness_healthcheck.js` 必须校验：

- 注册表存在
- 每条 workflow 的路径存在
- 模板模式必须有 template
- builder 模式必须有脚本
- Misato skill 和规格路径不能断

## 对 Gendo 的要求

- 固定 workflow 优先查资产，再出草案
- 用户要求“改 DAG”时，优先对照已有 workflow 资产输出差异，而不是从记忆里重写整条链
- 只有在未命中固定 workflow 或用户明确要新链路时，才走一次性 DAG 草案

## 对 Misato 的要求

- 固定 workflow 优先查资产，再实例化
- 模板 workflow 不得自由改写主节点顺序
- builder workflow 不得绕过固定建图脚本
- 续推必须继续走 `get_ready_dispatches.js`

## 这层资产的意义

它的价值不是“又多一份文档”，而是：

- SOUL 可以继续瘦
- 入口能力不会随瘦身一起丢
- 固定 workflow 可以被机器验证、被健康检查发现、被脚本稳定调用
