import { createStrategyApi } from './strategyApi.js';

const BASE = '/api/trading';

export const kotakStrategyApi = createStrategyApi(BASE);

export async function fetchTradingConfig() {
  const res = await fetch(`${BASE}/config`);
  if (!res.ok) throw new Error('Trading API unavailable');
  return res.json();
}

export async function fetchSchedule() {
  const res = await fetch(`${BASE}/schedule`);
  if (!res.ok) throw new Error('Failed to load schedule');
  return res.json();
}

export async function saveSchedule(schedule) {
  const res = await fetch(`${BASE}/schedule`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(schedule),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Save schedule failed');
  return data;
}

export async function resetScheduleToday() {
  const res = await fetch(`${BASE}/schedule/reset-today`, { method: 'POST' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Reset failed');
  return data;
}

export async function runScheduleNow(force = true) {
  const res = await fetch(`${BASE}/schedule/run-now`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ force }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Run failed');
  return data;
}

export async function saveTradingConfig(trading) {
  const res = await fetch(`${BASE}/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(trading),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Save config failed');
  return data;
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

export async function fetchOpenTrades() {
  const res = await fetch(`${BASE}/trades/open`);
  if (!res.ok) throw new Error('Failed to load open trades');
  return res.json();
}

export async function fetchLiveTrade(symbol) {
  const res = await fetch(`${BASE}/live/${symbol}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Live status failed');
  return data;
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
