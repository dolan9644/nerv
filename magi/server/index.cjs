/**
 * ███ MAGI API Server v3.0 (War Room Edition) ███
 *
 * v3.0 新增端點:
 *   - /api/approvals     — pending_approvals 審批佇列
 *   - /api/harness-stats — 三道防線（熔斷/質檢/校驗）統計
 *   - /api/dag/:taskId   — 單任務 DAG 拓撲詳情
 *   - /api/system-stats  — 全系統節點/任務計數
 *
 * 修正了對 nerv.db 的 Schema 幻覺：
 *   - 不再查不存在的 agents 表做状态，改用静态名册 + dag_nodes 聚合
 *   - 正确使用 audit_logs（非 event_log）
 *   - 正确使用 dag_nodes 字段名：agent_id, description, depth
 *   - 真实查询 dag_edges 还原拓扑（非前端伪造边）
 *   - 所有 catch 打印 e.message（不吞异常）
 *
 * 新增：SSE (Server-Sent Events) 实时推送通道 /api/stream
 *
 * 端口：3939（NERV 専用・避免与 OpenClaw Gateway 18789 冲突）
 */

const http = require('http');
const path = require('path');
const fs = require('fs');

const NERV_ROOT = path.join(process.env.HOME, '.openclaw', 'nerv');
const PORT = 3939;

function readJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

// ─── 数据库连接 ───
let db;
try {
  const Database = require('better-sqlite3');
  const dbPath = path.join(NERV_ROOT, 'data', 'db', 'nerv.db');
  if (fs.existsSync(dbPath)) {
    db = new Database(dbPath, { readonly: true });
    db.pragma('journal_mode = WAL');
    console.log('🟢 [MAGI] Connected to nerv.db (ReadOnly)');
  } else {
    console.warn('🟡 [MAGI] nerv.db not found at ' + dbPath);
  }
} catch (e) {
  console.error('🔴 [MAGI] DB Initialization failed:', e.message);
}

// ─── NERV 静态机体名册（替代不存在的 agents 表） ───
const NERV_ROSTER = [
  'misato', 'seele', 'ritsuko', 'shinji', 'rei',
  'asuka-shikinami', 'kaworu', 'mari', 'gendo',
  'eva-00', 'eva-01', 'eva-02', 'eva-03', 'eva-13', 'eva-series'
];

// ─── API 处理器 ───

function apiAgents() {
  if (!db) return mockAgents();
  try {
    // 聚合 dag_nodes 表，计算每个 Agent 当前运行 + 完成数
    const stats = db.prepare(`
      SELECT agent_id, 
             SUM(CASE WHEN status = 'RUNNING' THEN 1 ELSE 0 END) as active_count,
             SUM(CASE WHEN status = 'DONE' THEN 1 ELSE 0 END) as done_count
      FROM dag_nodes
      GROUP BY agent_id
    `).all();

    const statsMap = Object.fromEntries(stats.map(s => [s.agent_id, s]));

    return NERV_ROSTER.map(id => {
      const s = statsMap[id] || { active_count: 0, done_count: 0 };
      return {
        id: `nerv-${id}`,
        status: s.active_count > 0 ? 'ACTIVE' : 'IDLE',
        active_tasks: s.active_count,
        total_completed: s.done_count
      };
    });
  } catch (e) {
    console.error('[DB Error] apiAgents:', e.message);
    return mockAgents();
  }
}

function apiTasks() {
  if (!db) return [];
  try {
    // 获取活跃任务（使用正确字段名 intent → title）
    const tasks = db.prepare(`
      SELECT task_id as id, intent as title, status, priority, created_at
      FROM tasks 
      WHERE status IN ('PENDING','RUNNING','PAUSED')
      ORDER BY priority DESC, created_at DESC LIMIT 5
    `).all();

    // 真实 DAG 拓扑：从 dag_nodes + dag_edges 两张表读取
    const stmtNodes = db.prepare(
      `SELECT node_id as id, description as label, agent_id as agent, status, depth 
       FROM dag_nodes WHERE task_id = ?`
    );
    const stmtEdges = db.prepare(
      `SELECT from_node as "from", to_node as "to" 
       FROM dag_edges WHERE task_id = ?`
    );

    for (let t of tasks) {
      t.nodes = stmtNodes.all(t.id);
      t.edges = stmtEdges.all(t.id);   // 真实边，不再伪造
    }
    return tasks;
  } catch (e) {
    console.error('[DB Error] apiTasks:', e.message);
    return [];
  }
}

