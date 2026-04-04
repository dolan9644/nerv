/**
 * ███ NERV 本部战术系统 · 数据库封装层 ███
 * 
 * SQLite WAL + SQLITE_BUSY 指数退避重试
 * 所有 Agent 通过此模块与 nerv.db 交互
 * 
 * 用法：
 *   import { updateNodeStatus, incrementRetry, getReadyDownstream, writeAuditLog } from './db.js';
 */

import Database from 'better-sqlite3';
import { resolve, dirname } from 'path';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ═══════════════════════════════════════════════════════════════
// 配置
// ═══════════════════════════════════════════════════════════════

const DB_PATH = resolve(
  process.env.NERV_DB_PATH || resolve(__dirname, '..', 'data', 'db', 'nerv.db')
);
const INIT_SQL_PATH = resolve(__dirname, 'init_db.sql');
const MAX_RETRIES = 5;
const BASE_DELAY_MS = 50;

// ═══════════════════════════════════════════════════════════════
// 连接管理
// ═══════════════════════════════════════════════════════════════

let _db = null;

function getDb() {
  if (!_db) {
    // 确保 data 目录存在
    const dataDir = dirname(DB_PATH);
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }

    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('busy_timeout = 5000');
    _db.pragma('foreign_keys = ON');

    // 首次连接时初始化表结构
    if (existsSync(INIT_SQL_PATH)) {
      const initSql = readFileSync(INIT_SQL_PATH, 'utf-8');
      // 过滤掉 PRAGMA 语句（已在上面执行）
      const statements = initSql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('PRAGMA'));
      
      const initTransaction = _db.transaction(() => {
        for (const stmt of statements) {
          try {
            _db.exec(stmt + ';');
          } catch (err) {
            // 忽略 "table already exists" 等幂等错误
            if (!err.message.includes('already exists')) {
              console.error(`[NERV·DB] Init error: ${err.message}`);
            }
          }
        }
      });
      initTransaction();
    }
  }
  return _db;
}

function closeDb() {
  if (_db) {
    _db.close();
    _db = null;
  }
}

