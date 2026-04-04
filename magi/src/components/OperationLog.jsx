export default function OperationLog({ logs }) {
  return (
    <section className="panel log-panel">
      <div className="panel-header">
        <span className="panel-icon">▤</span>
        <span className="panel-title">審計日誌 AUDIT LOG</span>
        <span className="panel-badge">{logs.length} 條</span>
      </div>
      <div className="log-entries">
        {logs.length === 0 ? (
          <div className="dag-empty" style={{ height: 60 }}>等待數據…</div>
        ) : (
          logs.map(log => (
            <div key={log.id} className="log-entry">
              <span className="log-time">{log.time}</span>
              <span className="log-source">{log.source}</span>
              <span className="log-event">{log.event}</span>
              <span className="log-message">{log.message}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
