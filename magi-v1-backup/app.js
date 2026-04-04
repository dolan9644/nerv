/**
 * MAGI SYSTEM — NERV Tactical Dashboard
 * 读取 nerv.db 状态，可视化 Agent 矩阵 + DAG Pipeline + 操作日志
 *
 * 数据源：
 * 1. nerv.db（通过 API server 或直接 CLI 查询）
 * 2. OpenClaw Gateway WebSocket（ws://localhost:18789）
 *
 * 当前版本：离线模拟模式（Mock Data）
 * 生产版本：接入 api-server.js
 */

// ═══════════════════════════════════════════════════════════════
// Agent 定义
// ═══════════════════════════════════════════════════════════════

const AGENTS = [
  { id: 'nerv-misato',      name: '葛城美里',  role: 'COMMANDER',  layer: 'command' },
  { id: 'nerv-seele',       name: 'SEELE',     role: 'OVERSIGHT',  layer: 'command' },
  { id: 'nerv-ritsuko',     name: '赤木律子',  role: 'CODE ORCH',  layer: 'orchestration' },
  { id: 'nerv-shinji',      name: '碇真嗣',    role: 'DATA ORCH',  layer: 'orchestration' },
  { id: 'nerv-rei',         name: '绫波零',    role: 'KNOWLEDGE',  layer: 'orchestration' },
  { id: 'nerv-asuka',       name: '式波明日香', role: 'DEBUGGER',   layer: 'frontline' },
  { id: 'nerv-kaworu',      name: '渚薰',      role: 'OPTIMIZER',  layer: 'frontline' },
  { id: 'nerv-eva01',       name: 'EVA-01',    role: 'DEPLOYER',   layer: 'frontline' },
  { id: 'nerv-mari',        name: '真希波',    role: 'CRAWLER',    layer: 'frontline' },
  { id: 'nerv-eva02',       name: 'EVA-02',    role: 'MONITOR',    layer: 'frontline' },
  { id: 'nerv-eva03',       name: 'EVA-03',    role: 'SEARCHER',   layer: 'frontline' },
  { id: 'nerv-eva00',       name: 'EVA-00',    role: 'CLEANSER',   layer: 'frontline' },
  { id: 'nerv-eva13',       name: 'EVA-13',    role: 'WRITER',     layer: 'frontline' },
  { id: 'nerv-gendo',       name: '碇源堂',    role: 'PUBLISHER',  layer: 'frontline' },
  { id: 'nerv-eva-series',  name: '量产机',    role: 'VISUAL',     layer: 'frontline' },
];

// ═══════════════════════════════════════════════════════════════
// 状态存储
// ═══════════════════════════════════════════════════════════════

const state = {
  agents: {},
  activeDag: null,
  logs: [],
  heartbeatNext: null,
  connected: false,
};

// 初始化 Agent 状态
AGENTS.forEach(a => {
  state.agents[a.id] = { ...a, status: 'idle', lastSeen: null, taskCount: 0 };
});

// ═══════════════════════════════════════════════════════════════
// 时钟
// ═══════════════════════════════════════════════════════════════

function updateClock() {
  const now = new Date();
  document.getElementById('clock').textContent =
    now.toLocaleTimeString('en-US', { hour12: false });
  document.getElementById('date').textContent =
    now.toISOString().split('T')[0];
}
setInterval(updateClock, 1000);
updateClock();

// ═══════════════════════════════════════════════════════════════
// Agent Matrix 渲染
// ═══════════════════════════════════════════════════════════════

