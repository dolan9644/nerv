# 🛡️ OpenClaw 每日战报

**报告时间**：2026-04-05 03:33 CST
**节点**：EVA-01 初号机 · Tang's Mac Studio

---

## 【重点更新】

### GitHub 最新动态

**最新 Release：**
```
---PRS---
[{"author":{"id":"MDQ6VXNlcjU1OTkzNTI=","is_bot":false,"login":"gumadeiras","name":"Gustavo Madeira Santana"},"mergedAt":"2026-04-04T17:23:58Z","number":60932,"title":"core: dedupe approval not-found handling"},{"author":{"id":"U_kgDOCQ-eTA","is_bot":false,"login":"onutc","name":"Onur"},"mergedAt":"2026-04-04T15:37:17Z","number":60918,"title":"ACPX: bump pinned version to 0.4.1"},{"author":{"id":"MDQ6VXNlcjk3OTAxOTY=","is_bot":false,"login":"altaywtf","name":"Altay"},"mergedAt":"2026-04-04T15:09:45Z","number":60914,"title":"fix(cli): route skills list output to stdout when --json is active"},{"author":{"id":"MDQ6VXNlcjk3OTAxOTY=","is_bot":false,"login":"altaywtf","name":"Altay"},"mergedAt":"2026-04-04T15:24:03Z","number":60909,"title":"fix(failover): scope openrouter-specific matchers"},{"author":{"id":"MDQ6VXNlcjI1MDY4","is_bot":false,"login":"vincentkoc","name":"Vincent Koc"},"mergedAt":"2026-04-04T18:17:10Z","number":60877,"title":"fix(agents): prefer background completion wake over polling"}]
---ISSUES---
```

**近期 Merged PRs（2026-03-29 至今）：**
```
[{"author":{"id":"MDQ6VXNlcjU1OTkzNTI=","is_bot":false,"login":"gumadeiras","name":"Gustavo Madeira Santana"},"mergedAt":"2026-04-04T17:23:58Z","number":60932,"title":"core: dedupe approval not-found handling"},{"author":{"id":"U_kgDOCQ-eTA","is_bot":false,"login":"onutc","name":"Onur"},"mergedAt":"2026-04-04T15:37:17Z","number":60918,"title":"ACPX: bump pinned version to 0.4.1"},{"author":{"id":"MDQ6VXNlcjk3OTAxOTY=","is_bot":false,"login":"altaywtf","name":"Altay"},"mergedAt":"2026-04-04T15:09:45Z","number":60914,"title":"fix(cli): route skills list output to stdout when --json is active"},{"author":{"id":"MDQ6VXNlcjk3OTAxOTY=","is_bot":false,"login":"altaywtf","name":"Altay"},"mergedAt":"2026-04-04T15:24:03Z","number":60909,"title":"fix(failover): scope openrouter-specific matchers"},{"author":{"id":"MDQ6VXNlcjI1MDY4","is_bot":false,"login":"vincentkoc","name":"Vincent Koc"},"mergedAt":"2026-04-04T18:17:10Z","number":60877,"title":"fix(agents): prefer background completion wake over polling"}]
```

**活跃 Issues：**
```
[{"number":61012,"title":"Telegram multi-bot routing: default account token ignored for outgoing messages","updatedAt":"2026-04-04T19:19:25Z"},{"number":61011,"title":"[Bug] Tool execution fails silently — I claim to run commands but nothing happens","updatedAt":"2026-04-04T19:11:23Z"},{"number":61010,"title":"[Bug]: Model supposed to run in workspace yet sees whole environment","updatedAt":"2026-04-04T19:08:02Z"},{"number":61009,"title":"[Bug]: docs/tools/exec says host=node override is allowed from auto, but runtime rejects it","updatedAt":"2026-04-04T19:07:44Z"},{"number":61007,"title":"[Bug] Gemini models displayed as anthropic in openclaw models list","updatedAt":"2026-04-04T18:50:50Z"}]
```

---

## 【分类汇总】

### 平台状态
| 项目 | 状态 |
|:-----|:-----|
| Gateway | │ |
| Agents 注册数 | 29 |
| 活跃 Sessions | 29 |
| 活跃 Tasks |  |
| Memory 文件 |  |

