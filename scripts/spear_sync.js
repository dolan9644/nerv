/**
 * ███ NERV · Spear 状态对齐器（朗基努斯之枪）(Harness Refactored) ███
 * 
 * 职责：由 misato Heartbeat 触发
 * 1. 检测孤岛节点（nerv.db = RUNNING 但实际已断连）
 * 2. 检测漏调度（DONE 后下游 PENDING 但未被触发）
 * 3. 强制执行 CIRCUIT_BREAK（超过 max_retries 的死循环节点）
 * 
 * 修复：全部改为 async/await（db.js 函数现在全是 async 的）
 */

import {
  getOrphanNodes,
  updateNodeStatus,
  writeAuditLog,
  blockDownstream,
  withRetry,
  closeDb
} from './db.js';

// ═══════════════════════════════════════════════════════════════
// 配置
// ═══════════════════════════════════════════════════════════════

const ORPHAN_THRESHOLD_SECONDS = 120;   // 默认 RUNNING 超过 2 分钟无更新 = 疑似孤岛
const STALE_THRESHOLD_SECONDS = 7200;   // RUNNING 超过 2 小时 = 强制 FAILED

// 分级孤岛阈值：长耗时 Agent 给更宽松的窗口
const AGENT_ORPHAN_THRESHOLDS = {
  'nerv-mari':    300,   // 5min（网络爬取耗时长）
  'nerv-eva-13':  300,   // 5min（万字文案生成）
  'nerv-eva01':   300,   // 5min（Docker 部署耗时）
  'nerv-kaworu':  240,   // 4min（深度代码审查）
};

// ═══════════════════════════════════════════════════════════════
// 1. 孤岛节点检测与修复
// ═══════════════════════════════════════════════════════════════

async function detectOrphanNodes() {
  const orphans = await getOrphanNodes(ORPHAN_THRESHOLD_SECONDS);
  const results = [];

  for (const node of orphans) {
    const elapsed = Math.floor(Date.now() / 1000) - node.updated_at;

    // 分级阈值：先查该 Agent 的专属阈值，无则用默认
    const agentThreshold = AGENT_ORPHAN_THRESHOLDS[node.agent_id] || ORPHAN_THRESHOLD_SECONDS;
    if (elapsed < agentThreshold) continue;  // 未超阈，跳过

    if (elapsed > STALE_THRESHOLD_SECONDS) {
      // 超过 2 小时：强制 FAILED
      await updateNodeStatus(node.node_id, 'FAILED', null, 'Spear: stale node force-killed after 2h');
      await blockDownstream(node.node_id, node.task_id);
      await writeAuditLog(node.task_id, node.node_id, 'spear', 'FORCE_KILL', 
        JSON.stringify({ elapsed_seconds: elapsed, reason: 'stale_threshold_exceeded', agent_threshold: agentThreshold }));
      results.push({ node_id: node.node_id, action: 'FORCE_KILLED', elapsed });
    } else {
      // 超阈但未超 2h：标记为疑似孤岛
      results.push({ node_id: node.node_id, action: 'ORPHAN_SUSPECTED', elapsed });
      await writeAuditLog(node.task_id, node.node_id, 'spear', 'ORPHAN_DETECTED',
        JSON.stringify({ elapsed_seconds: elapsed, agent_threshold: agentThreshold }));
    }
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════
// 2. 漏调度检测
// ═══════════════════════════════════════════════════════════════

async function detectMissedDispatches() {
  const missed = await withRetry((db) => {
    return db.prepare(`
      SELECT DISTINCT dn_downstream.node_id, dn_downstream.task_id, dn_downstream.agent_id
      FROM dag_nodes dn_done
      JOIN dag_edges e ON dn_done.node_id = e.from_node
      JOIN dag_nodes dn_downstream ON e.to_node = dn_downstream.node_id
      WHERE dn_done.status = 'DONE'
        AND dn_downstream.status = 'PENDING'
        AND NOT EXISTS (
          SELECT 1 FROM dag_edges e2
          JOIN dag_nodes dn_pre ON e2.from_node = dn_pre.node_id
          WHERE e2.to_node = dn_downstream.node_id 
            AND e2.task_id = dn_downstream.task_id
            AND dn_pre.status != 'DONE'
        )
    `).all();
  });

  // 主动干预：将漏调度节点从 PENDING 提升为 RUNNING，触发重调度
  for (const node of missed) {
    await updateNodeStatus(node.node_id, 'RUNNING', null,
      'Spear: force-redispatched missed node');
    await writeAuditLog(node.task_id, node.node_id, 'spear', 'FORCE_REDISPATCH',
      JSON.stringify({ agent_id: node.agent_id, reason: 'all_predecessors_done_but_still_pending' }));
  }

  return missed;
}

// ═══════════════════════════════════════════════════════════════
// 3. 环路熔断检测
// ═══════════════════════════════════════════════════════════════

async function detectCircuitBreaks() {
  const overLimit = await withRetry((db) => {
    return db.prepare(`
      SELECT node_id, task_id, agent_id, retry_count, max_retries
      FROM dag_nodes
      WHERE retry_count >= max_retries AND status NOT IN ('DONE', 'CIRCUIT_BROKEN', 'BLOCKED')
    `).all();
  });

  for (const node of overLimit) {
    await updateNodeStatus(node.node_id, 'CIRCUIT_BROKEN', null, 
      `Spear: circuit broken after ${node.retry_count} retries (limit: ${node.max_retries})`);
    await blockDownstream(node.node_id, node.task_id);
    await writeAuditLog(node.task_id, node.node_id, 'spear', 'CIRCUIT_BREAK',
      JSON.stringify({ retry_count: node.retry_count, max_retries: node.max_retries }));
  }

  return overLimit;
}

// ═══════════════════════════════════════════════════════════════
// 主入口：Sync_DAG_Status
// ═══════════════════════════════════════════════════════════════

async function syncDagStatus() {
  const timestamp = new Date().toISOString();
  const report = {
    timestamp,
    orphans: await detectOrphanNodes(),
    missedDispatches: await detectMissedDispatches(),
    circuitBreaks: await detectCircuitBreaks()
  };

  const hasIssues = report.orphans.length > 0 || 
                    report.missedDispatches.length > 0 || 
                    report.circuitBreaks.length > 0;

  if (hasIssues) {
    console.log(`[NERV·Spear] ${timestamp} — 发现异常：`);
    if (report.orphans.length > 0) {
      console.log(`  孤岛节点: ${report.orphans.length}`);
    }
    if (report.missedDispatches.length > 0) {
      console.log(`  漏调度: ${report.missedDispatches.length}`);
    }
    if (report.circuitBreaks.length > 0) {
      console.log(`  环路熔断: ${report.circuitBreaks.length}`);
    }
  }

  return report;
}

// CLI 直接调用
if (process.argv[1] && process.argv[1].includes('spear_sync')) {
  syncDagStatus()
    .then(report => {
      console.log(JSON.stringify(report, null, 2));
    })
    .catch(err => {
      console.error(JSON.stringify({ error: err.message }));
      process.exit(1);
    })
    .finally(() => closeDb());
}

export { syncDagStatus, detectOrphanNodes, detectMissedDispatches, detectCircuitBreaks };