function renderAgentGrid() {
  const grid = document.getElementById('agent-grid');
  grid.innerHTML = '';

  // 按层分组
  const layers = { command: [], orchestration: [], frontline: [] };
  AGENTS.forEach(a => layers[a.layer].push(a));

  Object.entries(layers).forEach(([layer, agents]) => {
    // 层标签
    const label = document.createElement('div');
    label.style.cssText = `
      font-size:8px; color:#606080; letter-spacing:2px;
      text-transform:uppercase; padding:4px 0 2px; margin-top:4px;
      border-bottom:1px solid #1a1a3e;
    `;
    label.textContent = layer === 'command' ? '▸ 指挥层' :
                       layer === 'orchestration' ? '▸ 编排层' : '▸ 作战层';
    grid.appendChild(label);

    agents.forEach(agent => {
      const s = state.agents[agent.id];
      const card = document.createElement('div');
      card.className = `agent-card status-${s.status}`;
      card.id = `card-${agent.id}`;
      card.innerHTML = `
        <div class="agent-status-dot ${s.status}"></div>
        <div style="flex:1;min-width:0">
          <div class="agent-id">${agent.name}</div>
          <div class="agent-role">${agent.role}</div>
        </div>
        <div style="font-size:8px;color:#606080">${s.taskCount || ''}</div>
      `;
      card.addEventListener('click', () => selectAgent(agent.id));
      grid.appendChild(card);
    });
  });
}

function selectAgent(agentId) {
  document.querySelectorAll('.agent-card').forEach(c => c.style.borderColor = '');
  const card = document.getElementById(`card-${agentId}`);
  if (card) card.style.borderColor = 'var(--nerv-orange)';
  addLog('SYSTEM', 'sync', `Selected agent: ${agentId}`);
}

// ═══════════════════════════════════════════════════════════════
// 操作日志
// ═══════════════════════════════════════════════════════════════

function addLog(source, event, message) {
  const now = new Date();
  const time = now.toLocaleTimeString('en-US', { hour12: false });

  const entry = { time, source, event, message };
  state.logs.unshift(entry);
  if (state.logs.length > 200) state.logs.pop();

  renderLogEntry(entry, true);
}

function renderLogEntry(entry, prepend = false) {
  const container = document.getElementById('log-entries');
  const el = document.createElement('div');
  el.className = 'log-entry';
  el.innerHTML = `
    <span class="log-time">${entry.time}</span>
    <span class="log-source">${entry.source}</span>
    <span class="log-event ${entry.event}">${entry.event.toUpperCase()}</span>
    <span class="log-message">${entry.message}</span>
  `;
  if (prepend) {
    container.prepend(el);
  } else {
    container.appendChild(el);
  }
}

// ═══════════════════════════════════════════════════════════════
// DAG 可视化
// ═══════════════════════════════════════════════════════════════

