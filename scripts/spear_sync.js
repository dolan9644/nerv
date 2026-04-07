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
  'nerv-eva13':   300,   // 5min（万字文案生成）
  'nerv-eva01':   300,   // 5min（Docker 部署耗时）
  'nerv-kaworu':  240,   // 4min（深度代码审查）
};
const PASSIVE_DISPATCH_MODES = new Set(['cron_only', 'approval_gate', 'human_input']);

function parseJsonMaybe(text) {
  if (!text || typeof text !== 'string') return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function createTaskCache() {
  return new Map();
}

async function loadTaskSnapshot(taskId, cache) {
  if (!taskId) {
    return { row: null, dag: null, nodesById: new Map() };
  }
  if (cache.has(taskId)) {
    return cache.get(taskId);
  }

  const row = await withRetry((db) => {
    return db.prepare('SELECT task_id, dag_json FROM tasks WHERE task_id = ?').get(taskId);
  });

  const snapshot = {
    row,
    dag: null,
    nodesById: new Map()
  };

  const dag = parseJsonMaybe(row?.dag_json || '');
  if (dag && Array.isArray(dag.nodes)) {
    snapshot.dag = dag;
    for (const node of dag.nodes) {
      if (node?.node_id) {
        snapshot.nodesById.set(node.node_id, node);
      }
    }
  }

  cache.set(taskId, snapshot);
  return snapshot;
}

async function getNodeContract(taskId, nodeId, cache) {
  const snapshot = await loadTaskSnapshot(taskId, cache);
  return snapshot.nodesById.get(nodeId)?.contract || null;
}

async function getLatestDispatchMeta(taskId, nodeId) {
  const nodeRow = await withRetry((db) => {
    return db.prepare(`
      SELECT agent_id, session_key, last_dispatch_id, last_dispatch_at
      FROM dag_nodes
      WHERE task_id = ? AND node_id = ?
      LIMIT 1
    `).get(taskId, nodeId);
  });

  if (nodeRow?.last_dispatch_id || nodeRow?.session_key) {
    return {
      dispatch_id: nodeRow?.last_dispatch_id || null,
      target_agent: nodeRow?.agent_id || null,
      session_key: nodeRow?.session_key || null,
      timeout_seconds: null,
      created_at: nodeRow?.last_dispatch_at ?? null
    };
  }

  const row = await withRetry((db) => {
    return db.prepare(`
      SELECT detail, created_at
      FROM audit_logs
      WHERE task_id = ? AND node_id = ? AND action = 'RECORDED_DISPATCH'
      ORDER BY created_at DESC
      LIMIT 1
    `).get(taskId, nodeId);
  });

  const detail = parseJsonMaybe(row?.detail || '');
  return {
    dispatch_id: detail?.dispatch_id || null,
    target_agent: detail?.target_agent || null,
    session_key: detail?.session_key || null,
    timeout_seconds: detail?.timeout_seconds ?? null,
    created_at: row?.created_at ?? null
  };
}

async function auditExistsRecently(taskId, nodeId, action, windowSeconds = 900) {
  const cutoff = Math.floor(Date.now() / 1000) - windowSeconds;
  const row = await withRetry((db) => {
    return db.prepare(`
      SELECT 1
      FROM audit_logs
      WHERE task_id = ? AND node_id = ? AND action = ? AND created_at >= ?
      LIMIT 1
    `).get(taskId, nodeId, action, cutoff);
  });
  return Boolean(row);
}

async function resolveNodeRuntime(taskId, nodeId, agentId, cache) {
  const contract = await getNodeContract(taskId, nodeId, cache);
  const runtime = contract?.runtime_contract || {};
  const dispatch = contract?.dispatch_contract || {};
  const orphanThreshold = runtime.orphan_threshold_seconds || AGENT_ORPHAN_THRESHOLDS[agentId] || ORPHAN_THRESHOLD_SECONDS;
  return {
    orphanThreshold,
    orphanThresholdSource: runtime.orphan_threshold_seconds ? 'runtime_contract.orphan_threshold_seconds' : (AGENT_ORPHAN_THRESHOLDS[agentId] ? 'agent_override' : 'default'),
    timeoutSeconds: runtime.timeout_seconds || null,
    maxRetries: runtime.max_retries ?? null,
    targetAgent: dispatch.target_agent || agentId || null,
    dispatchMode: dispatch.mode || 'agent_session'
  };
}

// ═══════════════════════════════════════════════════════════════
// 1. 孤岛节点检测与修复
// ═══════════════════════════════════════════════════════════════

async function detectOrphanNodes() {
  const orphans = await withRetry((db) => {
    return db.prepare(`
      SELECT node_id, task_id, agent_id, updated_at
      FROM dag_nodes
      WHERE status = 'RUNNING'
    `).all();
  });
  const results = [];
  const taskCache = createTaskCache();

  for (const node of orphans) {
    const elapsed = Math.floor(Date.now() / 1000) - node.updated_at;
    const runtime = await resolveNodeRuntime(node.task_id, node.node_id, node.agent_id, taskCache);
    const dispatchMeta = await getLatestDispatchMeta(node.task_id, node.node_id);
    const agentThreshold = runtime.orphanThreshold;
    const staleThreshold = runtime.timeoutSeconds
      ? Math.max(runtime.timeoutSeconds, agentThreshold)
      : Math.max(STALE_THRESHOLD_SECONDS, agentThreshold * 10);

    if (elapsed < agentThreshold) continue;  // 未超阈，跳过

    if (elapsed >= staleThreshold) {
      await updateNodeStatus(node.node_id, 'FAILED', null, 'Spear: runtime timeout or stale threshold exceeded');
      await blockDownstream(node.node_id, node.task_id);
      await writeAuditLog(node.task_id, node.node_id, 'spear', 'FORCE_KILL', 
        JSON.stringify({
          elapsed_seconds: elapsed,
          reason: runtime.timeoutSeconds ? 'runtime_timeout_exceeded' : 'stale_threshold_exceeded',
          agent_threshold: agentThreshold,
          orphan_threshold_source: runtime.orphanThresholdSource,
          timeout_seconds: runtime.timeoutSeconds,
          stale_threshold_seconds: staleThreshold,
          dispatch_mode: runtime.dispatchMode,
          session_key: dispatchMeta.session_key,
          dispatch_id: dispatchMeta.dispatch_id
        }));
      results.push({
        node_id: node.node_id,
        task_id: node.task_id,
        agent_id: node.agent_id,
        action: 'FORCE_KILLED',
        elapsed,
        orphan_threshold_seconds: agentThreshold,
        orphan_threshold_source: runtime.orphanThresholdSource,
        timeout_seconds: runtime.timeoutSeconds,
        stale_threshold_seconds: staleThreshold
      });
    } else {
      results.push({
        node_id: node.node_id,
        task_id: node.task_id,
        agent_id: node.agent_id,
        action: 'ORPHAN_SUSPECTED',
        elapsed,
        orphan_threshold_seconds: agentThreshold,
        timeout_seconds: runtime.timeoutSeconds
      });
      await writeAuditLog(node.task_id, node.node_id, 'spear', 'ORPHAN_DETECTED',
        JSON.stringify({
          elapsed_seconds: elapsed,
          agent_threshold: agentThreshold,
          orphan_threshold_source: runtime.orphanThresholdSource,
          timeout_seconds: runtime.timeoutSeconds,
          dispatch_mode: runtime.dispatchMode,
          session_key: dispatchMeta.session_key,
          dispatch_id: dispatchMeta.dispatch_id
        }));
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

  const results = [];
  const taskCache = createTaskCache();

  for (const node of missed) {
    const runtime = await resolveNodeRuntime(node.task_id, node.node_id, node.agent_id, taskCache);
    const dispatchMeta = await getLatestDispatchMeta(node.task_id, node.node_id);
    const action = PASSIVE_DISPATCH_MODES.has(runtime.dispatchMode)
      ? 'DISPATCH_WAIT_EXPECTED'
      : 'REDISPATCH_REQUIRED';
    const detail = {
      agent_id: node.agent_id,
      target_agent: dispatchMeta.target_agent || runtime.targetAgent,
      dispatch_mode: runtime.dispatchMode,
      dispatch_id: dispatchMeta.dispatch_id,
      timeout_seconds: dispatchMeta.timeout_seconds ?? runtime.timeoutSeconds,
      reason: 'all_predecessors_done_but_still_pending',
      requires_external_runner: !PASSIVE_DISPATCH_MODES.has(runtime.dispatchMode)
    };

    const alreadyLogged = await auditExistsRecently(node.task_id, node.node_id, action, 900);
    if (!alreadyLogged) {
      await writeAuditLog(node.task_id, node.node_id, 'spear', action,
        JSON.stringify(detail));
    }

    results.push({
      node_id: node.node_id,
      task_id: node.task_id,
      agent_id: node.agent_id,
      action,
      ...detail
    });
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════
// 3. 环路熔断检测
// ═══════════════════════════════════════════════════════════════

async function detectCircuitBreaks() {
  const candidates = await withRetry((db) => {
    return db.prepare(`
      SELECT node_id, task_id, agent_id, retry_count, max_retries
      FROM dag_nodes
      WHERE status NOT IN ('DONE', 'CIRCUIT_BROKEN', 'BLOCKED')
    `).all();
  });

  const taskCache = createTaskCache();
  const overLimit = [];

  for (const node of candidates) {
    const runtime = await resolveNodeRuntime(node.task_id, node.node_id, node.agent_id, taskCache);
    const effectiveMaxRetries = runtime.maxRetries ?? node.max_retries;
    if (node.retry_count >= effectiveMaxRetries) {
      overLimit.push({ ...node, effectiveMaxRetries });
    }
  }

  for (const node of overLimit) {
    await updateNodeStatus(node.node_id, 'CIRCUIT_BROKEN', null, 
      `Spear: circuit broken after ${node.retry_count} retries (limit: ${node.effectiveMaxRetries})`);
    await blockDownstream(node.node_id, node.task_id);
    await writeAuditLog(node.task_id, node.node_id, 'spear', 'CIRCUIT_BREAK',
      JSON.stringify({ retry_count: node.retry_count, max_retries: node.effectiveMaxRetries }));
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