function apiLogs() {
  if (!db) return [];
  try {
    // 正确表名 audit_logs（非 event_log）
    return db.prepare(`
      SELECT id, task_id, agent_id, action, detail, duration_ms, created_at
      FROM audit_logs
      ORDER BY created_at DESC
      LIMIT 50
    `).all();
  } catch (e) {
    console.error('[DB Error] apiLogs:', e.message);
    return [];
  }
}

function apiApprovals() {
  if (!db) return [];
  try {
    return db.prepare(`
      SELECT id, approval_type, payload, requested_by, status, created_at, resolved_at, resolved_by
      FROM pending_approvals
      ORDER BY CASE status WHEN 'PENDING' THEN 0 ELSE 1 END, created_at DESC
      LIMIT 20
    `).all().map(row => ({
      ...row,
      payload: (() => { try { return JSON.parse(row.payload); } catch { return row.payload; } })()
    }));
  } catch (e) {
    console.error('[DB Error] apiApprovals:', e.message);
    return [];
  }
}

function apiHarnessStats() {
  if (!db) return { summary: {}, recent: [] };
  try {
    const summary = db.prepare(`
      SELECT harness_type,
             COUNT(*) as total,
             SUM(CASE WHEN result = 'PASS' THEN 1 ELSE 0 END) as pass_count,
             SUM(CASE WHEN result != 'PASS' THEN 1 ELSE 0 END) as fail_count
      FROM harness_stats
      GROUP BY harness_type
    `).all();

    const recent = db.prepare(`
      SELECT id, harness_type, task_id, result, detail, created_at
      FROM harness_stats
      ORDER BY created_at DESC
      LIMIT 30
    `).all().map(row => ({
      ...row,
      detail: (() => { try { return JSON.parse(row.detail); } catch { return row.detail; } })()
    }));

    return {
      summary: Object.fromEntries(summary.map(s => [s.harness_type, s])),
      recent
    };
  } catch (e) {
    console.error('[DB Error] apiHarnessStats:', e.message);
    return { summary: {}, recent: [] };
  }
}

function apiDagDetail(taskId) {
  if (!db) return null;
  try {
    const task = db.prepare('SELECT * FROM tasks WHERE task_id = ?').get(taskId);
    if (!task) return null;
    const nodes = db.prepare(
      `SELECT node_id as id, description as label, agent_id as agent, status, depth,
              started_at, completed_at, result_path, error_log, retry_count, max_retries
       FROM dag_nodes WHERE task_id = ?`
    ).all(taskId);
    const edges = db.prepare(
      `SELECT from_node as "from", to_node as "to" FROM dag_edges WHERE task_id = ?`
    ).all(taskId);
    return { ...task, nodes, edges };
  } catch (e) {
    console.error('[DB Error] apiDagDetail:', e.message);
    return null;
  }
}

function apiSkills() {
  if (!db) return [];
  try {
    return db.prepare(`
      SELECT skill_name, path, pattern, compatible_agents, source_type,
             adapter_path, dockerfile_path, created_at
      FROM skill_registry
      ORDER BY source_type ASC, created_at DESC
    `).all().map(row => ({
      ...row,
      compatible_agents: (() => { try { return JSON.parse(row.compatible_agents); } catch { return row.compatible_agents; } })()
    }));
  } catch (e) {
    console.error('[DB Error] apiSkills:', e.message);
    return [];
  }
}

function apiDeadSeaScrolls() {
  if (!db) return { completed_tasks: [], total: 0 };
  try {
    const tasks = db.prepare(`
      SELECT task_id, intent, status, priority, created_at, completed_at
      FROM tasks
      WHERE status IN ('DONE', 'FAILED')
      ORDER BY completed_at DESC
      LIMIT 50
    `).all();
    const total = db.prepare(`SELECT COUNT(*) as c FROM tasks WHERE status IN ('DONE','FAILED')`).get();
    return { completed_tasks: tasks, total: total.c };
  } catch (e) {
    console.error('[DB Error] apiDeadSeaScrolls:', e.message);
    return { completed_tasks: [], total: 0 };
  }
}