function renderDag(dag) {
  if (!dag || !dag.nodes || dag.nodes.length === 0) {
    document.getElementById('dag-empty').style.display = 'flex';
    document.getElementById('dag-svg').style.display = 'none';
    document.getElementById('dag-badge').textContent = 'NO ACTIVE DAG';
    document.getElementById('dag-badge').style.cssText = 'color:#606080';
    return;
  }

  document.getElementById('dag-empty').style.display = 'none';
  document.getElementById('dag-svg').style.display = 'block';
  document.getElementById('dag-badge').textContent = `TASK: ${dag.id.slice(0,8)}`;
  document.getElementById('dag-badge').style.cssText = 'color:var(--nerv-green);background:var(--nerv-green-dim)';

  const canvas = document.getElementById('dag-canvas');
  // 清除旧节点
  canvas.querySelectorAll('.dag-node').forEach(n => n.remove());

  const svg = document.getElementById('dag-svg');
  svg.innerHTML = '';

  const w = canvas.offsetWidth;
  const h = canvas.offsetHeight;
  const nodeW = 120;
  const nodeH = 50;

  // 按拓扑层排列
  const levels = {};
  dag.nodes.forEach(n => {
    if (!levels[n.level]) levels[n.level] = [];
    levels[n.level].push(n);
  });

  const levelKeys = Object.keys(levels).sort((a,b) => a - b);
  const levelGap = Math.min(160, (w - 40) / levelKeys.length);

  levelKeys.forEach((lvl, li) => {
    const nodes = levels[lvl];
    const colX = 40 + li * levelGap;
    const rowGap = Math.min(70, (h - 40) / nodes.length);

    nodes.forEach((node, ni) => {
      const y = 40 + ni * rowGap + (h - 40 - nodes.length * rowGap) / 2;

      node._x = colX + nodeW / 2;
      node._y = y + nodeH / 2;

      const el = document.createElement('div');
      el.className = `dag-node status-${node.status}`;
      el.style.cssText = `left:${colX}px;top:${y}px;width:${nodeW}px`;
      el.innerHTML = `
        <div class="dag-node-label">${node.label}</div>
        <div class="dag-node-agent">${node.agent}</div>
      `;
      canvas.appendChild(el);
    });
  });

  // 绘制连线
  if (dag.edges) {
    const nodeMap = {};
    dag.nodes.forEach(n => { nodeMap[n.id] = n; });

    dag.edges.forEach(e => {
      const from = nodeMap[e.from];
      const to = nodeMap[e.to];
      if (!from || !to) return;

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', from._x);
      line.setAttribute('y1', from._y);
      line.setAttribute('x2', to._x);
      line.setAttribute('y2', to._y);
      line.setAttribute('stroke', to.status === 'running' ? '#00ff88' :
                                  to.status === 'completed' ? '#00ccff' :
                                  to.status === 'failed' ? '#ff2244' : '#1a1a3e');
      line.setAttribute('stroke-width', '1');
      line.setAttribute('stroke-dasharray', to.status === 'pending' ? '4,4' : 'none');
      svg.appendChild(line);
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// MAGI 三机体
// ═══════════════════════════════════════════════════════════════

function updateMagi(melchior, balthasar, casper) {
  const units = [
    { id: 'melchior-status', status: melchior },
    { id: 'balthasar-status', status: balthasar },
    { id: 'casper-status', status: casper },
  ];
  units.forEach(u => {
    const el = document.getElementById(u.id);
    el.textContent = u.status.toUpperCase();
    el.className = 'magi-status';
    if (u.status === 'approve') el.classList.add('approve');
    if (u.status === 'deny') el.classList.add('deny');
  });
}

// ═══════════════════════════════════════════════════════════════
// 心跳计时器
// ═══════════════════════════════════════════════════════════════

let heartbeatCountdown = 300; // 5 minutes
function updateHeartbeatTimer() {
  heartbeatCountdown--;
  if (heartbeatCountdown <= 0) {
    heartbeatCountdown = 300;
    addLog('SPEAR', 'heartbeat', 'Heartbeat cycle triggered — checking RUNNING nodes');
    // 模拟 Spear 检查
    const syncDot = document.querySelector('.sync-dot');
    syncDot.style.background = 'var(--nerv-yellow)';
    setTimeout(() => {
      syncDot.style.background = 'var(--nerv-green)';
      addLog('SPEAR', 'sync', 'All nodes aligned — HEARTBEAT_OK');
    }, 2000);
  }

  const min = Math.floor(heartbeatCountdown / 60);
  const sec = heartbeatCountdown % 60;
  document.getElementById('heartbeat-timer').textContent =
    `NEXT HB: ${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}
setInterval(updateHeartbeatTimer, 1000);

// ═══════════════════════════════════════════════════════════════
// 初始化 & 模拟数据
// ═══════════════════════════════════════════════════════════════

function init() {
  renderAgentGrid();

  // 初始日志
  addLog('SYSTEM', 'sync', 'MAGI Dashboard initialized');
  addLog('SYSTEM', 'sync', '15 agents registered — sessions_send mode');
  addLog('SPEAR', 'heartbeat', 'Heartbeat interval: 5m (lightContext + isolatedSession)');
  addLog('CONFIG', 'sync', 'session.visibility: all — A2A enabled');

  // 初始 MAGI 状态
  updateMagi('standby', 'standby', 'standby');

  // 模拟 Demo DAG（可选）
  simulateDemoAfterDelay();
}

function simulateDemoAfterDelay() {
  setTimeout(() => {
    addLog('misato', 'dispatch', 'New DAG created: 小红书热点追踪');

    // 模拟 Agent 状态变化
    updateAgentStatus('nerv-misato', 'running');
    updateAgentStatus('nerv-shinji', 'running');

    setTimeout(() => {
      updateAgentStatus('nerv-mari', 'running');
      addLog('shinji', 'dispatch', 'sessions_send → nerv-mari: 抓取小红书热点');

      renderDag({
        id: 'demo-dag-001',
        nodes: [
          { id: 'n1', label: 'DISPATCH', agent: 'misato', level: 0, status: 'completed' },
          { id: 'n2', label: 'CRAWL', agent: 'mari', level: 1, status: 'running' },
          { id: 'n3', label: 'SEARCH', agent: 'eva-03', level: 1, status: 'pending' },
          { id: 'n4', label: 'CLEAN', agent: 'eva-00', level: 2, status: 'pending' },
          { id: 'n5', label: 'WRITE', agent: 'eva-13', level: 3, status: 'pending' },
          { id: 'n6', label: 'VISUAL', agent: 'eva-series', level: 3, status: 'pending' },
          { id: 'n7', label: 'PUBLISH', agent: 'gendo', level: 4, status: 'pending' },
        ],
        edges: [
          { from: 'n1', to: 'n2' },
          { from: 'n1', to: 'n3' },
          { from: 'n2', to: 'n4' },
          { from: 'n3', to: 'n4' },
          { from: 'n4', to: 'n5' },
          { from: 'n4', to: 'n6' },
          { from: 'n5', to: 'n7' },
          { from: 'n6', to: 'n7' },
        ]
      });

      // MAGI 决议
      updateMagi('approve', 'approve', 'approve');
    }, 2000);

    setTimeout(() => {
      updateAgentStatus('nerv-eva03', 'running');
      addLog('shinji', 'dispatch', 'sessions_send → nerv-eva03: Perplexity 搜索');
    }, 3500);

    setTimeout(() => {
      updateAgentStatus('nerv-mari', 'idle');
      addLog('mari', 'completed', 'TASK_COMPLETED — 抓取 42 条数据');
      state.agents['nerv-mari'].taskCount++;
      renderAgentGrid();
    }, 8000);

  }, 3000);
}

function updateAgentStatus(agentId, status) {
  if (state.agents[agentId]) {
    state.agents[agentId].status = status;
    state.agents[agentId].lastSeen = new Date().toISOString();
    renderAgentGrid();
  }
}

// ═══════════════════════════════════════════════════════════════
// API Server 连接（生产模式）
// ═══════════════════════════════════════════════════════════════

async function connectToApiServer(url = 'http://localhost:3001') {
  try {
    const res = await fetch(`${url}/api/status`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    state.connected = true;
    document.querySelector('.sync-text').textContent = 'CONNECTED';

    // 更新 Agent 状态
    if (data.agents) {
      data.agents.forEach(a => {
        if (state.agents[a.id]) {
          state.agents[a.id].status = a.status;
          state.agents[a.id].taskCount = a.task_count || 0;
        }
      });
      renderAgentGrid();
    }

    // 更新 DAG
    if (data.activeDag) {
      renderDag(data.activeDag);
    }

    // 轮询
    setTimeout(() => connectToApiServer(url), 5000);
  } catch (e) {
    state.connected = false;
    document.querySelector('.sync-text').textContent = 'OFFLINE';
    // 离线模式继续运行
    setTimeout(() => connectToApiServer(url), 10000);
  }
}

// ═══════════════════════════════════════════════════════════════
// 启动
// ═══════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  init();
  // 尝试连接 API server（静默失败则用模拟数据）
  connectToApiServer().catch(() => {});
});
