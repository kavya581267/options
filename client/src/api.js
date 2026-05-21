const BASE = '/api';

export async function fetchHealth() {
  const res = await fetch(`${BASE}/health`);
  return res.json();
}

export async function fetchSymbols() {
  const res = await fetch(`${BASE}/symbols`);
  return res.json();
}

export async function fetchDates(symbol) {
  const res = await fetch(`${BASE}/dates/${symbol}`);
  return res.json();
}

export async function fetchDayData(symbol, date) {
  const q = date ? `?date=${date}` : '';
  const res = await fetch(`${BASE}/data/${symbol}${q}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function triggerFetch({ symbols, forceAnchor = true } = {}) {
  const res = await fetch(`${BASE}/fetch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbols, forceAnchor }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}
