import { useState, useEffect } from 'react';
import './index.css';
import './App.css';
import { AGENTS } from './data';
import { useAgentStatus, useLogs, useClock, useHeartbeat, useApprovals, useHarnessStats, useSkills, useScrolls } from './hooks';
import Header from './components/Header';
import OperationsRoom from './components/OperationsRoom';
import DagPipeline from './components/DagPipeline';
import ApprovalQueue from './components/ApprovalQueue';
import OperationLog from './components/OperationLog';
import MagiTriad from './components/MagiTriad';
import SeeleStone from './components/SeeleStone';

export default function App() {
  const { agents, connected, activeDag, approvalsPending, systemStats, spear } = useAgentStatus();
  const { logs, addLog } = useLogs();
  const clock = useClock();
  const heartbeat = useHeartbeat(spear);
  const { approvals } = useApprovals();
  const harnessStats = useHarnessStats();
  const { skills } = useSkills();
  const scrolls = useScrolls();
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [activeTab, setActiveTab] = useState('ops');
  const [showSeeleStone, setShowSeeleStone] = useState(false);

  // MAGI 三机体状态：基于系统实时数据
  const magiState = (() => {
    const running = systemStats.nodes?.RUNNING || 0;
    const failed = systemStats.nodes?.FAILED || 0;
    if (failed > 0) return ['approve', 'deny', 'approve'];    // 有失败
    if (running > 0) return ['approve', 'approve', 'approve']; // 全运行
    return ['standby', 'standby', 'standby'];                  // 空闲
  })();

  return (
    <div className="app-container">
      <Header
        clock={clock}
        heartbeat={heartbeat}
        connected={connected}
        approvalsPending={approvalsPending}
        systemStats={systemStats}
      />

      {/* 标签页导航 */}
      <nav className="tab-nav">
        <button className={`tab-btn ${activeTab === 'ops' ? 'active' : ''}`} onClick={() => setActiveTab('ops')}>
          ◆ 作戰室
        </button>
        <button className={`tab-btn ${activeTab === 'harness' ? 'active' : ''}`} onClick={() => setActiveTab('harness')}>
          ⛨ 三道防線
        </button>
        <button className={`tab-btn ${activeTab === 'scrolls' ? 'active' : ''}`} onClick={() => setActiveTab('scrolls')}>
          ✦ 死海文書
        </button>
        <button className={`tab-btn ${activeTab === 'arsenal' ? 'active' : ''}`} onClick={() => setActiveTab('arsenal')}>
          ⚔ 兵工廠
        </button>
      </nav>

      <main className="main-grid">
        {activeTab === 'ops' && (
          <>
            <OperationsRoom
              agents={agents}
              selectedAgent={selectedAgent}
              onSelectAgent={(id) => {
                setSelectedAgent(id);
                addLog('SYSTEM', 'select', `Agent focused: ${id}`);
              }}
            />
            <div className="center-stack">
              <DagPipeline dag={activeDag} />
              <ApprovalQueue approvals={approvals} />
              <OperationLog logs={logs} />
            </div>
          </>
        )}

        {activeTab === 'harness' && (
          <div className="full-panel">
            <HarnessPanel stats={harnessStats} onOpenSeele={() => setShowSeeleStone(true)} />
          </div>
        )}

        {activeTab === 'scrolls' && (
          <div className="full-panel">
            <ScrollsPanel scrolls={scrolls} />
          </div>
        )}

        {activeTab === 'arsenal' && (
          <div className="full-panel">
            <ArsenalPanel skills={skills} />
          </div>
        )}
      </main>

      <MagiTriad states={magiState} />

      {showSeeleStone && <SeeleStone onClose={() => setShowSeeleStone(false)} />}
    </div>
  );
}

