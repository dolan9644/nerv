import { useState, useEffect } from 'react';

export default function SeeleStone({ onClose }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/breaker-logs')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setLogs(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const failCount = logs.filter(l => l.result !== 'PASS').length;
  const passCount = logs.filter(l => l.result === 'PASS').length;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="seele-modal" onClick={e => e.stopPropagation()}>
        <div className="seele-modal-header">
          <div className="seele-monolith">▮</div>
          <div className="seele-modal-title">
            <span className="seele-title-main">SEELE 石碑</span>
            <span className="seele-title-sub">BREAKER REJECTION LOG</span>
          </div>
          <button className="seele-close" onClick={onClose}>✕</button>
        </div>

        <div className="seele-stats-bar">
          <span className="seele-stat pass">✓ PASS {passCount}</span>
          <span className="seele-stat fail">✗ REJECT {failCount}</span>
          <span className="seele-stat total">Σ {logs.length}</span>
        </div>

        <div className="seele-log-list">
          {loading ? (
            <div className="seele-loading">掃描中…</div>
          ) : logs.length === 0 ? (
            <div className="seele-empty">
              <div className="seele-empty-icon">🛡️</div>
              <div>尚無熔斷記錄</div>
              <div className="seele-empty-sub">SEELE BREAKER 未觸發過攔截</div>
            </div>
          ) : (
            logs.map(log => (
              <div key={log.id} className={`seele-log-entry ${log.result === 'PASS' ? 'pass' : 'fail'}`}>
                <div className="seele-log-header">
                  <span className={`seele-verdict ${log.result.toLowerCase()}`}>{log.result}</span>
                  <span className="seele-task-id">{log.task_id ? log.task_id.slice(0, 12) : '—'}</span>
                  <span className="seele-timestamp">
                    {log.created_at ? new Date(log.created_at * 1000).toLocaleString() : '—'}
                  </span>
                </div>
                {log.detail && (
                  <div className="seele-detail">
                    {typeof log.detail === 'object' ? (
                      <>
                        {log.detail.violations && (
                          <div className="seele-violations">
                            {(Array.isArray(log.detail.violations) ? log.detail.violations : []).map((v, i) => (
                              <div key={i} className="seele-violation">
                                <span className="violation-pattern">{v.pattern || v.rule || '—'}</span>
                                <span className="violation-file">{v.file || v.path || ''}</span>
                                {v.line && <span className="violation-line">L{v.line}</span>}
                              </div>
                            ))}
                          </div>
                        )}
                        {log.detail.scanned_files !== undefined && (
                          <div className="seele-scan-meta">
                            掃描 {log.detail.scanned_files} 檔案 · 
                            {log.detail.violations_count || 0} 違規
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="seele-detail-text">{String(log.detail).slice(0, 200)}</div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
