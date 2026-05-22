import './KotakConfigForm.css';

const SYMBOLS = ['NIFTY', 'SENSEX'];

export default function KotakConfigForm({
  broker = 'kotak',
  tradingForm,
  setTradingForm,
  busy,
  configSaved,
  onSave,
}) {
  const isFyers = broker === 'fyers';
  const configFile = isFyers
    ? 'fyers-trading-config.json'
    : 'kotak-trading-config.json';

  return (
    <section className="kotak-section">
      <h2 className="section-title">Trading config</h2>
      <p className="kotak-hint config-hint">
        Saved to <code>server/data/{configFile}</code> (overrides .env). .env
        applies only before first save.
      </p>
      <div className="config-form">
        <label>
          Default symbol
          <select
            value={tradingForm.symbol}
            onChange={(e) =>
              setTradingForm((f) => ({ ...f, symbol: e.target.value }))
            }
          >
            {SYMBOLS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label>
          Side
          <select
            value={tradingForm.side}
            onChange={(e) =>
              setTradingForm((f) => ({ ...f, side: e.target.value }))
            }
          >
            <option value="SELL">SELL (short straddle)</option>
            <option value="BUY">BUY (long straddle)</option>
          </select>
        </label>
        <label>
          Lots
          <input
            type="number"
            min={1}
            value={tradingForm.lots}
            onChange={(e) =>
              setTradingForm((f) => ({
                ...f,
                lots: parseInt(e.target.value, 10) || 1,
              }))
            }
          />
        </label>
        <label>
          Product
          <select
            value={tradingForm.product}
            onChange={(e) =>
              setTradingForm((f) => ({ ...f, product: e.target.value }))
            }
          >
            <option value="MIS">MIS</option>
            <option value="NRML">NRML</option>
            {!isFyers && <option value="BO">BO (bracket)</option>}
          </select>
        </label>
        {!isFyers && (
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={tradingForm.useBracketOrder}
              onChange={(e) =>
                setTradingForm((f) => ({
                  ...f,
                  useBracketOrder: e.target.checked,
                }))
              }
            />
            Kotak bracket order (SL/target on exchange)
          </label>
        )}
        <label>
          SL type
          <select
            value={tradingForm.slType}
            onChange={(e) =>
              setTradingForm((f) => ({ ...f, slType: e.target.value }))
            }
          >
            <option value="percent">Percent of entry premium</option>
            <option value="fixed">Fixed rupees on total premium</option>
          </select>
        </label>
        <label>
          SL value
          <input
            type="number"
            min={0}
            step={tradingForm.slType === 'percent' ? 1 : 0.5}
            value={tradingForm.slValue}
            onChange={(e) =>
              setTradingForm((f) => ({
                ...f,
                slValue: parseFloat(e.target.value) || 0,
              }))
            }
          />
        </label>
        <label>
          Target type
          <select
            value={tradingForm.targetType}
            onChange={(e) =>
              setTradingForm((f) => ({ ...f, targetType: e.target.value }))
            }
          >
            <option value="percent">Percent of entry premium</option>
            <option value="fixed">Fixed rupees on total premium</option>
          </select>
        </label>
        <label>
          Target value
          <input
            type="number"
            min={0}
            step={tradingForm.targetType === 'percent' ? 1 : 0.5}
            value={tradingForm.targetValue}
            onChange={(e) =>
              setTradingForm((f) => ({
                ...f,
                targetValue: parseFloat(e.target.value) || 0,
              }))
            }
          />
        </label>
      </div>
      <div className="kotak-row">
        <button type="button" disabled={busy} onClick={onSave}>
          Save config
        </button>
        {configSaved && <span className="ok">Config saved</span>}
      </div>
    </section>
  );
}
