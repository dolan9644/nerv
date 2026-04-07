/**
 * ███ NERV Cron Jobs 注册配置 ███
 *
 * 这些是 NERV 的核心基础设施 Cron。
 * 它们不承担业务任务，只负责运行时维护、审计和补录。
 */

const NERV_CRON_JOBS = [
  {
    id: 'nerv-adam-notifier',
    agentId: 'nerv-misato',
    name: 'Adam 审批通知 (NERV)',
    description: '每 10 分钟扫描 pending_approvals，发现新待批复项推送飞书卡片',
    enabled: true,
    schedule: {
      kind: 'cron',
      expr: '*/10 * * * *',
      tz: 'Asia/Shanghai'
    },
    sessionTarget: 'isolated',
    wakeMode: 'now',
    payload: {
      kind: 'agentTurn',
      message: '静默执行 Adam 审批通知。执行: python3 ~/.openclaw/nerv/scripts/adam_notifier.py scan。无待批复项则静默退出；有待批复项则推送飞书卡片。',
      timeoutSeconds: 120
    },
    delivery: {
      mode: 'none'
    }
  },
  {
    id: 'nerv-spear-sync',
    agentId: 'nerv-misato',
    name: 'NERV · Spear 状态对齐',
    description: '每 5 分钟执行 DAG 孤儿节点检测 + 漏调度回收 + 环路熔断',
    enabled: true,
    schedule: {
      kind: 'cron',
      expr: '*/5 * * * *',
      tz: 'Asia/Shanghai'
    },
    sessionTarget: 'isolated',
    wakeMode: 'now',
    payload: {
      kind: 'agentTurn',
      message: '静默执行 Spear 状态对齐。执行: node ~/.openclaw/nerv/scripts/spear_sync.js。读取 JSON 输出。如果 orphans/missedDispatches/circuitBreaks 任一非空，向对应 Agent 与 misato 回传异常摘要；如果全部为空，回复 HEARTBEAT_OK。',
      timeoutSeconds: 120
    },
    delivery: {
      mode: 'none'
    }
  },
  {
    id: 'nerv-security-probe',
    agentId: 'nerv-seele',
    name: 'NERV · SEELE 安全巡检',
    description: '每 30 分钟执行安全探针，检测未授权执行与路径越界',
    enabled: true,
    schedule: {
      kind: 'cron',
      expr: '*/30 * * * *',
      tz: 'Asia/Shanghai'
    },
    sessionTarget: 'isolated',
    wakeMode: 'now',
    payload: {
      kind: 'agentTurn',
      message: '静默执行安全巡检。执行: node ~/.openclaw/nerv/scripts/security_probe.js --window 30 --alert-dir ~/.openclaw/nerv/data/sandbox_io。读取 JSON 输出。如果 anomalies 数组为空，回复 HEARTBEAT_OK；如果有异常，使用返回的 alert_file 与异常摘要 sessions_send 通知 misato。',
      timeoutSeconds: 120
    },
    delivery: {
      mode: 'none'
    }
  },
  {
    id: 'nerv-memory-purify',
    agentId: 'nerv-rei',
    name: 'NERV · REI 记忆提纯',
    description: '每天凌晨 3:00 执行 memory_queue 分页消费与提纯',
    enabled: true,
    schedule: {
      kind: 'cron',
      expr: '0 3 * * *',
      tz: 'Asia/Shanghai'
    },
    sessionTarget: 'isolated',
    wakeMode: 'now',
    payload: {
      kind: 'agentTurn',
      message: '静默执行记忆提纯。执行: node ~/.openclaw/nerv/scripts/memory_purify.js --batch-size 100。脚本会优先使用本地 Ollama 模型压缩，失败后 fallback 到 Gemini CLI，最后回退到结构化摘要。读取控制台输出统计数据；如果 total_processed > 0，再写 purify_report_<date>.md 摘要。',
      timeoutSeconds: 600
    },
    delivery: {
      mode: 'none'
    }
  },
  {
    id: 'nerv-session-recorder',
    agentId: 'nerv-misato',
    name: 'NERV · Session 日志录入',
    description: '每 1 分钟扫描 session 日志，提取任务记录写入 nerv.db + memory_queue，并在节点完成后唤醒 Misato 续推 ready DAG 节点',
    enabled: true,
    schedule: {
      kind: 'cron',
      expr: '* * * * *',
      tz: 'Asia/Shanghai'
    },
    sessionTarget: 'isolated',
    wakeMode: 'now',
    payload: {
      kind: 'agentTurn',
      message: '静默执行 session 日志录入。执行: python3 ~/.openclaw/nerv/scripts/session_recorder.py。读取 JSON 输出并汇报扫描统计；若有 orchestrator_wakes，说明本轮已触发 Misato 续推 ready 节点。',
      timeoutSeconds: 120
    },
    delivery: {
      mode: 'none'
    }
  }
];

export default NERV_CRON_JOBS;
