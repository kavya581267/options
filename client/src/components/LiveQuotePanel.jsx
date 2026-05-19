import './LiveQuotePanel.css';

const fmt = (n) =>
  n != null && !Number.isNaN(Number(n)) ? `₹${Number(n).toFixed(2)}` : '—';

function PlaceholderCard({ label, sub, highlight, sl, target }) {
  return (
    <div
      className={[
        'kotak-card',
        highlight ? 'highlight' : '',
        sl ? 'sl-card' : '',
        target ? 'target-card' : '',
        'placeholder-card',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span className="label">{label}</span>
      <span className="value placeholder">—</span>
      {sub && <small className="hint">{sub}</small>}
    </div>
  );
}

export default function LiveQuotePanel({
  loggedIn,
  strike,
  quote,
  metrics,
  trade,
  levels,
  loading,
  error,
  onRefresh,
  refreshDisabled,
}) {
  const isOpen = trade?.status === 'open';
  const hasQuote = Boolean(quote);
  const showData = hasQuote && !loading;

  let status = 'idle';
  let statusHint = 'Login and enter a strike, then refresh for Kotak LTP.';
  if (!loggedIn) {
    statusHint = 'Login with TOTP + MPIN to fetch Kotak live quotes.';
  } else if (isOpen) {
    status = 'running';
    statusHint = 'Open straddle — quotes refresh automatically.';
  } else if (loading) {
    status = 'loading';
    statusHint = 'Fetching from Kotak…';
  } else if (!strike) {
    statusHint = 'Enter a strike above, then refresh quote.';
  } else if (hasQuote) {
    statusHint = quote?.fetchedAt
      ? `Updated ${new Date(quote.fetchedAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`
      : 'Kotak quote loaded.';
  }

  const pnlClass =
    metrics?.pnl > 0 ? 'pnl-profit' : metrics?.pnl < 0 ? 'pnl-loss' : '';

  return (
    <section className="kotak-section live-quote-panel">
      <div className="live-header">
        <h2 className="section-title">Live straddle quote</h2>
        <span className={`live-status-badge ${status}`}>
          {status === 'running'
            ? 'RUNNING'
            : status === 'loading'
              ? 'LOADING'
              : 'IDLE'}
        </span>
      </div>

      <p className="live-hint">{statusHint}</p>
      {error && <p className="live-error">{error}</p>}

      {isOpen && trade && (
        <p className="live-meta">
          {trade.symbol} {trade.side} @ strike {trade.strike}
          {trade.enteredAt && (
            <>
              {' '}
              · entered{' '}
              {new Date(trade.enteredAt).toLocaleTimeString('en-IN', {
                timeZone: 'Asia/Kolkata',
              })}{' '}
              IST
            </>
          )}
        </p>
      )}

      <div className="live-quote kotak-grid">
        {showData ? (
          <>
            <div className="kotak-card">
              <span className="label">Spot (Kotak)</span>
              <span className="value">{fmt(quote.spot)}</span>
            </div>
            <div className="kotak-card">
              <span className="label">CE {quote.ceSymbol || ''}</span>
              <span className="value">{fmt(quote.cePremium)}</span>
            </div>
            <div className="kotak-card">
              <span className="label">PE {quote.peSymbol || ''}</span>
              <span className="value">{fmt(quote.pePremium)}</span>
            </div>
            <div className="kotak-card highlight">
              <span className="label">Straddle premium</span>
              <span className="value">{fmt(quote.straddlePremium)}</span>
            </div>
          </>
        ) : (
          <>
            <PlaceholderCard label="Spot (Kotak)" />
            <PlaceholderCard label="CE premium" />
            <PlaceholderCard label="PE premium" />
            <PlaceholderCard label="Straddle premium" highlight />
          </>
        )}

        {isOpen && metrics ? (
          <>
            <div className="kotak-card">
              <span className="label">Entry premium</span>
              <span className="value">{fmt(metrics.entryPremium)}</span>
            </div>
            <div className={`kotak-card ${pnlClass}`}>
              <span className="label">P&amp;L (premium)</span>
              <span className="value">
                {fmt(metrics.pnl)}{' '}
                {metrics.pnlPct != null && (
                  <small>
                    ({metrics.pnlPct >= 0 ? '+' : ''}
                    {metrics.pnlPct.toFixed(1)}%)
                  </small>
                )}
              </span>
            </div>
            <div className="kotak-card sl-card">
              <span className="label">Stop loss</span>
              <span className="value">{fmt(metrics.stopLoss)}</span>
              <small>
                {metrics.awayFromSl != null
                  ? `${fmt(metrics.awayFromSl)} away`
                  : '—'}
              </small>
            </div>
            <div className="kotak-card target-card">
              <span className="label">Target</span>
              <span className="value">{fmt(metrics.target)}</span>
              <small>
                {metrics.awayFromTarget != null
                  ? `${fmt(metrics.awayFromTarget)} away`
                  : '—'}
              </small>
            </div>
          </>
        ) : levels ? (
          <>
            <PlaceholderCard
              label="Entry (preview)"
              sub={fmt(levels.entryPremium)}
            />
            <PlaceholderCard label="Stop loss (preview)" sub={fmt(levels.stopLoss)} sl />
            <PlaceholderCard
              label="Target (preview)"
              sub={fmt(levels.target)}
              target
            />
          </>
        ) : (
          <>
            <PlaceholderCard label="Entry premium" sub="No open trade" />
            <PlaceholderCard label="P&amp;L" sub="—" />
            <PlaceholderCard label="Stop loss" sub="Set entry premium" sl />
            <PlaceholderCard label="Target" sub="Set entry premium" target />
          </>
        )}
      </div>

      <div className="kotak-row live-quote-actions">
        <button
          type="button"
          className="btn-quote"
          disabled={refreshDisabled}
          onClick={onRefresh}
        >
          {loading ? 'Fetching…' : 'Refresh Kotak quote'}
        </button>
        {!loggedIn && (
          <span className="muted">Requires Kotak session</span>
        )}
        {loggedIn && !strike && (
          <span className="muted">Strike required</span>
        )}
      </div>
    </section>
  );
}
