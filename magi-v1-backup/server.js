/**
 * MAGI API Server
 * 从 nerv.db 读取数据，提供 REST API 给 MAGI Dashboard
 *
 * 端口：3001（避免与 OpenClaw Gateway 18789 冲突）
 *
 * API:
 *   GET /api/status    — 全局状态（Agent + 活跃 DAG）
 *   GET /api/agents    — Agent 列表及状态
 *   GET /api/tasks     — 活跃任务列表
 *   GET /api/logs      — 最近操作日志
 */

const http = require('http');
const path = require('path');
const fs = require('fs');

const NERV_ROOT = path.join(process.env.HOME, '.openclaw', 'nerv');
const MAGI_DIR = path.join(NERV_ROOT, 'magi');
const PORT = 3001;

// ─── 数据库连接 ───
let db;
try {
  const Database = require('better-sqlite3');
  const dbPath = path.join(NERV_ROOT, 'data', 'nerv.db');
  if (fs.existsSync(dbPath)) {
    db = new Database(dbPath, { readonly: true });
    db.pragma('journal_mode = WAL');
    console.log('[MAGI] Connected to nerv.db');
  }
} catch (e) {
  console.log('[MAGI] nerv.db not available, using mock data');
}

// ─── MIME types ───
const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// ─── API 处理器 ───
function apiStatus() {
  const agents = apiAgents();
  const tasks = apiTasks();
  const activeDag = buildActiveDag(tasks);
  return { agents, activeDag, timestamp: new Date().toISOString() };
}

function apiAgents() {
  if (!db) return mockAgents();
  try {
    return db.prepare(`
      SELECT agent_id as id, status, current_task_id, last_heartbeat,
             (SELECT COUNT(*) FROM dag_nodes WHERE assigned_agent = agents.agent_id AND status = 'COMPLETED') as task_count
      FROM agents
    `).all();
  } catch (e) {
    return mockAgents();
  }
}

function apiTasks() {
  if (!db) return [];
  try {
    return db.prepare(`
      SELECT t.task_id as id, t.title, t.status, t.priority,
             t.created_at, t.updated_at,
             json_group_array(json_object(
               'id', n.node_id, 'label', n.label, 'agent', n.assigned_agent,
               'status', n.status, 'level', n.topo_order
             )) as nodes
      FROM tasks t
      LEFT JOIN dag_nodes n ON t.task_id = n.task_id
      WHERE t.status IN ('PENDING','RUNNING')
      GROUP BY t.task_id
      ORDER BY t.created_at DESC
      LIMIT 5
    `).all().map(t => {
      t.nodes = JSON.parse(t.nodes || '[]');
      return t;
    });
  } catch (e) {
    return [];
  }
}

function apiLogs() {
  if (!db) return [];
  try {
    return db.prepare(`
      SELECT * FROM event_log
      ORDER BY timestamp DESC
      LIMIT 50
    `).all();
  } catch (e) {
    return [];
  }
}

function buildActiveDag(tasks) {
  if (!tasks || tasks.length === 0) return null;
  const active = tasks.find(t => t.status === 'RUNNING') || tasks[0];
  if (!active || !active.nodes || active.nodes.length === 0) return null;

  // 构建 edges（基于 topo_order）
  const edges = [];
  const sorted = [...active.nodes].sort((a,b) => (a.level||0) - (b.level||0));
  for (let i = 0; i < sorted.length - 1; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      if ((sorted[j].level || 0) === (sorted[i].level || 0) + 1) {
        edges.push({ from: sorted[i].id, to: sorted[j].id });
      }
    }
  }

  return {
    id: active.id,
    title: active.title,
    status: active.status,
    nodes: active.nodes.map(n => ({
      ...n,
      status: (n.status || 'PENDING').toLowerCase()
    })),
    edges
  };
}

function mockAgents() {
  return [
    { id: 'nerv-misato', status: 'IDLE', task_count: 0 },
    { id: 'nerv-seele', status: 'IDLE', task_count: 0 },
    { id: 'nerv-ritsuko', status: 'IDLE', task_count: 0 },
    { id: 'nerv-shinji', status: 'IDLE', task_count: 0 },
    { id: 'nerv-rei', status: 'IDLE', task_count: 0 },
  ];
}

// ─── HTTP 服务器 ───
const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  // API 路由
  if (req.url === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(apiStatus()));
    return;
  }
  if (req.url === '/api/agents') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(apiAgents()));
    return;
  }
  if (req.url === '/api/tasks') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(apiTasks()));
    return;
  }
  if (req.url === '/api/logs') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(apiLogs()));
    return;
  }

  // 静态文件服务
  let filePath = path.join(MAGI_DIR, req.url === '/' ? 'index.html' : req.url);
  const ext = path.extname(filePath);

  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end('Not Found');
    return;
  }

  const contentType = MIME[ext] || 'application/octet-stream';
  const content = fs.readFileSync(filePath);
  res.writeHead(200, { 'Content-Type': contentType });
  res.end(content);
});

server.listen(PORT, () => {
  console.log(`[MAGI] Dashboard: http://localhost:${PORT}`);
  console.log(`[MAGI] API:       http://localhost:${PORT}/api/status`);
  console.log(`[MAGI] DB:        ${db ? 'connected' : 'offline (mock mode)'}`);
});
