# NERV 平台能力接入与 Tool Gap 处理

## Idea
平台接入不是“能搜到就能跑”，而是先过 capability gate，再决定是否实例化 collect/monitor 节点。

## 核心逻辑
- 先查平台能力目录，再建 DAG。
- 平台状态只允许：
  - `ready`
  - `partial`
  - `gap`
  - `gap_private_only`
- `ready / partial` 才允许创建执行型节点。
- `gap / gap_private_only` 必须直接返回 `TOOL_GAP`，不能硬派。

## 关键协议
```text
sessions_send(sessionKey="agent:<agentId>:task:<task_id>", timeoutSeconds=0)
```

```json
{
  "event": "TOOL_GAP",
  "payload": {
    "missing_capability": "...",
    "gap_type": "runtime_execution_failure"
  }
}
```

## 平台接入原则
- `signal_only`：只消费 RSS / 已接入信号。
- `signal_plus_collect`：仅在 collect 能力确认可用时升级。
- `platform_smoke`：只做能力验证，不冒充正式业务链。

## 已验证约束
- 小红书 smoke 成功不等于正式监控能力成立。
- `follow-builders X` 不进入正式默认主链。
- 命中验证码、登录态失效、IP 风控时必须显式失败，不允许伪装成功。
