import './StrategySidebar.css';

export default function StrategySidebar({
  strategies,
  activeStrategyId,
  selectedId,
  onSelect,
  onNew,
  busy,
}) {
  return (
    <aside className="strategy-sidebar">
      <div className="strategy-sidebar-head">
        <h2>Strategies</h2>
        <button type="button" className="btn-new-strategy" disabled={busy} onClick={onNew}>
          + New
        </button>
      </div>
      <ul className="strategy-list">
        {strategies.map((s) => {
          const active = s.id === activeStrategyId;
          const selected = s.id === selectedId;
          return (
            <li key={s.id}>
              <button
                type="button"
                className={[
                  'strategy-card',
                  selected ? 'selected' : '',
                  active ? 'active' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => onSelect(s.id)}
              >
                <span className="strategy-card-name">{s.name}</span>
                <span className="strategy-card-badges">
                  {active && <span className="strategy-badge">Active</span>}
                  {s.schedule?.enabled ? (
                    <span className="strategy-badge schedule-on">
                      ⏱ {s.schedule.entryTime} IST
                    </span>
                  ) : (
                    <span className="strategy-badge schedule-off">No schedule</span>
                  )}
                </span>
                {s.description ? (
                  <span className="strategy-card-desc">{s.description}</span>
                ) : (
                  <span className="strategy-card-meta">
                    {s.trading?.symbol} · {s.trading?.side} · {s.trading?.lots} lot
                    {s.trading?.lots > 1 ? 's' : ''}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