### NERV 体系
| 节点 | 状态 |
|:-----|:-----|
| EVA-01（部署终端） | 🟢 就绪 |
| Spear Sync | 🟢 活跃 |
| Code Runner（沙箱） | 🟢 待命 |

### 异常监控
| 类型 | 当前 |
|:-----|:-----|
| Orphan 节点 | 0 |
| Circuit Break |  |
| Missed Dispatch |  |

---

## 【数据】

### openclaw status 原始输出
```
[03:33:01] 采集 OpenClaw 状态...
OpenClaw status

Overview
┌──────────────────────┬───────────────────────────────────────────────────────────────────────────────────────────────┐
│ Item                 │ Value                                                                                         │
├──────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────┤
│ Dashboard            │ http://0.0.0.0:18789/                                                                         │
│ OS                   │ macos 26.4 (arm64) · node 25.8.1                                                              │
│ Tailscale            │ off                                                                                           │
│ Channel              │ stable (default)                                                                              │
│ Update               │ pnpm · up to date · npm latest 2026.4.2                                                       │
│ Gateway              │ local · ws://127.0.0.1:18789 (local loopback) · reachable 160ms · auth token · Mac (169.254.  │
│                      │ 174.154) app 2026.4.2 macos 26.4                                                              │
│ Gateway service      │ LaunchAgent installed · loaded · running (pid 71005, state active)                            │
│ Node service         │ LaunchAgent not installed                                                                     │
│ Agents               │ 29 · 6 bootstrap files present · sessions 305 · default main active 2h ago                    │
│ Memory               │ 5 files · 5 chunks · sources memory · plugin memory-core · vector ready · fts ready · cache   │
│                      │ on (10)                                                                                       │
│ Plugin compatibility │ none                                                                                          │
│ Probes               │ skipped (use --deep)                                                                          │
│ Events               │ none                                                                                          │
│ Tasks                │ 20 active · 0 queued · 20 running · 24 issues · audit 9 errors · 52 warn · 319 tracked        │
│ Heartbeat            │ disabled (main), disabled (ai-partner), disabled (bibi-agent), disabled (bibi-design),        │
│                      │ disabled (bibi-topic), disabled (bibi-writer), disabled (elon), disabled (ice-american),      │
│                      │ disabled (jixiao-agent), disabled (nerv-asuka), disabled (nerv-eva-series), disabled (nerv-   │
│                      │ eva00), disabled (nerv-eva01), disabled (nerv-eva02), disabled (nerv-eva03), disabled (nerv-  │
│                      │ eva13), disabled (nerv-gendo), disabled (nerv-kaworu), disabled (nerv-mari), 5m (nerv-        │
│                      │ misato), disabled (nerv-rei), disabled (nerv-ritsuko), 30m (nerv-seele), disabled (nerv-      │
│                      │ shinji), disabled (tech), disabled (test-aaa), disabled (vicky), disabled (xiaoba), disabled  │
│                      │ (xiaowang)                                                                                    │
│ Sessions             │ 305 active · default MiniMax-M2.7-highspeed (200k ctx) · 29 stores                            │
└──────────────────────┴───────────────────────────────────────────────────────────────────────────────────────────────┘

Task maintenance: openclaw tasks maintenance --apply

Security audit
Summary: 16 critical · 6 warn · 1 info
  CRITICAL Elevated exec allowlist contains wildcard
    tools.elevated.allowFrom.webchat includes "*" which effectively approves everyone on that channel for elevated mode.
  CRITICAL Open groupPolicy with elevated tools enabled
    Found groupPolicy="open" at: - channels.feishu.groupPolicy - channels.feishu.accounts.wechat-bot.groupPolicy - channels.feishu.accounts.default.groupPolicy - c…
    Fix: Set groupPolicy="allowlist" and keep elevated allowlists extremely tight.
  CRITICAL Open groupPolicy with runtime/filesystem tools exposed
    Found groupPolicy="open" at: - channels.feishu.groupPolicy - channels.feishu.accounts.wechat-bot.groupPolicy - channels.feishu.accounts.default.groupPolicy - c…
    Fix: For open groups, prefer tools.profile="messaging" (or deny group:runtime/group:fs), set tools.fs.workspaceOnly=true, and use agents.defaults.sandbox.mode="all" for exposed agents.
  CRITICAL Feishu security warning
    Feishu[wechat-bot] groups: groupPolicy="open" allows any group to interact (mention-gated). To restrict which groups are allowed, set groupPolicy="allowlist" a…
  CRITICAL Feishu security warning
    Feishu[default] groups: groupPolicy="open" allows any group to interact (mention-gated). To restrict which groups are allowed, set groupPolicy="allowlist" and …
  CRITICAL Feishu security warning
    Feishu[main-bot] groups: groupPolicy="open" allows any group to interact (mention-gated). To restrict which groups are allowed, set groupPolicy="allowlist" and…
… +16 more
Full report: openclaw security audit
Deep probe: openclaw security audit --deep

Channels
┌─────────────────┬─────────┬────────┬─────────────────────────────────────────────────────────────────────────────────┐
│ Channel         │ Enabled │ State  │ Detail                                                                          │
├─────────────────┼─────────┼────────┼─────────────────────────────────────────────────────────────────────────────────┤
│ Telegram        │ ON      │ WARN   │ token config (8506…EGPM · len 46) · accounts 1/1 · gateway: Config allows       │
│                 │         │        │ unmentioned group messages (requireMention=false). Telegram Bot API p…          │
│ Feishu          │ ON      │ OK     │ configured · accounts 13/13                                                     │
│ openclaw-weixin │ ON      │ OK     │ token unknown (0806…0485 · len 58) · accounts 1/1                               │
└─────────────────┴─────────┴────────┴─────────────────────────────────────────────────────────────────────────────────┘

Sessions
┌────────────────────────────────────────┬────────┬──────────┬────────────────────────┬────────────────────────────────┐
│ Key                                    │ Kind   │ Age      │ Model                  │ Tokens                         │
├────────────────────────────────────────┼────────┼──────────┼────────────────────────┼────────────────────────────────┤
│ agent:nerv-eva01:main                  │ direct │ just now │ MiniMax-M2.7-highspeed │ 44k/200k (22%) · 🗄️ 13% cached │
│ agent:nerv-seele:cron:nerv-secu…       │ direct │ 1m ago   │ MiniMax-M2.7-highspeed │ 18k/200k (9%) · 🗄️ 49% cached  │
│ agent:nerv-seele:cron:nerv-secu…       │ direct │ 1m ago   │ MiniMax-M2.7-highspeed │ 18k/200k (9%) · 🗄️ 49% cached  │
│ agent:nerv-misato:cron:c810f24f…       │ direct │ 1m ago   │ MiniMax-M2.7-highspeed │ 24k/200k (12%) · 🗄️ 58% cached │
│ agent:nerv-misato:cron:c810f24f…       │ direct │ 1m ago   │ MiniMax-M2.7-highspeed │ 24k/200k (12%) · 🗄️ 58% cached │
│ agent:nerv-gendo:feishu:direct:…       │ direct │ 2m ago   │ MiniMax-M2.7-highspeed │ 54k/200k (27%) · 🗄️ 2% cached  │
│ agent:nerv-misato:main:heartbeat       │ direct │ 2m ago   │ MiniMax-M2.7-highspeed │ 41k/200k (21%) · 🗄️ 17% cached │
│ agent:nerv-misato:cron:nerv-spe…       │ direct │ 2m ago   │ MiniMax-M2.7-highspeed │ 20k/200k (10%) · 🗄️ 99% cached │
│ agent:nerv-misato:cron:nerv-spe…       │ direct │ 2m ago   │ MiniMax-M2.7-highspeed │ 20k/200k (10%) · 🗄️ 99% cached │
│ agent:nerv-gendo:main                  │ direct │ 3m ago   │ MiniMax-M2.7-highspeed │ 26k/200k (13%) · 🗄️ 58% cached │
└────────────────────────────────────────┴────────┴──────────┴────────────────────────┴────────────────────────────────┘

FAQ: https://docs.openclaw.ai/faq
Troubleshooting: https://docs.openclaw.ai/troubleshooting

Next steps:
  Need to share?      openclaw status --all
  Need to debug live? openclaw logs --follow
  Need to test channels? openclaw status --deep
```

### 报告生成路径
`/Users/dolan/.openclaw/nerv/scripts/openclaw-daily-report-20260405.md`

---
*由 EVA-01 初号机自动生成 · NERV 作战体系*
