import './DayStats.css';

function Stat({ label, value, variant, isCurrency }) {
  const display =
    value == null
      ? '—'
      : typeof value === 'number'
      ? isCurrency
        ? '₹' + value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : value.toFixed(2)
      : value;
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
  const lotSize = stats.lotSize ?? (symbol === 'NIFTY' ? 65 : symbol === 'SENSEX' ? 20 : 1);

  const [yr, mo, dy] = date.split('-').map(Number);
  const d = new Date(yr, mo - 1, dy);
  const dayOfWeek = d.getDay();
  const isExpiryDay = (symbol === 'NIFTY' && dayOfWeek === 2) || (symbol === 'SENSEX' && dayOfWeek === 4);

  return (
    <section className="day-stats" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          {symbol} — {date}
          {isExpiryDay && (
            <span className="badge expiry-badge-small" style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)', color: 'var(--red)', border: '1px solid rgba(239, 68, 68, 0.3)', fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: '600' }}>
              Expiry Day
            </span>
          )}
          <span className="count">{stats.count} readings</span>
        </h2>

        <div className="stats-grid">
          <Stat label="9:15 spot" value={anchorSpot} />
          <Stat label="Fixed strike" value={anchorStrike} />
          <Stat label="Premium high" value={stats.premiumHigh} variant="high" />
          <Stat label="Premium low" value={stats.premiumLow} variant="low" />
          <Stat label="Entry Premium" value={stats.entryPremium} />
          <Stat label="Seller Entry Credit" value={stats.entryAmount} isCurrency={true} variant="entry" />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {/* 9:20 - 3:00 window */}
        <div style={{ background: 'rgba(20, 24, 32, 0.4)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1rem' }}>
          <h3 style={{ fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.75rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            9:20 - 3:00 Window (Lot Size: {lotSize})
          </h3>
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <Stat label="9:20 - 3:00 High" value={stats.high300} variant="high" />
            <Stat label="9:20 - 3:00 Low" value={stats.low300} variant="low" />
            <Stat label="Max Loss (Seller)" value={stats.maxLoss300} isCurrency={true} variant="low" />
            <Stat label="Max Gain (Seller)" value={stats.maxGain300} isCurrency={true} variant="high" />
            <Stat label="3:00 Exit Premium" value={stats.exitPremium300} />
            <Stat
              label="3:00 Exit PnL"
              value={stats.exitPnL300}
              isCurrency={true}
              variant={stats.exitPnL300 != null ? (stats.exitPnL300 >= 0 ? 'high' : 'low') : ''}
            />
          </div>
        </div>

        {/* 9:20 - 3:25 window */}
        <div style={{ background: 'rgba(20, 24, 32, 0.4)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1rem' }}>
          <h3 style={{ fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.75rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            9:20 - 3:25 Window (Lot Size: {lotSize})
          </h3>
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <Stat label="9:20 - 3:25 High" value={stats.high325} variant="high" />
            <Stat label="9:20 - 3:25 Low" value={stats.low325} variant="low" />
            <Stat label="Max Loss (Seller)" value={stats.maxLoss325} isCurrency={true} variant="low" />
            <Stat label="Max Gain (Seller)" value={stats.maxGain325} isCurrency={true} variant="high" />
            <Stat label="3:20 Exit Premium" value={stats.exitPremium320} />
            <Stat
              label="3:20 Exit PnL"
              value={stats.exitPnL320}
              isCurrency={true}
              variant={stats.exitPnL320 != null ? (stats.exitPnL320 >= 0 ? 'high' : 'low') : ''}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
