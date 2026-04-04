#!/usr/bin/env node
/**
 * NERV 端到端 DAG 测试
 * 模拟完整任务生命周期：
 *   misato 创建任务 → 分解 DAG → 节点逐步执行 → 汇总完成
 *
 * 用法: node e2e_dag_test.js
 */

const path = require('path');
const NERV_ROOT = path.join(process.env.HOME, '.openclaw', 'nerv');

// ─── 数据库连接 ───
let Database;
try {
  Database = require('better-sqlite3');
} catch (e) {
  // If better-sqlite3 not installed, use sqlite3 CLI fallback
  const { execSync } = require('child_process');
  const DB_PATH = path.join(NERV_ROOT, 'data', 'nerv.db');

  const sql = (query) => {
    try {
      return execSync(`sqlite3 "${DB_PATH}" "${query}"`, { encoding: 'utf-8' }).trim();
    } catch (e) {
      console.error(`SQL Error: ${e.message}`);
      return '';
    }
  };

  console.log('\n═══════════════════════════════════════');
  console.log(' NERV E2E DAG Test (sqlite3 CLI mode)');
  console.log('═══════════════════════════════════════\n');

  const TASK_ID = `test-${Date.now()}`;

  // Step 1: Create task
  console.log('Step 1: misato creates task...');
  sql(`INSERT INTO tasks (task_id, initiator_id, intent, priority, status) VALUES ('${TASK_ID}', 'user-dolan', '小红书热点追踪 Pipeline', 1, 'RUNNING')`);
  sql(`INSERT INTO audit_logs (task_id, agent_id, action, detail) VALUES ('${TASK_ID}', 'nerv-misato', 'DISPATCH', '{"intent":"小红书热点追踪"}')`);
  console.log(`  ✅ Task created: ${TASK_ID}`);

  // Step 2: Create DAG nodes
  console.log('\nStep 2: misato decomposes DAG...');
  const nodes = [
    ['dispatch', 'nerv-misato', '任务分发', 0],
    ['crawl', 'nerv-mari', '抓取小红书热点', 1],
    ['search', 'nerv-eva03', 'Perplexity 深度搜索', 1],
    ['clean', 'nerv-eva00', '数据清洗去重', 2],
    ['write', 'nerv-eva13', '文案生成', 3],
    ['publish', 'nerv-gendo', '多平台发布', 4],
  ];

  nodes.forEach(([id, agent, desc, depth]) => {
    const nodeId = `${TASK_ID}-${id}`;
    sql(`INSERT INTO dag_nodes (node_id, task_id, agent_id, description, depth, status) VALUES ('${nodeId}', '${TASK_ID}', '${agent}', '${desc}', ${depth}, 'PENDING')`);
    console.log(`  ✅ Node: ${id} → ${agent} (depth ${depth})`);
  });

  // Step 3: Create edges
  console.log('\nStep 3: Define DAG edges...');
  const edges = [
    ['dispatch', 'crawl'], ['dispatch', 'search'],
    ['crawl', 'clean'], ['search', 'clean'],
    ['clean', 'write'], ['write', 'publish'],
  ];

  edges.forEach(([from, to]) => {
    sql(`INSERT INTO dag_edges (task_id, from_node, to_node) VALUES ('${TASK_ID}', '${TASK_ID}-${from}', '${TASK_ID}-${to}')`);
    console.log(`  ✅ Edge: ${from} → ${to}`);
  });

  // Step 4: Simulate execution
  console.log('\nStep 4: Simulating execution...');

  // dispatch completes immediately
  sql(`UPDATE dag_nodes SET status='DONE', started_at=strftime('%s','now'), completed_at=strftime('%s','now') WHERE node_id='${TASK_ID}-dispatch'`);
  sql(`INSERT INTO audit_logs (task_id, node_id, agent_id, action, detail, duration_ms) VALUES ('${TASK_ID}', '${TASK_ID}-dispatch', 'nerv-misato', 'COMPLETE', '{"msg":"DAG dispatched"}', 150)`);
  console.log('  ✅ dispatch → DONE');

  // crawl starts and completes
  sql(`UPDATE dag_nodes SET status='RUNNING', started_at=strftime('%s','now') WHERE node_id='${TASK_ID}-crawl'`);
  sql(`INSERT INTO audit_logs (task_id, node_id, agent_id, action, detail) VALUES ('${TASK_ID}', '${TASK_ID}-crawl', 'nerv-mari', 'EXECUTE', '{"target":"xiaohongshu"}')`);
  sql(`UPDATE dag_nodes SET status='DONE', completed_at=strftime('%s','now'), result_path='shared/inbox/xhs_data.json' WHERE node_id='${TASK_ID}-crawl'`);
  sql(`INSERT INTO audit_logs (task_id, node_id, agent_id, action, detail, duration_ms) VALUES ('${TASK_ID}', '${TASK_ID}-crawl', 'nerv-mari', 'COMPLETE', '{"records":42}', 12000)`);
  console.log('  ✅ crawl → DONE (42 records)');

  // search starts and completes
  sql(`UPDATE dag_nodes SET status='DONE', started_at=strftime('%s','now'), completed_at=strftime('%s','now'), result_path='shared/inbox/search_results.json' WHERE node_id='${TASK_ID}-search'`);
  sql(`INSERT INTO audit_logs (task_id, node_id, agent_id, action, detail, duration_ms) VALUES ('${TASK_ID}', '${TASK_ID}-search', 'nerv-eva03', 'COMPLETE', '{"results":15}', 8000)`);
  console.log('  ✅ search → DONE (15 results)');

  // clean
  sql(`UPDATE dag_nodes SET status='DONE', started_at=strftime('%s','now'), completed_at=strftime('%s','now') WHERE node_id='${TASK_ID}-clean'`);
  sql(`INSERT INTO audit_logs (task_id, node_id, agent_id, action, detail, duration_ms) VALUES ('${TASK_ID}', '${TASK_ID}-clean', 'nerv-eva00', 'COMPLETE', '{"cleaned":38}', 3000)`);
  console.log('  ✅ clean → DONE (38 cleaned)');

  // write
  sql(`UPDATE dag_nodes SET status='DONE', started_at=strftime('%s','now'), completed_at=strftime('%s','now') WHERE node_id='${TASK_ID}-write'`);
  sql(`INSERT INTO audit_logs (task_id, node_id, agent_id, action, detail, duration_ms) VALUES ('${TASK_ID}', '${TASK_ID}-write', 'nerv-eva13', 'COMPLETE', '{"chars":2400}', 5000)`);
  console.log('  ✅ write → DONE (2400 chars)');

  // publish
  sql(`UPDATE dag_nodes SET status='DONE', started_at=strftime('%s','now'), completed_at=strftime('%s','now') WHERE node_id='${TASK_ID}-publish'`);
  sql(`INSERT INTO audit_logs (task_id, node_id, agent_id, action, detail, duration_ms) VALUES ('${TASK_ID}', '${TASK_ID}-publish', 'nerv-gendo', 'COMPLETE', '{"platforms":["xhs","feishu"]}', 2000)`);
  console.log('  ✅ publish → DONE');

  // Task completed
  sql(`UPDATE tasks SET status='DONE', result_summary='小红书热点追踪完成：抓取42条→清洗38条→生成文案2400字→已发布' WHERE task_id='${TASK_ID}'`);

  // Step 5: Verify
  console.log('\nStep 5: Verification...');
  const taskStatus = sql(`SELECT status FROM tasks WHERE task_id='${TASK_ID}'`);
  const doneNodes = sql(`SELECT COUNT(*) FROM dag_nodes WHERE task_id='${TASK_ID}' AND status='DONE'`);
  const totalNodes = sql(`SELECT COUNT(*) FROM dag_nodes WHERE task_id='${TASK_ID}'`);
  const logCount = sql(`SELECT COUNT(*) FROM audit_logs WHERE task_id='${TASK_ID}'`);
  const edgeCount = sql(`SELECT COUNT(*) FROM dag_edges WHERE task_id='${TASK_ID}'`);

  console.log(`  Task status: ${taskStatus}`);
  console.log(`  Nodes completed: ${doneNodes}/${totalNodes}`);
  console.log(`  Edges: ${edgeCount}`);
  console.log(`  Audit logs: ${logCount}`);

  const allDone = taskStatus === 'DONE' && doneNodes === totalNodes;
  console.log('\n═══════════════════════════════════════');
  console.log(allDone ? ' ✅ E2E TEST PASSED' : ' ❌ E2E TEST FAILED');
  console.log('═══════════════════════════════════════\n');

  process.exit(allDone ? 0 : 1);
}
