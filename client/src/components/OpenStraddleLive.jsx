import './OpenStraddleLive.css';

const fmt = (n) => (n != null && !Number.isNaN(n) ? `₹${Number(n).toFixed(2)}` : '—');

export default function OpenStraddleLive({ live, loading, error }) {
  if (!live?.open) return null;

  const { trade, quote, metrics, updatedAt } = live;
  const pnlClass =
    metrics.pnl > 0 ? 'pnl-profit' : metrics.pnl < 0 ? 'pnl-loss' : '';

  return (
    <section className="kotak-section open-straddle-live">
      <div className="live-header">
        <h2 className="section-title">Open straddle — live</h2>
        <span className="live-badge">RUNNING</span>
      </div>
      {loading && <p className="live-updating">Updating…</p>}
      {error && <p className="live-error">{error}</p>}
      <p className="live-meta">
        {trade.symbol} {trade.side} @ strike {trade.strike} · entered{' '}
        {trade.enteredAt
          ? new Date(trade.enteredAt).toLocaleTimeString('en-IN', {
              timeZone: 'Asia/Kolkata',
            })
          : '—'}{' '}
        IST
        {updatedAt && (
          <>
            {' '}
            · quote{' '}
            {new Date(updatedAt).toLocaleTimeString('en-IN', {
              timeZone: 'Asia/Kolkata',
            })}
          </>
        )}
      </p>

      <div className="kotak-grid">
        <div className="kotak-card">
          <span className="label">Entry premium</span>
          <span>{fmt(metrics.entryPremium)}</span>
        </div>
        <div className="kotak-card highlight">
          <span className="label">Current premium</span>
          <span>{fmt(metrics.currentPremium)}</span>
        </div>
        <div className={`kotak-card ${pnlClass}`}>
          <span className="label">P&amp;L (premium)</span>
          <span>
            {fmt(metrics.pnl)}{' '}
            <small>({metrics.pnlPct >= 0 ? '+' : ''}
            {metrics.pnlPct.toFixed(1)}%)</small>
          </span>
        </div>
        <div className="kotak-card">
          <span className="label">Spot</span>
          <span>{fmt(quote?.spot)}</span>
        </div>
        <div className="kotak-card">
          <span className="label">CE</span>
          <span>{fmt(quote?.cePremium)}</span>
        </div>
        <div className="kotak-card">
          <span className="label">PE</span>
          <span>{fmt(quote?.pePremium)}</span>
        </div>
        <div className="kotak-card sl-card">
          <span className="label">Stop loss</span>
          <span>{fmt(metrics.stopLoss)}</span>
          <small>
            {metrics.awayFromSl != null
              ? `${fmt(metrics.awayFromSl)} away`
              : ''}
          </small>
        </div>
        <div className="kotak-card target-card">
          <span className="label">Target</span>
          <span>{fmt(metrics.target)}</span>
          <small>
            {metrics.awayFromTarget != null
              ? `${fmt(metrics.awayFromTarget)} away`
              : ''}
          </small>
        </div>
      </div>

      <p className="mono order-ids">
        CE {quote?.ceSymbol} · PE {quote?.peSymbol}
        <br />
        Orders CE={trade.orders?.ce} · PE={trade.orders?.pe}
      </p>
    </section>
  );
}
