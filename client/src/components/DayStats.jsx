import './DayStats.css';

function Stat({ label, value, variant }) {
  const display =
    value == null ? '—' : typeof value === 'number' ? value.toFixed(2) : value;
  return (
    <div className={`stat-card ${variant || ''}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value mono">{display}</span>
    </div>
  );
}

export default function DayStats({ stats, symbol, date, anchor }) {
  if (!stats) return null;

  const anchorStrike = anchor?.strike ?? stats.anchorStrike;
  const anchorSpot = anchor?.spot ?? stats.anchorSpot;

  return (
    <section className="day-stats">
      <h2 className="section-title">
        {symbol} — {date}
        <span className="count">{stats.count} readings</span>
      </h2>
      <div className="stats-grid">
        <Stat label="9:15 spot" value={anchorSpot} />
        <Stat label="Fixed strike" value={anchorStrike} />
        <Stat label="Premium high" value={stats.premiumHigh} variant="high" />
        <Stat label="Premium low" value={stats.premiumLow} variant="low" />
      </div>
    </section>
  );
}
