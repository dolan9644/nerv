export default function ApprovalQueue({ approvals = [] }) {
  const pending = approvals.filter(a => a.status === 'PENDING');
  const resolved = approvals.filter(a => a.status !== 'PENDING');

  return (
    <section className="panel approval-panel">
      <div className="panel-header">
        <span className="panel-icon">⚠</span>
        <span className="panel-title">審批佇列 APPROVAL QUEUE</span>
        {pending.length > 0 && (
          <span className="approval-count-badge pulse">{pending.length}</span>
        )}
      </div>

      {pending.length === 0 && resolved.length === 0 ? (
        <div className="approval-empty">
          <span className="approval-lock">🔓</span>
          <span>無待批項目</span>
        </div>
      ) : (
        <div className="approval-list">
          {pending.map(a => (
            <div key={a.id} className="approval-item pending pulse-border">
              <div className="approval-item-header">
                <span className="approval-type">{a.approval_type}</span>
                <span className="approval-id">#{a.id}</span>
              </div>
              <div className="approval-payload">
                {typeof a.payload === 'object'
                  ? (a.payload.name || a.payload.skill_name || JSON.stringify(a.payload).slice(0, 80))
                  : String(a.payload).slice(0, 80)}
              </div>
              <div className="approval-meta">
                <span>by {a.requested_by || '—'}</span>
                <span>{a.created_at ? new Date(a.created_at * 1000).toLocaleString() : ''}</span>
              </div>
            </div>
          ))}
          {resolved.slice(0, 5).map(a => (
            <div key={a.id} className={`approval-item ${a.status.toLowerCase()}`}>
              <div className="approval-item-header">
                <span className="approval-type">{a.approval_type}</span>
                <span className={`approval-verdict ${a.status.toLowerCase()}`}>{a.status}</span>
              </div>
              <div className="approval-payload dim">
                {typeof a.payload === 'object'
                  ? (a.payload.name || a.payload.skill_name || '—')
                  : String(a.payload).slice(0, 60)}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
