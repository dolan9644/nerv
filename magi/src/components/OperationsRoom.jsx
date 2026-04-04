import { AGENTS, AVATARS, LAYER_LABELS, LAYER_COLORS } from '../data';

const STATUS_DISPLAY = {
  running: { text: '▶ 作戰中', cls: 'running' },
  error:   { text: '✖ 熔斷', cls: 'error' },
  idle:    { text: '● 待命', cls: 'idle' },
};

function AgentCard({ agent, status, selected, onSelect }) {
  const avatar = AVATARS[agent.id];
  const display = STATUS_DISPLAY[status] || STATUS_DISPLAY.idle;

  return (
    <div
      className={`agent-card status-${status} ${selected ? 'selected' : ''}`}
      onClick={() => onSelect(agent.id)}
    >
      {avatar ? (
        <img className="agent-avatar" src={avatar} alt={agent.name} />
      ) : (
        <div className="agent-avatar-placeholder">{agent.emoji}</div>
      )}
      <div className="agent-info">
        <div className="agent-name">{agent.name}</div>
        <div className="agent-role">{agent.role}</div>
      </div>
      <span className={`agent-status-badge ${display.cls}`}>
        {display.text}
      </span>
    </div>
  );
}

export default function OperationsRoom({ agents, selectedAgent, onSelectAgent }) {
  const layers = { command: [], orchestration: [], frontline: [] };
  AGENTS.forEach(a => layers[a.layer].push(a));

  const activeCount = Object.values(agents).filter(a => a.status === 'running').length;
  const errorCount = Object.values(agents).filter(a => a.status === 'error').length;
  const totalCount = AGENTS.length;

  return (
    <section className="panel">
      <div className="panel-header">
        <span className="panel-icon">◆</span>
        <span className="panel-title">作戰室 OPS ROOM</span>
        <span className="panel-badge" style={{
          color: errorCount > 0 ? 'var(--nerv-red)' : activeCount > 0 ? 'var(--nerv-green)' : 'var(--nerv-text-dim)',
          background: errorCount > 0 ? 'var(--nerv-red-dim)' : activeCount > 0 ? 'var(--nerv-green-dim)' : 'transparent'
        }}>
          {activeCount}/{totalCount} ACTIVE{errorCount > 0 ? ` · ${errorCount} ERR` : ''}
        </span>
      </div>

      <div className="ops-room">
        {Object.entries(layers).map(([layer, layerAgents]) => (
          <div key={layer} className="layer-section">
            <div className="layer-label" style={{ color: LAYER_COLORS[layer] }}>
              <span className="layer-dot" style={{ background: LAYER_COLORS[layer] }} />
              {LAYER_LABELS[layer]}
            </div>
            <div className="layer-agents">
              {layerAgents.map(agent => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  status={agents[agent.id]?.status || 'idle'}
                  selected={selectedAgent === agent.id}
                  onSelect={onSelectAgent}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
