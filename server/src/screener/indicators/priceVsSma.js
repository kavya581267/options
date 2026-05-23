import { computeSma, compareValues } from '../technical.js';

export const priceVsSma = {
  id: 'price_vs_sma',
  label: 'Price vs SMA',
  description: 'Compare latest close against a simple moving average.',
  params: [
    {
      key: 'period',
      label: 'SMA period',
      type: 'number',
      default: 20,
      min: 5,
      max: 200,
      step: 1,
    },
    {
      key: 'operator',
      label: 'Condition',
      type: 'select',
      default: '>=',
      options: [
        { value: '>=', label: 'Close ≥ SMA' },
        { value: '>', label: 'Close > SMA' },
        { value: '<=', label: 'Close ≤ SMA' },
        { value: '<', label: 'Close < SMA' },
      ],
    },
  ],
  minHistoryDays(params) {
    return (params.period || 20) + 2;
  },
  evaluate(ctx, params) {
    const period = Number(params.period) || 20;
    const operator = params.operator || '>=';
    const closes = ctx.closes || [];

    if (closes.length < period) {
      return { matched: false, reason: `Need ${period} days of history` };
    }

    const close = closes[closes.length - 1];
    const sma = computeSma(closes, period);
    if (sma == null) {
      return { matched: false, reason: 'Could not compute SMA' };
    }

    const pctFromSma = sma > 0 ? ((close - sma) / sma) * 100 : 0;
    const matched = compareValues(close, operator, sma);

    return {
      matched,
      close,
      sma: Number(sma.toFixed(2)),
      period,
      pctFromSma: Number(pctFromSma.toFixed(2)),
    };
  },
  columns(params) {
    const p = params?.period || 20;
    return [
      { key: `price_vs_sma.sma`, label: `SMA ${p}`, metric: 'sma', numeric: true },
      { key: `price_vs_sma.pctFromSma`, label: `% vs SMA ${p}`, metric: 'pctFromSma', numeric: true },
    ];
  },
};
