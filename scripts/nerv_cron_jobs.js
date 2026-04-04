/**
 * ███ NERV Cron Jobs 注册配置 ███
 *
 * 以下 JSON 块需要追加到 ~/.openclaw/cron/jobs.json → jobs[] 数组末尾。
 * 每个 Job 严格对应一个自动化维护任务。
 *
 * 三大定时任务：
 *   1. misato Spear Sync（每 5 分钟）— 孤儿节点 + 漏调度回收
 *   2. seele Security Probe（每 30 分钟）— 安全巡检
 *   3. rei Memory Purify（每天凌晨 3:00）— 记忆提纯
 */

const NERV_CRON_JOBS = [
  {
    "id": "nerv-spear-sync",
    "agentId": "nerv-misato",
    "name": "NERV · Spear 状态对齐",
    "description": "每 5 分钟执行 DAG 孤儿节点检测 + 漏调度回收 + 环路熔断",
    "enabled": true,
    "schedule": {
      "kind": "cron",
      "expr": "*/5 * * * *",
      "tz": "Asia/Shanghai"
    },
    "sessionTarget": "isolated",
    "wakeMode": "now",
    "payload": {
      "kind": "agentTurn",
      "message": "静默执行 Spear 状态对齐。执行: node ~/.openclaw/nerv/scripts/spear_sync.js。读取 JSON 输出。如果 orphans/missedDispatches/circuitBreaks 任一非空，对每个异常节点执行 sessions_send 通知对应 Agent 重新认领。如果全部为空，回复 HEARTBEAT_OK。执行结束后 MUST 立即 sessions.clear 销毁全部上下文。",
      "timeoutSeconds": 120
    },
    "delivery": {
      "mode": "none"
    }
  },
  {
    "id": "nerv-security-probe",
    "agentId": "nerv-seele",
    "name": "NERV · SEELE 安全巡检",
    "description": "每 30 分钟执行安全探针，检测未授权执行与路径越界",
    "enabled": true,
    "schedule": {
      "kind": "cron",
      "expr": "*/30 * * * *",
      "tz": "Asia/Shanghai"
    },
    "sessionTarget": "isolated",
    "wakeMode": "now",
    "payload": {
      "kind": "agentTurn",
      "message": "静默执行安全巡检。执行: node ~/.openclaw/nerv/scripts/security_probe.js --window 30。读取 JSON 输出。如果 anomalies 数组为空，回复 HEARTBEAT_OK。如果有异常：按 severity 严重程度，对 CRITICAL 级别的立即用 write 工具写入 sandbox_io/seele_alert_<timestamp>.json 并 sessions_send 通知 misato；对 HIGH 级别的写入审计日志（使用 write_audit_log 工具）。执行结束后 MUST 立即 sessions.clear。",
      "timeoutSeconds": 120
    },
    "delivery": {
      "mode": "none"
    }
  },
  {
    "id": "nerv-memory-purify",
    "agentId": "nerv-rei",
    "name": "NERV · REI 记忆提纯",
    "description": "每天凌晨 3:00 执行 memory_queue 分页消费与提纯",
    "enabled": true,
    "schedule": {
      "kind": "cron",
      "expr": "0 3 * * *",
      "tz": "Asia/Shanghai"
    },
    "sessionTarget": "isolated",
    "wakeMode": "now",
    "payload": {
      "kind": "agentTurn",
      "message": "静默执行记忆提纯。执行: node ~/.openclaw/nerv/scripts/memory_purify.js --batch-size 100。读取控制台输出的统计数据。如果 total_processed > 0，将统计摘要写入 memory_queue/purify_report_<date>.md。执行结束后 MUST 立即 sessions.clear。",
      "timeoutSeconds": 600
    },
    "delivery": {
      "mode": "none"
    }
  }
];

export default NERV_CRON_JOBS;
