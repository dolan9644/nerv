/**
 * ███ NERV · SEELE 安全探针 · security_probe.js (Harness Refactored) ███
 *
 * 引入了 withRetry 防阻塞机制，收紧了白名单安全规则，精确到 Node 级审计关联。
 *
 * 用法：node scripts/security_probe.js [--window 30]
 * 输出：JSON { anomalies: [...], stats: {...} }
 */

import { closeDb, withRetry } from './db.js';

// 配置：默认检查过去 30 分钟
const windowMinutes = parseInt(
  process.argv.find(a => a.startsWith('--window'))?.split('=')[1]
  || process.argv[process.argv.indexOf('--window') + 1]
  || '30'
);

const cutoffTs = Math.floor(Date.now() / 1000) - (windowMinutes * 60);

async function runProbe() {
  try {
    // 所有查询包裹在 withRetry 中防止 SQLITE_BUSY 崩溃
    // 注意：回调必须是同步的（better-sqlite3 同步 API），
    // withRetry 本身是 async 的，负责在 BUSY 时让出 Event Loop
    const result = await withRetry((db) => {

      // 核心修复 1：精准关联 node_id 级别，防止越权借用
      const unaudited = db.prepare(`
        SELECT e.task_id, e.node_id, e.agent_id, e.action, e.detail, e.created_at
        FROM audit_logs e
        WHERE e.action = 'EXECUTE'
          AND e.created_at > ?
          AND NOT EXISTS (
            SELECT 1 FROM audit_logs a
            WHERE a.task_id = e.task_id
              AND a.node_id = e.node_id
              AND a.action IN ('AUDIT_APPROVE', 'AUDIT_REJECT')
              AND a.created_at <= e.created_at
          )
        ORDER BY e.created_at DESC
        LIMIT 20
      `).all(cutoffTs);

      // 核心修复 2：严格白名单——有路径但不在 sandbox_io 内 = 越界
      const pathViolations = db.prepare(`
        SELECT task_id, node_id, agent_id, detail, created_at
        FROM audit_logs
        WHERE action = 'EXECUTE'
          AND created_at > ?
          AND detail IS NOT NULL
          AND detail LIKE '%/%'
          AND detail NOT LIKE '%sandbox_io%'
        LIMIT 10
      `).all(cutoffTs);

      // 异常高频操作检测（单 Agent 窗口内 > 50 次 EXECUTE）
      const highFreq = db.prepare(`
        SELECT agent_id, COUNT(*) as exec_count
        FROM audit_logs
        WHERE action = 'EXECUTE' AND created_at > ?
        GROUP BY agent_id
        HAVING exec_count > 50
      `).all(cutoffTs);

      // 统计摘要
      const totalExecs = db.prepare(`
        SELECT COUNT(*) as total FROM audit_logs
        WHERE action = 'EXECUTE' AND created_at > ?
      `).get(cutoffTs);

      const totalAudited = db.prepare(`
        SELECT COUNT(*) as total FROM audit_logs
        WHERE action IN ('AUDIT_APPROVE', 'AUDIT_REJECT') AND created_at > ?
      `).get(cutoffTs);

      return { unaudited, pathViolations, highFreq, totalExecs, totalAudited };
    });

    // 组装异常报告（给 seele 的 Token 安全摘要）
    const anomalies = [];

    for (const row of result.unaudited) {
      anomalies.push({
        type: 'UNAUDITED_EXECUTE',
        severity: 'HIGH',
        task_id: row.task_id,
        node_id: row.node_id,
        agent_id: row.agent_id,
        detail: (row.detail || '').slice(0, 200),
        timestamp: row.created_at
      });
    }

    for (const row of result.pathViolations) {
      anomalies.push({
        type: 'PATH_VIOLATION',
        severity: 'CRITICAL',
        task_id: row.task_id,
        agent_id: row.agent_id,
        detail: (row.detail || '').slice(0, 200),
        timestamp: row.created_at
      });
    }

    for (const row of result.highFreq) {
      anomalies.push({
        type: 'HIGH_FREQUENCY',
        severity: 'MEDIUM',
        agent_id: row.agent_id,
        exec_count: row.exec_count,
        detail: `${row.agent_id} executed ${row.exec_count} times in ${windowMinutes}min`
      });
    }

    const report = {
      probe_time: new Date().toISOString(),
      window_minutes: windowMinutes,
      anomalies,
      stats: {
        total_executes: result.totalExecs.total,
        total_audited: result.totalAudited.total,
        unaudited_count: result.unaudited.length,
        path_violations: result.pathViolations.length,
        high_freq_agents: result.highFreq.length
      }
    };

    console.log(JSON.stringify(report, null, 2));

  } catch (err) {
    console.error(JSON.stringify({
      probe_time: new Date().toISOString(),
      error: err.message,
      anomalies: [{ type: 'PROBE_ERROR', severity: 'CRITICAL', detail: err.message }],
      stats: {}
    }, null, 2));
    process.exit(1);
  } finally {
    closeDb();
  }
}

runProbe();
