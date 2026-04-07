# NERV 终态收敛教训：晨报、翻译、通知

## Idea
多 Agent 系统最容易假成功。真正要收敛的不是“有没有人回消息”，而是“任务终态是否被正确写入 DB、触发下游、通知用户”。

## 核心逻辑
- `晨报` 的失败不等于 cron 没跑；要先看 cron lane、模型超时、fallback 是否都记进日志。
- `翻译` 的成功不等于整任务成功；`mari-fetch DONE` 只代表首节点完成，不代表 `eva13-translate` 和 `misato-write` 已完成。
- `通知` 必须区分：
  - `NODE_COMPLETED`
  - `TASK_DONE`

## Skill
已验证的故障形态：

```text
FailoverError: LLM request timed out
```

```json
{"event":"TOOL_GAP","task_id":"social-topic-daily-20260407","gap_type":"runtime_execution_failure"}
```

```text
✅ 任务完成 | nerv-mari | translate-raschka-agent
```

上面最后一条是典型误导：这是节点级通知，不是整任务终态。

## 真实落点
- 日志：`/tmp/openclaw/openclaw-2026-04-07.log`
- DB：`nerv/data/db/nerv.db`
- 控制面脚本：
  - `nerv/scripts/session_recorder.py`
  - `nerv/scripts/spear_sync.js`
  - `nerv/scripts/adam_notifier.py`

## 已验证结论
- 晨报 08:00 未产出，主因是主模型和 fallback 模型双超时，不是 cron 漏触发。
- 翻译链路的真实问题是：上游 `DONE` 后没有自动触发下游 dispatch，随后又被节点级通知伪装成“任务完成”。
- 终态收敛必须同时看 `tasks`、`dag_nodes`、`audit_logs`，任何单一聊天回报都不可靠。