// ═══════════════════════════════════════════════════════════════
// SQLITE_BUSY 指数退避重试 (异步非阻塞版)
// 多 Agent 并发写入时的必要防护
// 核心：用 async/await 让出 Event Loop，防止主线程假死
// ═══════════════════════════════════════════════════════════════

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function withRetry(fn, retries = MAX_RETRIES) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return fn(getDb());
    } catch (err) {
      const isBusy = err.code === 'SQLITE_BUSY' || 
                     (err.message && err.message.includes('database is locked'));
      
      if (isBusy && attempt < retries) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 50;
        console.warn(`[NERV·DB] SQLITE_BUSY: 线程让步，退避等待 ${Math.round(delay)}ms (Attempt ${attempt + 1})`);
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// 任务（Tasks）操作
// ═══════════════════════════════════════════════════════════════

async function createTask(taskId, initiatorId, intent, priority = 0, dagJson = null) {
  const result = await withRetry((db) => {
    db.prepare(`
      INSERT INTO tasks (task_id, initiator_id, intent, priority, dag_json)
      VALUES (?, ?, ?, ?, ?)
    `).run(taskId, initiatorId, intent, priority, dagJson);
    return taskId;
  });
  await writeAuditLog(taskId, null, 'misato', 'CREATE_TASK', JSON.stringify({ intent, priority }));
  return result;
}

async function updateTaskStatus(taskId, status, resultSummary = null) {
  return withRetry((db) => {
    db.prepare(`
      UPDATE tasks 
      SET status = ?, result_summary = ?, updated_at = strftime('%s','now')
      WHERE task_id = ?
    `).run(status, resultSummary, taskId);
  });
}

async function getTask(taskId) {
  return withRetry((db) => {
    return db.prepare('SELECT * FROM tasks WHERE task_id = ?').get(taskId);
  });
}

async function getTasksByStatus(status) {
  return withRetry((db) => {
    return db.prepare('SELECT * FROM tasks WHERE status = ? ORDER BY priority DESC, created_at ASC').all(status);
  });
}

// ═══════════════════════════════════════════════════════════════
// DAG 节点操作
// ═══════════════════════════════════════════════════════════════

async function createDagNode(nodeId, taskId, agentId, description, depth = 0, maxRetries = 3) {
  return withRetry((db) => {
    db.prepare(`
      INSERT INTO dag_nodes (node_id, task_id, agent_id, description, depth, max_retries)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(nodeId, taskId, agentId, description, depth, maxRetries);
  });
}

async function createDagEdge(taskId, fromNode, toNode) {
  return withRetry((db) => {
    db.prepare(`
      INSERT OR IGNORE INTO dag_edges (task_id, from_node, to_node)
      VALUES (?, ?, ?)
    `).run(taskId, fromNode, toNode);
  });
}

async function updateNodeStatus(nodeId, status, resultPath = null, errorLog = null) {
  return withRetry((db) => {
    const updates = { status, result_path: resultPath, error_log: errorLog };
    
    // 自动设置 started_at / completed_at
    if (status === 'RUNNING') {
      db.prepare(`
        UPDATE dag_nodes
        SET status = ?, result_path = ?, error_log = ?, 
            started_at = strftime('%s','now'), updated_at = strftime('%s','now')
        WHERE node_id = ?
      `).run(status, resultPath, errorLog, nodeId);
    } else if (status === 'DONE' || status === 'FAILED' || status === 'CIRCUIT_BROKEN') {
      db.prepare(`
        UPDATE dag_nodes
        SET status = ?, result_path = ?, error_log = ?,
            completed_at = strftime('%s','now'), updated_at = strftime('%s','now')
        WHERE node_id = ?
      `).run(status, resultPath, errorLog, nodeId);
    } else {
      db.prepare(`
        UPDATE dag_nodes
        SET status = ?, result_path = ?, error_log = ?,
            updated_at = strftime('%s','now')
        WHERE node_id = ?
      `).run(status, resultPath, errorLog, nodeId);
    }
  });
}

/**
 * 增加重试计数并检查是否超限
 * @returns {{ allowed: boolean, retryCount: number, maxRetries: number }}
 */
async function incrementRetry(nodeId) {
  return withRetry((db) => {
    const node = db.prepare(
      'SELECT retry_count, max_retries FROM dag_nodes WHERE node_id = ?'
    ).get(nodeId);

    if (!node) throw new Error(`[NERV·DB] Node ${nodeId} not found`);

    const newCount = node.retry_count + 1;
    db.prepare(
      `UPDATE dag_nodes SET retry_count = ?, updated_at = strftime('%s','now') WHERE node_id = ?`
    ).run(newCount, nodeId);

    return {
      allowed: newCount < node.max_retries,
      retryCount: newCount,
      maxRetries: node.max_retries
    };
  });
}

/**
 * 查询某节点完成后，所有可触发的下游节点
 * 条件：所有前置依赖都已 DONE 的 PENDING 节点
 */
async function getReadyDownstream(nodeId, taskId) {
  return withRetry((db) => {
    return db.prepare(`
      SELECT dn.node_id, dn.agent_id, dn.description
      FROM dag_edges e
      JOIN dag_nodes dn ON e.to_node = dn.node_id
      WHERE e.from_node = ? AND dn.task_id = ? AND dn.status = 'PENDING'
      AND NOT EXISTS (
        SELECT 1 FROM dag_edges e2
        JOIN dag_nodes dn2 ON e2.from_node = dn2.node_id
        WHERE e2.to_node = dn.node_id AND e2.task_id = ? AND dn2.status != 'DONE'
      )
    `).all(nodeId, taskId, taskId);
  });
}

/**
 * 获取没有前置依赖的入口节点（DAG 起点）
 */
async function getEntryNodes(taskId) {
  return withRetry((db) => {
    return db.prepare(`
      SELECT dn.* FROM dag_nodes dn
      WHERE dn.task_id = ? AND dn.status = 'PENDING'
      AND NOT EXISTS (
        SELECT 1 FROM dag_edges e WHERE e.to_node = dn.node_id AND e.task_id = ?
      )
    `).all(taskId, taskId);
  });
}

/**
 * 检查任务的所有节点是否全部完成
 */
async function isTaskComplete(taskId) {
  return withRetry((db) => {
    const result = db.prepare(`
      SELECT COUNT(*) as total,
             SUM(CASE WHEN status = 'DONE' THEN 1 ELSE 0 END) as done,
             SUM(CASE WHEN status IN ('FAILED', 'CIRCUIT_BROKEN') THEN 1 ELSE 0 END) as failed
      FROM dag_nodes WHERE task_id = ?
    `).get(taskId);

    return {
      complete: result.total === result.done,
      hasFailed: result.failed > 0,
      total: result.total,
      done: result.done,
      failed: result.failed
    };
  });
}

/**
 * Spear 状态对齐器：获取所有疑似孤岛节点
 * RUNNING 超过指定秒数且无活跃 run
 */
async function getOrphanNodes(thresholdSeconds = 120) {
  return withRetry((db) => {
    const cutoff = Math.floor(Date.now() / 1000) - thresholdSeconds;
    return db.prepare(`
      SELECT node_id, task_id, agent_id, updated_at
      FROM dag_nodes
      WHERE status = 'RUNNING' AND updated_at < ?
    `).all(cutoff);
  });
}

/**
 * 将失败节点的所有下游标记为 BLOCKED
 */
async function blockDownstream(nodeId, taskId) {
  return withRetry((db) => {
    const downstream = db.prepare(`
      WITH RECURSIVE downstream_nodes(nid) AS (
        SELECT to_node FROM dag_edges WHERE from_node = ? AND task_id = ?
        UNION
        SELECT e.to_node FROM dag_edges e
        JOIN downstream_nodes dn ON e.from_node = dn.nid
        WHERE e.task_id = ?
      )
      SELECT nid FROM downstream_nodes
    `).all(nodeId, taskId, taskId);

    const blockStmt = db.prepare(
      `UPDATE dag_nodes SET status = 'BLOCKED', updated_at = strftime('%s','now') WHERE node_id = ? AND status = 'PENDING'`
    );

    const blockAll = db.transaction(() => {
      for (const row of downstream) {
        blockStmt.run(row.nid);
      }
    });
    blockAll();

    return downstream.length;
  });
}

// ═══════════════════════════════════════════════════════════════
// 审计日志
// ═══════════════════════════════════════════════════════════════

async function writeAuditLog(taskId, nodeId, agentId, action, detail = null, durationMs = null) {
  return withRetry((db) => {
    db.prepare(`
      INSERT INTO audit_logs (task_id, node_id, agent_id, action, detail, duration_ms)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(taskId, nodeId, agentId, action, detail, durationMs);
  });
}

async function getAuditLogs(taskId = null, limit = 100) {
  return withRetry((db) => {
    if (taskId) {
      return db.prepare(
        'SELECT * FROM audit_logs WHERE task_id = ? ORDER BY created_at DESC LIMIT ?'
      ).all(taskId, limit);
    }
    return db.prepare(
      'SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?'
    ).all(limit);
  });
}

// ═══════════════════════════════════════════════════════════════
// MARDUK Skill 注册表
// ═══════════════════════════════════════════════════════════════

async function upsertSkill(skillName, description, path, tags = [], compatibleAgents = [], opts = {}) {
  const { pattern = null, source_type = 'native', adapter_path = null, dockerfile_path = null } = opts;
  return withRetry((db) => {
    db.prepare(`
      INSERT INTO skill_registry 
        (skill_name, description, path, tags, compatible_agents, pattern, source_type, adapter_path, dockerfile_path, scanned_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%s','now'))
      ON CONFLICT(skill_name) DO UPDATE SET
        description = excluded.description,
        path = excluded.path,
        tags = excluded.tags,
        compatible_agents = excluded.compatible_agents,
        pattern = excluded.pattern,
        source_type = excluded.source_type,
        adapter_path = excluded.adapter_path,
        dockerfile_path = excluded.dockerfile_path,
        scanned_at = strftime('%s','now')
    `).run(skillName, description, path, JSON.stringify(tags), JSON.stringify(compatibleAgents),
           pattern, source_type, adapter_path, dockerfile_path);
  });
}

/**
 * 路由匹配成功后更新 last_used_at（misato 调用）
 */
async function touchSkill(skillName) {
  return withRetry((db) => {
    db.prepare(`UPDATE skill_registry SET last_used_at = strftime('%s','now') WHERE skill_name = ?`).run(skillName);
  });
}

async function searchSkills(keyword) {
  return withRetry((db) => {
    return db.prepare(`
      SELECT * FROM skill_registry 
      WHERE skill_name LIKE ? OR description LIKE ? OR tags LIKE ?
    `).all(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  });
}

// ═══════════════════════════════════════════════════════════════
// 异步审批队列（pending_approvals）
// gendo 写入 → adam_notifier 推送 → 造物主批复
// ═══════════════════════════════════════════════════════════════

async function createApproval(taskId, approvalType, payload, requestedBy) {
  return withRetry((db) => {
    const info = db.prepare(`
      INSERT INTO pending_approvals (task_id, approval_type, payload, requested_by)
      VALUES (?, ?, ?, ?)
    `).run(taskId, approvalType, JSON.stringify(payload), requestedBy);
    return { id: info.lastInsertRowid };
  });
}

async function getPendingApprovals(status = 'PENDING') {
  return withRetry((db) => {
    return db.prepare(`
      SELECT * FROM pending_approvals WHERE status = ? ORDER BY created_at DESC
    `).all(status);
  });
}

async function resolveApproval(id, status, resolvedBy = '造物主') {
  return withRetry((db) => {
    const info = db.prepare(`
      UPDATE pending_approvals 
      SET status = ?, resolved_at = strftime('%s','now'), resolved_by = ?
      WHERE id = ? AND status = 'PENDING'
    `).run(status, resolvedBy, id);
    return { changed: info.changes };
  });
}

// ═══════════════════════════════════════════════════════════════
// 原子化 DAG 创建（事务封装）
// Task + Nodes + Edges + AuditLog 全有或全无 (All-or-Nothing)
// ═══════════════════════════════════════════════════════════════

/**
 * @param {Object} params
 * @param {string} params.taskId
 * @param {string} params.initiatorId
 * @param {string} params.intent
 * @param {number} params.priority
 * @param {Array<{node_id, agent_id, description, depth?, max_retries?}>} params.nodes
 * @param {Array<{from, to}>} params.edges
 */
function createFullDag({ taskId, initiatorId, intent, priority = 0, nodes, edges = [] }) {
  const db = getDb();
  const dagJson = JSON.stringify({ nodes, edges });

  const txn = db.transaction(() => {
    // 1. 创建 Task
    db.prepare(`
      INSERT INTO tasks (task_id, initiator_id, intent, priority, dag_json)
      VALUES (?, ?, ?, ?, ?)
    `).run(taskId, initiatorId, intent, priority, dagJson);

    // 2. 批量创建 Nodes
    const stmtNode = db.prepare(`
      INSERT INTO dag_nodes (node_id, task_id, agent_id, description, depth, max_retries)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const n of nodes) {
      stmtNode.run(n.node_id, taskId, n.agent_id, n.description, n.depth ?? 0, n.max_retries ?? 3);
    }

    // 3. 批量创建 Edges
    const stmtEdge = db.prepare(`
      INSERT OR IGNORE INTO dag_edges (task_id, from_node, to_node)
      VALUES (?, ?, ?)
    `);
    for (const e of edges) {
      stmtEdge.run(taskId, e.from, e.to);
    }

    // 4. 审计日志
    db.prepare(`
      INSERT INTO audit_logs (task_id, node_id, agent_id, action, detail)
      VALUES (?, NULL, ?, 'DAG_CREATED', ?)
    `).run(taskId, initiatorId, JSON.stringify({ node_count: nodes.length, edge_count: edges.length }));
  });

  // 执行事务（原子化：任何一步失败全部回滚）
  txn();
  return { taskId, nodesCreated: nodes.length, edgesCreated: edges.length };
}

// ═══════════════════════════════════════════════════════════════
// 导出
// ═══════════════════════════════════════════════════════════════

export {
  // 连接管理
  getDb, closeDb,
  // 通用
  withRetry,
  // Tasks
  createTask, updateTaskStatus, getTask, getTasksByStatus,
  // DAG Nodes
  createDagNode, createDagEdge, updateNodeStatus, incrementRetry,
  getReadyDownstream, getEntryNodes, isTaskComplete,
  // DAG 原子创建
  createFullDag,
  // Spear 对齐器
  getOrphanNodes, blockDownstream,
  // 审计
  writeAuditLog, getAuditLogs,
  // MARDUK
  upsertSkill, searchSkills, touchSkill,
  // 异步审批
  createApproval, getPendingApprovals, resolveApproval
};
