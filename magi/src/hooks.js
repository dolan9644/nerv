import { useState, useEffect, useCallback, useRef } from 'react';
import { AGENTS } from './data';

// ─── Agent 状态初始化 ───
function initAgentState() {
  const map = {};
  AGENTS.forEach(a => {
    map[a.id] = { ...a, status: 'idle', lastSeen: null, taskCount: 0 };
  });
  return map;
}

// ─── SSE 驱动的 Agent 状态 ───
export function useAgentStatus() {
  const [agents, setAgents] = useState(initAgentState);
  const [connected, setConnected] = useState(false);
  const [activeDag, setActiveDag] = useState(null);
  const [spear, setSpear] = useState(null);
  const [approvalsPending, setApprovalsPending] = useState(0);
  const [systemStats, setSystemStats] = useState({ tasks: {}, nodes: {} });
  const eventSourceRef = useRef(null);

  useEffect(() => {
    const es = new EventSource('/api/stream');
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setConnected(true);

        // Agent 状态映射
        if (data.agents) {
          setAgents(prev => {
            const next = { ...prev };
            data.agents.forEach(a => {
              if (next[a.id]) {
                const status = a.status === 'ACTIVE' ? 'running'
                             : a.status === 'CIRCUIT_BROKEN' ? 'error'
                             : 'idle';
                next[a.id] = {
                  ...next[a.id],
                  status,
                  taskCount: a.active_tasks || 0,
                  totalCompleted: a.total_completed || 0,
                  lastSeen: new Date().toISOString()
                };
              }
            });
            return next;
          });
        }

        // 活跃 DAG
        if (data.activeDag) setActiveDag(data.activeDag);
        if (data.spear !== undefined) setSpear(data.spear);

        // 审批计数
        if (data.approvals_pending !== undefined) setApprovalsPending(data.approvals_pending);

        // 系统统计
        if (data.stats) setSystemStats(data.stats);

      } catch { /* 静默 */ }
    };

    es.onerror = () => {
      setConnected(false);
      // SSE 会自动重连
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, []);

  const updateAgent = useCallback((id, status) => {
    setAgents(prev => ({
      ...prev,
      [id]: { ...prev[id], status, lastSeen: new Date().toISOString() }
    }));
  }, []);

  return { agents, connected, updateAgent, activeDag, approvalsPending, systemStats, spear };
}

// ─── 审计日志 ───
let _logIdCounter = 0;
export function useLogs() {
  const [logs, setLogs] = useState([]);

  // 拉取真实审计日志
  useEffect(() => {
    fetch('/api/logs')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          const mapped = data.map(log => ({
            id: ++_logIdCounter,
            time: log.created_at ? new Date(log.created_at * 1000).toLocaleTimeString('en-US', { hour12: false }) : '--:--:--',
            source: log.agent_id || 'SYSTEM',
            event: log.action || 'unknown',
            message: log.detail ? (typeof log.detail === 'string' ? log.detail.slice(0, 120) : JSON.stringify(log.detail).slice(0, 120)) : '',
            duration_ms: log.duration_ms
          }));
          setLogs(mapped);
        }
      })
      .catch(() => {});
  }, []);

  const addLog = useCallback((source, event, message) => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    setLogs(prev => [{ time, source, event, message, id: ++_logIdCounter }, ...prev].slice(0, 200));
  }, []);

  return { logs, addLog };
}

// ─── 审批队列 ───
export function useApprovals() {
  const [approvals, setApprovals] = useState([]);

  useEffect(() => {
    const fetchApprovals = () => {
      fetch('/api/approvals')
        .then(r => r.json())
        .then(data => { if (Array.isArray(data)) setApprovals(data); })
        .catch(() => {});
    };
    fetchApprovals();
    const interval = setInterval(fetchApprovals, 10000); // 10s 刷新
    return () => clearInterval(interval);
  }, []);

  return { approvals };
}

// ─── Harness 统计 ───
export function useHarnessStats() {
  const [stats, setStats] = useState({ summary: {}, recent: [] });

  useEffect(() => {
    fetch('/api/harness-stats')
      .then(r => r.json())
      .then(data => setStats(data))
      .catch(() => {});
  }, []);

  return stats;
}

// ─── Skill 兵工厂 ───
export function useSkills() {
  const [skills, setSkills] = useState([]);

  useEffect(() => {
    fetch('/api/skills')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setSkills(data); })
      .catch(() => {});
  }, []);

  return { skills };
}

// ─── 死海文书 ───
export function useScrolls() {
  const [scrolls, setScrolls] = useState({ completed_tasks: [], total: 0 });

  useEffect(() => {
    fetch('/api/scrolls')
      .then(r => r.json())
      .then(data => setScrolls(data))
      .catch(() => {});
  }, []);

  return scrolls;
}

// ─── 时钟 ───
export function useClock() {
  const [time, setTime] = useState('');
  const [date, setDate] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-US', { hour12: false }));
      setDate(now.toISOString().split('T')[0]);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return { time, date };
}

// ─── Heartbeat 倒计时 ───
export function useHeartbeat(spear) {
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const status = spear?.status || 'idle';
  const nextRunAtMs = spear?.next_run_at_ms || null;
  const countdown = nextRunAtMs
    ? Math.max(0, Math.floor((nextRunAtMs - nowMs) / 1000))
    : null;
  const min = Math.floor(countdown / 60);
  const sec = countdown % 60;
  const display = status === 'running'
    ? 'RUN'
    : countdown === null
      ? '--:--'
      : `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;

  return {
    countdown,
    display,
    isTriggering: countdown === 0,
    status,
    nextRunAtMs,
    summary: spear?.summary || null,
    lastStatus: spear?.last_status || null
  };
}
