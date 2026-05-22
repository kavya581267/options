import { createStrategyApi } from './strategyApi.js';

const BASE = '/api/fyers';

export const fyersStrategyApi = createStrategyApi(BASE);

export async function fetchFyersConfig() {
  const res = await fetch(`${BASE}/config`);
  if (!res.ok) throw new Error('Fyers API unavailable');
  return res.json();
}

export async function fetchFyersSchedule() {
  const res = await fetch(`${BASE}/schedule`);
  if (!res.ok) throw new Error('Failed to load schedule');
  return res.json();
}

export async function saveFyersSchedule(schedule) {
  const res = await fetch(`${BASE}/schedule`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(schedule),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Save schedule failed');
  return data;
}

export async function resetFyersScheduleToday() {
  const res = await fetch(`${BASE}/schedule/reset-today`, { method: 'POST' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Reset failed');
  return data;
}

export async function runFyersScheduleNow(force = true) {
  const res = await fetch(`${BASE}/schedule/run-now`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ force }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Run failed');
  return data;
}

export async function saveFyersConfig(trading) {
  const res = await fetch(`${BASE}/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(trading),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Save config failed');
  return data;
}

export async function fetchFyersSession() {
  const res = await fetch(`${BASE}/session`);
  if (!res.ok) throw new Error('Fyers API unavailable');
  return res.json();
}

export async function fetchFyersAuthUrl() {
  const res = await fetch(`${BASE}/auth-url`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Auth URL failed');
  return data;
}

export async function fyersLoginAuthCode(authCode) {
  const res = await fetch(`${BASE}/login/auth-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ authCode }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Login failed');
  return data;
}

export async function fyersLogout() {
  await fetch(`${BASE}/logout`, { method: 'POST' });
}

export async function fetchFyersStraddleQuote(symbol, strike) {
  const res = await fetch(
    `${BASE}/quotes/straddle?symbol=${encodeURIComponent(symbol)}&strike=${strike}`
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Quote fetch failed');
  return data;
}

export async function fetchFyersTrackerAnchor(symbol) {
  const res = await fetch(`${BASE}/anchor/${symbol}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchFyersTradeStatus(symbol) {
  const res = await fetch(`${BASE}/trade/${symbol}`);
  return res.json();
}

export async function fetchFyersOpenTrades() {
  const res = await fetch(`${BASE}/trades/open`);
  if (!res.ok) throw new Error('Failed to load open trades');
  return res.json();
}

export async function fetchFyersLiveTrade(symbol) {
  const res = await fetch(`${BASE}/live/${symbol}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Live status failed');
  return data;
}

export async function previewFyersLevels(premium) {
  const res = await fetch(`${BASE}/levels/preview?premium=${premium}`);
  return res.json();
}

export async function fyersEnter(symbol, strike, entryPremium) {
  const res = await fetch(`${BASE}/enter`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol, strike, entryPremium }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Enter failed');
  return data;
}

export async function fyersExit(symbol) {
  const res = await fetch(`${BASE}/exit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Exit failed');
  return data;
}

export async function fyersMonitor(symbol, currentPremium) {
  const res = await fetch(`${BASE}/monitor`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol, currentPremium }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Monitor failed');
  return data;
}
