# OpenHarness 吸收矩阵 v1

## 目标

把 `OpenHarness` 固化成 NERV 的外部 Harness 参考源。NERV 不替换 OpenClaw，只吸收对当前控制面真正有用的部分。

## 可直接借鉴

| 能力 | 为什么适合 | 对应到 NERV |
|:--|:--|:--|
| 后台任务生命周期 | 与 NERV 的异步 DAG 语义高度接近 | `task_id`、终态、notifier 收敛 |
| 会话恢复 / 历史恢复 | 适合作为 task-scoped session 的参考 | `orchestrator_session_key`、worker session 恢复 |
| 权限模式 / 路径规则 / 命令黑名单 | 与 NERV 当前权限收敛目标一致 | runtime/tool allow-deny、未来更细的策略 |
| 插件 / skill 发现机制 | 解决 NERV 当前 skill 路径漂移问题 | `skills.load.extraDirs`、scanner/source registry |
| 安装 / 配置 / 验证 | 能直接改善 NERV 安装体验 | post-install validation、依赖检查 |
| 测试 / 子系统健康检查 | 与 NERV `harness_healthcheck` 方向一致 | recorder/spear/notifier/install acceptance |

## 需要翻译后借鉴

| 能力 | 为什么不能直接照搬 | 翻译后的 NERV 方向 |
|:--|:--|:--|
| 工具 / 任务 / MCP 总线 | OpenHarness 自己的 tool/runtime 不是 OpenClaw | 只借任务/工具治理模型，不替换工具层 |
| hook 机制 | NERV 没有一模一样的 hook 生命周期 | 翻成 recorder/spear/pre-dispatch validation |
| team / subagent 基元 | OpenHarness 自带 team/task 模型 | 映射到 `Misato + task_id + dag_nodes` |
| schedule / cron 基元 | OpenHarness 的 schedule 子系统不同 | 映射到 NERV cron + infra jobs |

## 不适合引入

| 能力 | 不引入原因 |
|:--|:--|
| OpenHarness 自己的 agent loop | 会与 OpenClaw 核心 loop 重叠，替换成本高 |
| provider/profile stack | NERV 已建立在 OpenClaw provider/runtime 之上 |
| TUI / personal-agent app (`ohmo`) | 不属于 NERV 的核心价值，且会分散主线 |
| 把 OpenHarness 作为直接依赖 | 会让 NERV 从“参考整合”变成“第二运行时” |

## 当前优先吸收方向

1. install/setup validation
2. task / session lifecycle 设计
3. permission / governance 模型
4. plugin/skill discoverability
5. 面向子系统的测试与健康报告

## 明确边界

- 不引入 OpenHarness 作为 NERV 的直接依赖
- 不替换 OpenClaw 的 provider、loop、CLI、TUI
- 只把它作为 Harness 设计参考，服务于 NERV 的控制面强化
