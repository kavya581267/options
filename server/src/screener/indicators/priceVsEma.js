import { computeEma, compareValues } from '../technical.js';

export const priceVsEma = {
  id: 'price_vs_ema',
  label: 'Price vs EMA',
  description: 'Compare latest close against an exponential moving average.',
  params: [
    {
      key: 'period',
      label: 'EMA period',
      type: 'number',
      default: 50,
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
        { value: '>=', label: 'Close ≥ EMA' },
        { value: '>', label: 'Close > EMA' },
        { value: '<=', label: 'Close ≤ EMA' },
        { value: '<', label: 'Close < EMA' },
      ],
    },
  ],
  minHistoryDays(params) {
    return (params.period || 50) + 5;
  },
  evaluate(ctx, params) {
    const period = Number(params.period) || 50;
    const operator = params.operator || '>=';
    const closes = ctx.closes || [];

    if (closes.length < period) {
      return { matched: false, reason: `Need ${period} days of history` };
    }

    const close = closes[closes.length - 1];
    const ema = computeEma(closes, period);
    if (ema == null) {
      return { matched: false, reason: 'Could not compute EMA' };
    }

    const pctFromEma = ema > 0 ? ((close - ema) / ema) * 100 : 0;
    const matched = compareValues(close, operator, ema);

    return {
      matched,
      close,
      ema: Number(ema.toFixed(2)),
      period,
      pctFromEma: Number(pctFromEma.toFixed(2)),
    };
  },
  columns(params) {
    const p = params?.period || 50;
    return [
      { key: `price_vs_ema.ema`, label: `EMA ${p}`, metric: 'ema', numeric: true },
      { key: `price_vs_ema.pctFromEma`, label: `% vs EMA ${p}`, metric: 'pctFromEma', numeric: true },
    ];
  },
};
