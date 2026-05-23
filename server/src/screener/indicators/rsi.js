import { computeRsi, compareValues } from '../technical.js';

export const rsiIndicator = {
  id: 'rsi',
  label: 'RSI',
  description: 'Relative Strength Index vs a threshold.',
  params: [
    {
      key: 'period',
      label: 'RSI period',
      type: 'number',
      default: 14,
      min: 2,
      max: 50,
      step: 1,
    },
    {
      key: 'operator',
      label: 'Condition',
      type: 'select',
      default: '<=',
      options: [
        { value: '<=', label: 'RSI ≤ threshold (oversold)' },
        { value: '<', label: 'RSI < threshold' },
        { value: '>=', label: 'RSI ≥ threshold (overbought)' },
        { value: '>', label: 'RSI > threshold' },
      ],
    },
    {
      key: 'threshold',
      label: 'Threshold',
      type: 'number',
      default: 30,
      min: 1,
      max: 99,
      step: 1,
    },
  ],
  minHistoryDays(params) {
    return (params.period || 14) + 10;
  },
  evaluate(ctx, params) {
    const period = Number(params.period) || 14;
    const threshold = Number(params.threshold) ?? 30;
    const operator = params.operator || '<=';
    const closes = ctx.closes || [];

    if (closes.length < period + 1) {
      return { matched: false, reason: `Need ${period + 1} days of history` };
    }

    const rsi = computeRsi(closes, period);
    if (rsi == null) {
      return { matched: false, reason: 'Could not compute RSI' };
    }

    const matched = compareValues(rsi, operator, threshold);

    return {
      matched,
      rsi: Number(rsi.toFixed(2)),
      period,
      threshold,
    };
  },
  columns(params) {
    const p = params?.period || 14;
    return [{ key: `rsi.rsi`, label: `RSI ${p}`, metric: 'rsi', numeric: true }];
  },
};
