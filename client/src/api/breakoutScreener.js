const API = '/api/breakout-screener';

export const DEFAULT_BREAKOUT_FILTERS = {
  require_market_bullish: true,
  require_sector_strong: true,
  require_above_ema50: true,
  require_above_ema200: true,
  require_breakout: true,
  require_volume_dry_up: false,
  require_delivery_min: false,
  delivery_pct_min: 45,
  require_consolidation: false,
  base_score_min: 50,
  require_atr_expansion: false,
  require_rs_rising: false,
  sectors_include: [],
  sectors_exclude: [],
};

export async function fetchBreakoutFilters() {
  const res = await fetch(`${API}/filters`);
  if (!res.ok) throw new Error((await res.json()).error || res.statusText);
  return res.json();
}

export async function fetchBreakoutSectors() {
  const res = await fetch(`${API}/sectors`);
  if (!res.ok) throw new Error((await res.json()).error || res.statusText);
  return res.json();
}

export async function fetchBreakoutDates() {
  const res = await fetch(`${API}/dates`);
  if (!res.ok) throw new Error((await res.json()).error || res.statusText);
  return res.json();
}

export async function fetchBreakoutResults(date) {
  const q = date ? `?date=${encodeURIComponent(date)}` : '';
  const res = await fetch(`${API}/results${q}`);
  if (!res.ok) throw new Error((await res.json()).error || res.statusText);
  return res.json();
}

export async function fetchBreakoutStatus() {
  const res = await fetch(`${API}/status`);
  if (!res.ok) throw new Error((await res.json()).error || res.statusText);
  return res.json();
}

export async function runBreakoutScan({ date, force = false, filters } = {}) {
  const res = await fetch(`${API}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date, force, filters }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export function getBreakoutCell(row, key) {
  if (key.includes('.')) {
    return key.split('.').reduce((o, k) => o?.[k], row);
  }
  return row[key];
}
