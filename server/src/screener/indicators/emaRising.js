import { computeEma, compareValues } from '../technical.js';

export const emaRising = {
  id: 'ema_rising',
  label: 'EMA rising',
  description:
    'EMA is sloping upward — current EMA is above the EMA from N days ago.',
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
      key: 'lookback',
      label: 'Trend lookback (days)',
      type: 'number',
      default: 5,
      min: 1,
      max: 30,
      step: 1,
    },
    {
      key: 'operator',
      label: 'Condition',
      type: 'select',
      default: '>',
      options: [
        { value: '>', label: 'EMA rising (current > past)' },
        { value: '>=', label: 'EMA flat or rising' },
        { value: '<', label: 'EMA falling' },
        { value: '<=', label: 'EMA flat or falling' },
      ],
    },
  ],
  minHistoryDays(params) {
    return (params.period || 50) + (params.lookback || 5) + 5;
  },
  evaluate(ctx, params) {
    const period = Number(params.period) || 50;
    const lookback = Number(params.lookback) || 5;
    const operator = params.operator || '>';
    const closes = ctx.closes || [];

    if (closes.length < period + lookback) {
      return {
        matched: false,
        reason: `Need ${period + lookback} days of history`,
      };
    }

    const emaNow = computeEma(closes, period);
    const closesPast = closes.slice(0, -lookback);
    const emaPast = computeEma(closesPast, period);

    if (emaNow == null || emaPast == null) {
      return { matched: false, reason: 'Could not compute EMA trend' };
    }

    const emaChangePct = emaPast > 0 ? ((emaNow - emaPast) / emaPast) * 100 : 0;
    const matched = compareValues(emaNow, operator, emaPast);

    return {
      matched,
      emaNow: Number(emaNow.toFixed(2)),
      emaPast: Number(emaPast.toFixed(2)),
      period,
      lookback,
      emaChangePct: Number(emaChangePct.toFixed(2)),
    };
  },
  columns(params) {
    const p = params?.period || 50;
    return [
      { key: `ema_rising.emaNow`, label: `EMA ${p}`, metric: 'emaNow', numeric: true },
      {
        key: `ema_rising.emaChangePct`,
        label: `EMA ${p} chg %`,
        metric: 'emaChangePct',
        numeric: true,
      },
    ];
  },
};