function apiBreakerLogs() {
  if (!db) return [];
  try {
    return db.prepare(`
      SELECT id, harness_type, task_id, result, detail, created_at
      FROM harness_stats
      WHERE harness_type = 'seele_breaker'
      ORDER BY created_at DESC
      LIMIT 30
    `).all().map(row => ({
      ...row,
      detail: (() => { try { return JSON.parse(row.detail); } catch { return row.detail; } })()
    }));
  } catch (e) {
    console.error('[DB Error] apiBreakerLogs:', e.message);
    return [];
  }
}

function apiSystemStats() {
  if (!db) return { tasks: {}, nodes: {}, harness: {} };
  try {
    const taskStats = db.prepare(`
      SELECT status, COUNT(*) as count FROM tasks GROUP BY status
    `).all();
    const nodeStats = db.prepare(`
      SELECT status, COUNT(*) as count FROM dag_nodes GROUP BY status
    `).all();
    return {
      tasks: Object.fromEntries(taskStats.map(r => [r.status, r.count])),
      nodes: Object.fromEntries(nodeStats.map(r => [r.status, r.count]))
    };
  } catch (e) {
    console.error('[DB Error] apiSystemStats:', e.message);
    return { tasks: {}, nodes: {} };
  }
}

function apiInfraJobState(jobId) {
  return readJsonSafe(path.join(NERV_ROOT, 'data', 'runtime', 'jobs', `${jobId}.json`));
}

function apiStatus() {
  const tasks = apiTasks();
  const activeDag = tasks.find(t => t.status === 'RUNNING') || tasks[0] || null;
  const approvals = apiApprovals();
  const pendingCount = approvals.filter(a => a.status === 'PENDING').length;
  return {
    agents: apiAgents(),
    activeDag,
    spear: apiInfraJobState('nerv-spear-sync'),
    approvals_pending: pendingCount,
    stats: apiSystemStats(),
    timestamp: new Date().toISOString()
  };
}

function mockAgents() {
  return NERV_ROSTER.map(id => ({
    id: `nerv-${id}`, status: 'OFFLINE', active_tasks: 0, total_completed: 0
  }));
}

// ─── HTTP 服务器 ───
const server = http.createServer((req, res) => {
  // CORS 跨域放行
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const json = (data) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  };

  // URL 解析（支持路径参数）
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // 1. 常规 REST API
  if (pathname === '/api/status')        return json(apiStatus());
  if (pathname === '/api/agents')        return json(apiAgents());
  if (pathname === '/api/tasks')         return json(apiTasks());
  if (pathname === '/api/logs')          return json(apiLogs());
  if (pathname === '/api/approvals')      return json(apiApprovals());
  if (pathname === '/api/harness-stats')  return json(apiHarnessStats());
  if (pathname === '/api/system-stats')   return json(apiSystemStats());
  if (pathname === '/api/runtime')        return json({ spear: apiInfraJobState('nerv-spear-sync') });
  if (pathname === '/api/skills')         return json(apiSkills());
  if (pathname === '/api/scrolls')        return json(apiDeadSeaScrolls());
  if (pathname === '/api/breaker-logs')   return json(apiBreakerLogs());

  // DAG 详情（路径参数）
  const dagMatch = pathname.match(/^\/api\/dag\/(.+)$/);
  if (dagMatch) return json(apiDagDetail(dagMatch[1]) || { error: 'Task not found' });

  // 2. SSE (Server-Sent Events) 实时推送通道
  if (pathname === '/api/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    // 立即推送一次当前状态
    res.write(`data: ${JSON.stringify(apiStatus())}\n\n`);

    // 每 2 秒推送增量
    const interval = setInterval(() => {
      try {
        res.write(`data: ${JSON.stringify(apiStatus())}\n\n`);
      } catch (e) {
        clearInterval(interval);
      }
    }, 2000);

    req.on('close', () => clearInterval(interval));
    return;
  }

  res.writeHead(404);
  res.end('Not Found — MAGI API v3.0 (use /api/status, /api/approvals, /api/harness-stats, /api/stream)');
});

server.listen(PORT, () => {
  console.log(`[MAGI] API Server v2.1: http://localhost:${PORT}`);
  console.log(`[MAGI] REST:         http://localhost:${PORT}/api/status`);
  console.log(`[MAGI] Live Stream:  http://localhost:${PORT}/api/stream`);
  console.log(`[MAGI] DB:           ${db ? 'connected (readonly)' : 'offline (mock mode)'}`);
});
