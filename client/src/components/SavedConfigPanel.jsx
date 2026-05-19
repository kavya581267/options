import './SavedConfigPanel.css';

function fmtLevel(type, value) {
  return type === 'percent' ? `${value}%` : `₹${value}`;
}

export default function SavedConfigPanel({ trading, configSource }) {
  if (!trading) return null;

  return (
    <section className="kotak-section saved-config-panel">
      <h2 className="section-title">Active saved config</h2>
      <p className="config-source">
        Source:{' '}
        <strong>
          {configSource === 'file'
            ? 'kotak-trading-config.json'
            : 'server/.env defaults'}
        </strong>
      </p>
      <div className="kotak-grid">
        <div className="kotak-card">
          <span className="label">Symbol</span>
          <span>{trading.symbol}</span>
        </div>
        <div className="kotak-card">
          <span className="label">Side</span>
          <span>{trading.side} straddle</span>
        </div>
        <div className="kotak-card">
          <span className="label">Lots</span>
          <span>{trading.lots}</span>
        </div>
        <div className="kotak-card">
          <span className="label">Product</span>
          <span>
            {trading.product}
            {trading.useBracketOrder ? ' + BO' : ''}
          </span>
        </div>
        <div className="kotak-card">
          <span className="label">Stop loss</span>
          <span>{fmtLevel(trading.slType, trading.slValue)}</span>
        </div>
        <div className="kotak-card">
          <span className="label">Target</span>
          <span>{fmtLevel(trading.targetType, trading.targetValue)}</span>
        </div>
      </div>
    </section>
  );
}
