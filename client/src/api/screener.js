const BASE = '/api/screener';

async function parseJson(res) {
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export async function fetchIndicators() {
  return parseJson(await fetch(`${BASE}/indicators`));
}

export async function fetchPresets() {
  return parseJson(await fetch(`${BASE}/presets`));
}

export async function savePreset({ name, query }) {
  return parseJson(
    await fetch(`${BASE}/presets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, query }),
    })
  );
}

export async function deletePreset(id) {
  return parseJson(
    await fetch(`${BASE}/presets/${encodeURIComponent(id)}`, { method: 'DELETE' })
  );
}

export async function fetchScreenerUniverses() {
  return parseJson(await fetch(`${BASE}/universes`));
}

export async function fetchScreenerDates(query) {
  return parseJson(
    await fetch(`${BASE}/dates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    })
  );
}

export async function fetchScreenerResults({ query, date, queryId }) {
  if (queryId && date) {
    return parseJson(
      await fetch(`${BASE}/results?queryId=${encodeURIComponent(queryId)}&date=${encodeURIComponent(date)}`)
    );
  }
  return parseJson(
    await fetch(`${BASE}/results`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, date }),
    })
  );
}

export async function fetchScreenerStatus() {
  return parseJson(await fetch(`${BASE}/status`));
}

export async function runScreenerScan({ query, date, force = false } = {}) {
  return parseJson(
    await fetch(`${BASE}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, date, force }),
    })
  );
}

export async function fetchStockDetails(symbol, queryId) {
  const q = queryId ? `?queryId=${encodeURIComponent(queryId)}` : '';
  return parseJson(await fetch(`${BASE}/stock/${encodeURIComponent(symbol)}${q}`));
}

export const DEFAULT_QUERY = {
  logic: 'AND',
  universe: 'all',
  indicators: [
    { id: 'price_vs_ema', params: { period: 50, operator: '>=' } },
    { id: 'ema_rising', params: { period: 50, lookback: 5, operator: '>' } },
    { id: 'rsi_range', params: { period: 14, min: 45, max: 65 } },
    { id: 'volume_spike', params: { lookback: 20, multiplier: 1.5 } },
  ],
};

export function defaultParamsForIndicator(indicatorDef) {
  const params = {};
  for (const field of indicatorDef?.params || []) {
    params[field.key] = field.default;
  }
  return params;
}

export function getMetricValue(row, columnKey) {
  const [indicatorId, metric] = columnKey.split('.');
  return row?.indicators?.[indicatorId]?.[metric] ?? null;
}

export function buildQueryLabel(query, indicatorCatalog) {
  const parts = (query.indicators || []).map((item) => {
    const def = indicatorCatalog.find((i) => i.id === item.id);
    const p = item.params || {};
    if (item.id === 'price_vs_ema') return `Close ${p.operator || '>='} EMA ${p.period || 50}`;
    if (item.id === 'ema_rising') return `EMA ${p.period || 50} rising (${p.lookback || 5}d)`;
    if (item.id === 'price_vs_sma') return `Close ${p.operator || '>='} SMA ${p.period || 20}`;
    if (item.id === 'rsi') return `RSI ${p.period || 14} ${p.operator || '<='} ${p.threshold ?? 30}`;
    if (item.id === 'rsi_range') return `RSI ${p.period || 14} in ${p.min ?? 45}–${p.max ?? 65}`;
    if (item.id === 'volume_spike') return `Vol ≥ ${p.multiplier || 2}× avg ${p.lookback || 20}d`;
    return def?.label || item.id;
  });
  return parts.join(` ${query.logic || 'AND'} `);
}
