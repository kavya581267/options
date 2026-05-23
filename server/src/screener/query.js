import crypto from 'crypto';
import { getIndicator, defaultParams } from './indicators/registry.js';

const OPERATORS = new Set(['>=', '<=', '>', '<', '==']);

export function normalizeQuery(raw = {}) {
  const indicators = (raw.indicators || [])
    .filter((item) => item?.id)
    .map((item) => {
      const def = getIndicator(item.id);
      const params = { ...defaultParams(def), ...(item.params || {}) };

      if (def.params) {
        for (const field of def.params) {
          if (field.type === 'number') {
            params[field.key] = Number(params[field.key]);
          }
          if (field.type === 'select' && !OPERATORS.has(params[field.key]) && field.key === 'operator') {
            params[field.key] = field.default;
          }
        }
      }

      return { id: item.id, params };
    });

  if (!indicators.length) {
    throw new Error('At least one indicator is required');
  }

  return {
    logic: raw.logic === 'OR' ? 'OR' : 'AND',
    universe: raw.universe || 'all',
    indicators,
  };
}

export function queryId(query) {
  const norm = normalizeQuery(query);
  const payload = JSON.stringify({
    logic: norm.logic,
    indicators: norm.indicators,
  });
  return crypto.createHash('sha256').update(payload).digest('hex').slice(0, 12);
}

export function defaultQuery() {
  return normalizeQuery({
    logic: 'AND',
    universe: 'all',
    indicators: [
      { id: 'price_vs_ema', params: { period: 50, operator: '>=' } },
      { id: 'ema_rising', params: { period: 50, lookback: 5, operator: '>' } },
      { id: 'rsi_range', params: { period: 14, min: 45, max: 65 } },
      { id: 'volume_spike', params: { lookback: 20, multiplier: 1.5 } },
    ],
  });
}
