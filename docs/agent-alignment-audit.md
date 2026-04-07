# Agent 对齐审计 v1

## 结论

当前 NERV 最大的问题不是功能不足，而是 `文档 / 配置 / 实际能力` 还没有完全收成同一个事实源。

本次审计确认的高优先级结构性问题如下。

## 关键断点

### 1. sandbox 宣称与实际运行面不一致

- 文档和部分注册注释曾把多名作战层 Agent 描述为强 sandbox / 容器执行
- 但当前稳定运行面仍以宿主机执行为主
- 当前收敛策略：
  - 文档降级为“宿主机默认，sandbox 仅在运行面可用时启用”
  - 不在配置层继续做虚假承诺

### 2. skill 可发现路径不统一

当前同时存在：
- `nerv/skills`
- `agents/misato/SKILLS`
- OpenClaw 原生 `<workspace>/skills`

收敛策略：
- 统一通过 `skills.load.extraDirs` 挂载 NERV 自定义 skill roots
- scanner 和 install 都以这套路径为准

### 3. skill 声明和实体实现可能漂移

- 有些 skill 名出现在 config / workflow / pack 中
- 但用户运行时未必真的能被 registry 发现

收敛策略：
- healthcheck 增加 declared-skill vs registry 对齐检查
- 后续新增 skill 必须经过 Reliability Gate

### 4. Router Agent 权限偏宽

`misato / gendo` 当前仍拥有一定 `exec` / `write` 能力。

当前默认：
- 先不贸然削权限，避免破坏现有 DAG
- 但后续要建立控制面角色权限原则，并逐步下放执行权

### 5. 文档事实源过多

当前规则分散在：
- README
- ROUTING_MATRIX
- COMMS
- workflow template
- skill pack
- SOUL

收敛策略：
- owner/route 以 `ROUTING_MATRIX` 为准
- workflow 以 template 为准
- skill 以 frontmatter/registry 为准
- README 只负责解释，不再独立定义运行规则

## 立即执行的默认值

- 默认宿主机执行，不宣称全量 sandbox
- 默认通过 `skills.load.extraDirs` 暴露 NERV skill roots
- 默认由 `Misato` 做复杂任务自动任务化
- 默认以 DB / artifact / audit 为跨天恢复依据

## 后续重点

1. 继续收紧 `misato / gendo` 权限边界
2. 让 skill/frontmatter 成为 `compatible_agents` 的优先事实源
3. 减少 README / SOUL / workflow 的重复定义
