export default function DagPipeline({ dag }) {
  if (!dag) {
    return (
      <section className="panel dag-panel">
        <div className="panel-header">
          <span className="panel-icon">⬡</span>
          <span className="panel-title">DAG 管線 PIPELINE</span>
        </div>
        <div className="dag-empty">AWAITING DISPATCH…</div>
      </section>
    );
  }

  // 按 depth/level 分组
  const levels = {};
  (dag.nodes || []).forEach(n => {
    const lvl = n.depth ?? n.level ?? 0;
    if (!levels[lvl]) levels[lvl] = [];
    levels[lvl].push(n);
  });

  const statusMap = {
    'DONE': 'completed', 'RUNNING': 'running', 'PENDING': 'pending',
    'FAILED': 'failed', 'CIRCUIT_BROKEN': 'failed',
    'completed': 'completed', 'running': 'running', 'pending': 'pending'
  };

  return (
    <section className="panel dag-panel">
      <div className="panel-header">
        <span className="panel-icon">⬡</span>
        <span className="panel-title">DAG 管線 PIPELINE</span>
        <span className="panel-badge">{dag.id || dag.task_id || '—'}</span>
      </div>
      <div className="dag-canvas">
        <div className="dag-levels">
          {Object.entries(levels)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([lvl, nodes]) => (
              <div key={lvl} className="dag-level">
                {nodes.map(n => (
                  <div
                    key={n.id}
                    className={`dag-node ${statusMap[n.status] || 'pending'}`}
                    title={`${n.id}\n${n.label || n.description}\nAgent: ${n.agent}\nStatus: ${n.status}`}
                  >
                    <div className="dag-node-label">{n.label || n.description || n.id}</div>
                    <div className="dag-node-agent">{n.agent}</div>
                  </div>
                ))}
              </div>
            ))}
        </div>
      </div>
    </section>
  );
}
