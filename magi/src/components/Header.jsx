export default function Header({ clock, heartbeat, connected, approvalsPending = 0, systemStats = {} }) {
  const nodeRunning = systemStats.nodes?.RUNNING || 0;
  const nodeDone = systemStats.nodes?.DONE || 0;
  const nodeFailed = (systemStats.nodes?.FAILED || 0) + (systemStats.nodes?.CIRCUIT_BROKEN || 0);

  return (
    <header className="header">
      <div className="header-left">
        <div className="nerv-logo">
          <span className="logo-text">NERV</span>
          <span className="logo-sub">MAGI SYSTEM</span>
        </div>
        <span className="system-label">戰術作戰系統</span>
      </div>

      <div className="header-center">
        <div className="header-stats">
          <span className="stat-pill running">▶ {nodeRunning}</span>
          <span className="stat-pill done">✓ {nodeDone}</span>
          {nodeFailed > 0 && <span className="stat-pill failed">✗ {nodeFailed}</span>}
          {approvalsPending > 0 && <span className="stat-pill approval pulse">⚠ {approvalsPending}</span>}
        </div>
      </div>

      <div className="header-right">
        <div className="heartbeat-display">
          <span className="heartbeat-label">SPEAR</span>
          <span className={`heartbeat-time ${heartbeat.countdown < 30 ? 'warning' : ''}`}>
            {heartbeat.display}
          </span>
        </div>
        <div className="clock-display">
          <div className="clock">{clock.time}</div>
          <div className="date">{clock.date}</div>
        </div>
        <div className="sync-indicator">
          <span className={`sync-dot ${connected ? 'online' : 'offline'}`} />
          <span className={`sync-text ${connected ? 'online' : 'offline'}`}>
            {connected ? 'DB LINK' : 'OFFLINE'}
          </span>
        </div>
      </div>
    </header>
  );
}
