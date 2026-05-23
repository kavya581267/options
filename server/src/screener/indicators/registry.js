import { priceVsEma } from './priceVsEma.js';
import { priceVsSma } from './priceVsSma.js';
import { rsiIndicator } from './rsi.js';
import { rsiRange } from './rsiRange.js';
import { volumeSpike } from './volumeSpike.js';
import { emaRising } from './emaRising.js';

const INDICATORS = [priceVsEma, emaRising, priceVsSma, rsiIndicator, rsiRange, volumeSpike];

const byId = Object.fromEntries(INDICATORS.map((i) => [i.id, i]));

export function listIndicators() {
  return INDICATORS.map(({ id, label, description, params }) => ({
    id,
    label,
    description,
    params,
  }));
}

export function getIndicator(id) {
  const ind = byId[id];
  if (!ind) throw new Error(`Unknown indicator: ${id}`);
  return ind;
}

export function defaultParams(indicator) {
  const params = {};
  for (const field of indicator.params) {
    params[field.key] = field.default;
  }
  return params;
}

export function buildQueryLabel(query) {
  const parts = (query.indicators || []).map((item) => {
    const def = getIndicator(item.id);
    const p = item.params || {};
    if (item.id === 'price_vs_ema') {
      return `Close ${p.operator || '>='} EMA ${p.period || 50}`;
    }
    if (item.id === 'ema_rising') {
      return `EMA ${p.period || 50} rising (${p.lookback || 5}d)`;
    }
    if (item.id === 'price_vs_sma') {
      return `Close ${p.operator || '>='} SMA ${p.period || 20}`;
    }
    if (item.id === 'rsi') {
      return `RSI ${p.period || 14} ${p.operator || '<='} ${p.threshold ?? 30}`;
    }
    if (item.id === 'rsi_range') {
      return `RSI ${p.period || 14} in ${p.min ?? 45}–${p.max ?? 65}`;
    }
    if (item.id === 'volume_spike') {
      return `Vol ≥ ${p.multiplier || 2}× avg ${p.lookback || 20}d`;
    }
    return def.label;
  });
  return parts.join(` ${query.logic || 'AND'} `);
}

export function resultColumnsForQuery(query) {
  const cols = [];
  for (const item of query.indicators || []) {
    const def = getIndicator(item.id);
    if (def.columns) cols.push(...def.columns(item.params));
  }
  return cols;
}

export function requiredHistoryDays(query) {
  let days = 70;
  for (const item of query.indicators || []) {
    const def = getIndicator(item.id);
    const need = def.minHistoryDays(item.params || {});
    if (need > days) days = need;
  }
  return days;
}
