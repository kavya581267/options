import { SYMBOLS } from '../../trading/constants';

export default function TradingConfigFields({
  broker,
  trading,
  onChange,
}) {
  const isFyers = broker === 'fyers';
  const set = (key, value) =>
    onChange((t) => ({ ...t, [key]: value }));

  return (
    <div className="config-form">
      <label>
        Symbol
        <select
          value={trading.symbol}
          onChange={(e) => set('symbol', e.target.value)}
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
        <select value={trading.side} onChange={(e) => set('side', e.target.value)}>
          <option value="SELL">SELL (short straddle)</option>
          <option value="BUY">BUY (long straddle)</option>
        </select>
      </label>
      <label>
        Lots
        <input
          type="number"
          min={1}
          value={trading.lots}
          onChange={(e) => set('lots', parseInt(e.target.value, 10) || 1)}
        />
      </label>
      <label>
        Product
        <select
          value={trading.product}
          onChange={(e) => set('product', e.target.value)}
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
            checked={trading.useBracketOrder}
            onChange={(e) => set('useBracketOrder', e.target.checked)}
          />
          Bracket order on exchange
        </label>
      )}
      <label>
        SL type
        <select
          value={trading.slType}
          onChange={(e) => set('slType', e.target.value)}
        >
          <option value="percent">Percent of entry premium</option>
          <option value="fixed">Fixed rupees</option>
        </select>
      </label>
      <label>
        SL value
        <input
          type="number"
          min={0}
          step={trading.slType === 'percent' ? 1 : 0.5}
          value={trading.slValue}
          onChange={(e) => set('slValue', parseFloat(e.target.value) || 0)}
        />
      </label>
      <label>
        Target type
        <select
          value={trading.targetType}
          onChange={(e) => set('targetType', e.target.value)}
        >
          <option value="percent">Percent of entry premium</option>
          <option value="fixed">Fixed rupees</option>
        </select>
      </label>
      <label>
        Target value
        <input
          type="number"
          min={0}
          step={trading.targetType === 'percent' ? 1 : 0.5}
          value={trading.targetValue}
          onChange={(e) =>
            set('targetValue', parseFloat(e.target.value) || 0)
          }
        />
      </label>
    </div>
  );
}
