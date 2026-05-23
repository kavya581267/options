import { computeRsi } from '../technical.js';

export const rsiRange = {
  id: 'rsi_range',
  label: 'RSI range',
  description: 'RSI within a min–max band (e.g. 45–65 for healthy momentum).',
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
      key: 'min',
      label: 'Min RSI',
      type: 'number',
      default: 45,
      min: 1,
      max: 98,
      step: 1,
    },
    {
      key: 'max',
      label: 'Max RSI',
      type: 'number',
      default: 65,
      min: 2,
      max: 99,
      step: 1,
    },
  ],
  minHistoryDays(params) {
    return (params.period || 14) + 10;
  },
  evaluate(ctx, params) {
    const period = Number(params.period) || 14;
    const min = Number(params.min) ?? 45;
    const max = Number(params.max) ?? 65;
    const closes = ctx.closes || [];

    if (closes.length < period + 1) {
      return { matched: false, reason: `Need ${period + 1} days of history` };
    }

    const rsi = computeRsi(closes, period);
    if (rsi == null) {
      return { matched: false, reason: 'Could not compute RSI' };
    }

    const matched = rsi >= min && rsi <= max;

    return {
      matched,
      rsi: Number(rsi.toFixed(2)),
      period,
      min,
      max,
    };
  },
  columns(params) {
    const p = params?.period || 14;
    return [{ key: `rsi_range.rsi`, label: `RSI ${p}`, metric: 'rsi', numeric: true }];
  },
};
