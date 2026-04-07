#!/usr/bin/env node

import {
  withRetry,
  updateNodeStatus,
  updateTaskStatus,
  blockDownstream,
  writeAuditLog,
  closeDb
} from './db.js';

const APPLY = process.argv.includes('--apply');
const TASK_IDS = [];
for (let i = 0; i < process.argv.length; i += 1) {
  const arg = process.argv[i];
  if (arg === '--task-id' && process.argv[i + 1]) {
    TASK_IDS.push(process.argv[i + 1]);
  } else if (arg.startsWith('--task-id=')) {
    TASK_IDS.push(arg.slice('--task-id='.length));
  }
}
const TARGET_TASK_IDS = Array.from(new Set(TASK_IDS.filter(Boolean)));
const TARGETED_MODE = TARGET_TASK_IDS.length > 0;
const STALE_HOURS = parseInt(process.env.NERV_LEGACY_STALE_HOURS || '6', 10);
const STALE_SECONDS = STALE_HOURS * 3600;
const NOW = Math.floor(Date.now() / 1000);

function buildBackfilledDag(taskId, nodes, edges) {
  return {
    task_id: taskId,
    metadata: {
      backfilled: true,
      source: 'legacy_dag_nodes',
      backfilled_at: new Date().toISOString()
    },
    nodes: nodes.map((node) => ({
      node_id: node.node_id,
      agent_id: node.agent_id,
      description: node.description,
      depth: node.depth,
      max_retries: node.max_retries,
      session_key: node.session_key,
      session_scope: node.session_scope
    })),
    edges: edges.map((edge) => ({
      from: edge.from_node,
      to: edge.to_node
    }))
  };
}

async function backfillDagJson() {
  const targets = await withRetry((db) => {
    if (TARGETED_MODE) {
      const placeholders = TARGET_TASK_IDS.map(() => '?').join(',');
      return db.prepare(`
        SELECT task_id
        FROM tasks
        WHERE (dag_json IS NULL OR dag_json = '')
          AND task_id IN (${placeholders})
        ORDER BY updated_at DESC
      `).all(...TARGET_TASK_IDS);
    }
    return db.prepare(`
      SELECT task_id
      FROM tasks
      WHERE dag_json IS NULL OR dag_json = ''
      ORDER BY updated_at DESC
    `).all();
  });

  let updated = 0;

  for (const row of targets) {
    const nodes = await withRetry((db) => db.prepare(`
      SELECT node_id, agent_id, description, depth, max_retries, session_key, session_scope
      FROM dag_nodes
      WHERE task_id = ?
      ORDER BY created_at, node_id
    `).all(row.task_id));
    const edges = await withRetry((db) => db.prepare(`
      SELECT from_node, to_node
      FROM dag_edges
      WHERE task_id = ?
      ORDER BY from_node, to_node
    `).all(row.task_id));

    const dagJson = JSON.stringify(buildBackfilledDag(row.task_id, nodes, edges));
    if (APPLY) {
      await withRetry((db) => db.prepare(`
        UPDATE tasks
        SET dag_json = ?, updated_at = strftime('%s','now')
        WHERE task_id = ?
      `).run(dagJson, row.task_id));
      await writeAuditLog(row.task_id, null, 'system', 'BACKFILL_DAG_JSON', JSON.stringify({
        node_count: nodes.length,
        edge_count: edges.length
      }));
    }
    updated += 1;
  }

  return updated;
}

