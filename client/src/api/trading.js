const BASE = '/api/trading';

export async function fetchTradingConfig() {
  const res = await fetch(`${BASE}/config`);
  if (!res.ok) throw new Error('Trading API unavailable');
  return res.json();
}

export async function fetchTradingSession() {
  const res = await fetch(`${BASE}/session`);
  if (!res.ok) throw new Error('Trading API unavailable');
  return res.json();
}

export async function fetchStraddleQuote(symbol, strike) {
  const res = await fetch(
    `${BASE}/quotes/straddle?symbol=${encodeURIComponent(symbol)}&strike=${strike}`
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Quote fetch failed');
  return data;
}

export async function fetchTrackerAnchor(symbol) {
  const res = await fetch(`${BASE}/anchor/${symbol}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function kotakLoginTotp(totp) {
  const res = await fetch(`${BASE}/login/totp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ totp }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'TOTP login failed');
  return data;
}

export async function kotakLoginMpin(mpin) {
  const res = await fetch(`${BASE}/login/mpin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mpin }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'MPIN failed');
  return data;
}

export async function kotakLogout() {
  await fetch(`${BASE}/logout`, { method: 'POST' });
}

export async function fetchTradeStatus(symbol) {
  const res = await fetch(`${BASE}/trade/${symbol}`);
  return res.json();
}

export async function previewLevels(premium) {
  const res = await fetch(`${BASE}/levels/preview?premium=${premium}`);
  return res.json();
}

export async function tradingEnter(symbol, strike, entryPremium) {
  const res = await fetch(`${BASE}/enter`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol, strike, entryPremium }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Enter failed');
  return data;
}

export async function tradingExit(symbol) {
  const res = await fetch(`${BASE}/exit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Exit failed');
  return data;
}

export async function tradingMonitor(symbol, currentPremium) {
  const res = await fetch(`${BASE}/monitor`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol, currentPremium }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Monitor failed');
  return data;
}