// ═══ Harness 三道防线面板 ═══
function HarnessPanel({ stats, onOpenSeele }) {
  const types = [
    { key: 'seele_breaker', label: '熔斷器 SEELE BREAKER', icon: '🛡️', desc: '正则物理扫描 · 极高危特征拦截' },
    { key: 'adapter_lint', label: '質檢器 ADAPTER LINT', icon: '🔬', desc: 'I/O 契约校验 · 适配器规范检查' },
    { key: 'schema_validator', label: '校驗器 SCHEMA VALIDATOR', icon: '⚗️', desc: '字段白名单 · 数据完整性评分' },
  ];

  return (
    <section className="panel harness-panel">
      <div className="panel-header">
        <span className="panel-icon">⛨</span>
        <span className="panel-title">物理防線統計 HARNESS STATS</span>
        <button className="seele-stone-trigger" onClick={onOpenSeele}>
          ▮ SEELE 石碑
        </button>
      </div>
      <div className="harness-grid">
        {types.map(t => {
          const s = stats.summary?.[t.key] || { total: 0, pass_count: 0, fail_count: 0 };
          const passRate = s.total > 0 ? Math.round(s.pass_count / s.total * 100) : 0;
          const failRate = s.total > 0 ? Math.round(s.fail_count / s.total * 100) : 0;
          return (
            <div key={t.key} className="harness-card">
              <div className="harness-card-header">
                <span className="harness-icon">{t.icon}</span>
                <span className="harness-label">{t.label}</span>
              </div>
              <p className="harness-desc">{t.desc}</p>
              {s.total > 0 ? (
                <>
                  <div className="harness-bar-container">
                    <div className="harness-bar pass" style={{ width: `${passRate}%` }} />
                    <div className="harness-bar fail" style={{ width: `${failRate}%` }} />
                  </div>
                  <div className="harness-numbers">
                    <span className="pass-count">✓ PASS {s.pass_count}</span>
                    <span className="fail-count">✗ REJECT {s.fail_count}</span>
                    <span className="total-count">Σ {s.total}</span>
                    <span className="pass-rate">{passRate}%</span>
                  </div>
                </>
              ) : (
                <div className="harness-no-data">尚無檢測記錄 · 等待物理腳本執行</div>
              )}
            </div>
          );
        })}
      </div>
      {stats.recent?.length > 0 && (
        <div className="harness-recent">
          <div className="harness-recent-title">近期記錄</div>
          {stats.recent.slice(0, 10).map(r => (
            <div key={r.id} className={`harness-log-entry ${r.result === 'PASS' ? 'pass' : 'fail'}`}>
              <span className="harness-log-type">{r.harness_type}</span>
              <span className={`harness-log-result ${r.result.toLowerCase()}`}>{r.result}</span>
              <span className="harness-log-detail">{r.task_id ? r.task_id.slice(0, 8) : '—'}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ═══ 死海文书面板 ═══
function ScrollsPanel({ scrolls }) {
  return (
    <section className="panel scrolls-panel">
      <div className="panel-header">
        <span className="panel-icon">✦</span>
        <span className="panel-title">死海文書 DEAD SEA SCROLLS</span>
        <span className="panel-badge">{scrolls.total} 卷</span>
      </div>

      {scrolls.completed_tasks.length === 0 ? (
        <div className="scrolls-empty">
          <div className="scrolls-empty-icon">📜</div>
          <div className="scrolls-empty-text">記憶正在生成中…</div>
          <div className="scrolls-empty-sub">任務完成後將自動歸檔至此</div>
          <SystemLogTicker lines={[
            '[LOG] Rei is scanning memory_queue/ for new fragments...',
            '[LOG] Vector index: 0 embeddings · awaiting first task completion',
            '[LOG] MEMORY.md distillation scheduled at 02:00 CST',
            '[LOG] GraphRAG entity extraction: standby',
          ]} />
        </div>
      ) : (
        <div className="scrolls-list">
          {scrolls.completed_tasks.map(t => (
            <div key={t.task_id} className={`scroll-entry ${t.status.toLowerCase()}`}>
              <span className="scroll-status">{t.status === 'DONE' ? '✓' : '✗'}</span>
              <span className="scroll-intent">{t.intent || t.task_id}</span>
              <span className="scroll-date">
                {t.completed_at ? new Date(t.completed_at * 1000).toLocaleDateString() : '—'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* GraphRAG 预留插槽 */}
      <div className="graphrag-slot">
        <div className="graphrag-placeholder">
          <span>⬡</span> GraphRAG 實體圖譜
          <div className="graphrag-sub">等待 Rei 向量庫積累數據後啟用</div>
        </div>
      </div>
    </section>
  );
}

// ═══ Skill 兵工厂面板 ═══
function ArsenalPanel({ skills }) {
  return (
    <section className="panel arsenal-panel">
      <div className="panel-header">
        <span className="panel-icon">⚔</span>
        <span className="panel-title">兵工廠 SKILL ARSENAL</span>
        <span className="panel-badge">{skills.length} 項</span>
      </div>

      {skills.length === 0 ? (
        <div className="scrolls-empty">
          <div className="scrolls-empty-icon">⚙️</div>
          <div className="scrolls-empty-text">尚無已註冊 Skill</div>
          <div className="scrolls-empty-sub">通過 Gendo 工具發現流程新增</div>
          <SystemLogTicker lines={[
            '[LOG] skill_registry: 0 entries · MARDUK system on standby',
            '[LOG] EVA-03 search module ready · awaiting TOOL_GAP event',
            '[LOG] Kaworu security review pipeline: idle',
            '[LOG] Gendo discovery loop: waiting for unmatched intent',
          ]} />
        </div>
      ) : (
        <div className="arsenal-grid">
          {skills.map((s, i) => (
            <div key={i} className={`arsenal-card ${s.source_type}`}>
              <div className="arsenal-card-header">
                <span className="arsenal-type-badge">{s.source_type === 'built_in' ? '內建' : '發現'}</span>
                <span className="arsenal-name">{s.skill_name}</span>
              </div>
              <div className="arsenal-meta">
                {s.pattern && <div className="arsenal-pattern">Pattern: {s.pattern}</div>}
                {s.compatible_agents && (
                  <div className="arsenal-agents">
                    {(Array.isArray(s.compatible_agents) ? s.compatible_agents : [s.compatible_agents]).map(a => (
                      <span key={a} className="arsenal-agent-tag">{a}</span>
                    ))}
                  </div>
                )}
                {s.adapter_path && <div className="arsenal-path">Adapter: {s.adapter_path}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ═══ 系统底层日志滚动器 ═══
function SystemLogTicker({ lines = [] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (lines.length === 0) return;
    const interval = setInterval(() => {
      setIndex(prev => (prev + 1) % lines.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [lines.length]);

  if (lines.length === 0) return null;

  return (
    <div className="system-log-ticker">
      <span className="ticker-line">{lines[index]}</span>
    </div>
  );
}