async function remediateStaleNodes() {
  const cutoff = NOW - STALE_SECONDS;
  const staleNodes = await withRetry((db) => {
    if (TARGETED_MODE) {
      const placeholders = TARGET_TASK_IDS.map(() => '?').join(',');
      return db.prepare(`
        SELECT dn.node_id, dn.task_id, dn.agent_id, dn.status, dn.updated_at, t.status AS task_status, a.last_heartbeat
        FROM dag_nodes dn
        JOIN tasks t ON t.task_id = dn.task_id
        LEFT JOIN agents a ON a.agent_id = dn.agent_id
        WHERE dn.status IN ('PENDING', 'RUNNING')
          AND t.status IN ('PENDING', 'RUNNING')
          AND dn.task_id IN (${placeholders})
        ORDER BY dn.updated_at ASC
      `).all(...TARGET_TASK_IDS);
    }
    return db.prepare(`
      SELECT dn.node_id, dn.task_id, dn.agent_id, dn.status, dn.updated_at, t.status AS task_status, a.last_heartbeat
      FROM dag_nodes dn
      JOIN tasks t ON t.task_id = dn.task_id
      LEFT JOIN agents a ON a.agent_id = dn.agent_id
      WHERE dn.status IN ('PENDING', 'RUNNING')
        AND dn.updated_at < ?
        AND t.status IN ('PENDING', 'RUNNING')
      ORDER BY dn.updated_at ASC
    `).all(cutoff);
  });

  const touchedTasks = new Set();
  const changes = [];

  for (const node of staleNodes) {
    const reason = TARGETED_MODE
      ? `Targeted cleanup: force-remediated ${node.status.toLowerCase()} node for selected task`
      : `Legacy cleanup: stale ${node.status.toLowerCase()} node without healthy runtime`;
    if (APPLY) {
      if (node.status === 'RUNNING') {
        await updateNodeStatus(node.node_id, 'FAILED', null, reason);
        await blockDownstream(node.node_id, node.task_id);
      } else {
        await withRetry((db) => db.prepare(`
          UPDATE dag_nodes
          SET status = 'BLOCKED', error_log = ?, updated_at = strftime('%s','now')
          WHERE node_id = ?
        `).run(reason, node.node_id));
      }
      await writeAuditLog(node.task_id, node.node_id, 'system', 'LEGACY_STALE_REMEDIATED', JSON.stringify({
        previous_status: node.status,
        last_heartbeat: node.last_heartbeat,
        stale_hours: STALE_HOURS,
        targeted_mode: TARGETED_MODE
      }));
    }
    touchedTasks.add(node.task_id);
    changes.push({ node_id: node.node_id, task_id: node.task_id, from: node.status, to: node.status === 'RUNNING' ? 'FAILED' : 'BLOCKED' });
  }

  if (APPLY) {
    for (const taskId of touchedTasks) {
      const summary = await withRetry((db) => db.prepare(`
        SELECT
          SUM(CASE WHEN status = 'DONE' THEN 1 ELSE 0 END) AS done_count,
          SUM(CASE WHEN status IN ('FAILED', 'CIRCUIT_BROKEN', 'BLOCKED') THEN 1 ELSE 0 END) AS terminal_problem_count,
          SUM(CASE WHEN status IN ('PENDING', 'RUNNING') THEN 1 ELSE 0 END) AS active_count
        FROM dag_nodes
        WHERE task_id = ?
      `).get(taskId));

      if ((summary?.active_count || 0) > 0) continue;
      if ((summary?.terminal_problem_count || 0) > 0) {
        await updateTaskStatus(taskId, 'FAILED', 'Legacy cleanup finalized stale nodes');
      } else if ((summary?.done_count || 0) > 0) {
        await updateTaskStatus(taskId, 'DONE', 'Legacy cleanup confirmed terminal completion');
      }
    }
  }

  return changes;
}

async function main() {
  const dagBackfilled = await backfillDagJson();
  const staleChanges = await remediateStaleNodes();
  console.log(JSON.stringify({
    apply: APPLY,
    stale_hours: STALE_HOURS,
    targeted_mode: TARGETED_MODE,
    target_task_ids: TARGET_TASK_IDS,
    dag_json_backfilled: dagBackfilled,
    stale_nodes_remediated: staleChanges.length,
    stale_changes: staleChanges.slice(0, 50)
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ error: error.message }, null, 2));
    process.exit(1);
  })
  .finally(() => closeDb());
