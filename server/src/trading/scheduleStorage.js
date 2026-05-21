import fs from 'fs/promises';
import path from 'path';
import { config } from '../config.js';

const DEFAULT_SCHEDULE = {
  enabled: false,
  entryTime: '09:15',
  symbol: 'NIFTY',
  autoEnter: true,
  monitorIntervalSec: 30,
  saveToTracker: true,
  lastExecutedDate: null,
  lastSnapshot: null,
  lastError: null,
  lastErrorAt: null,
};

let schedule = { ...DEFAULT_SCHEDULE };

function schedulePath() {
  return path.join(config.dataDir, 'kotak-schedule.json');
}

export function getSchedule() {
  return { ...schedule };
}

function normalizeSchedule(input = {}) {
  const entryTime = String(input.entryTime || schedule.entryTime || '09:15');
  if (!/^\d{2}:\d{2}$/.test(entryTime)) {
    throw new Error('entryTime must be HH:mm (24h IST)');
  }
  const symbol = String(input.symbol || schedule.symbol || 'NIFTY').toUpperCase();
  if (!['NIFTY', 'SENSEX'].includes(symbol)) {
    throw new Error('symbol must be NIFTY or SENSEX');
  }
  const monitorIntervalSec = Math.min(
    60,
    Math.max(15, parseInt(input.monitorIntervalSec ?? schedule.monitorIntervalSec ?? 30, 10))
  );

  return {
    enabled: Boolean(input.enabled ?? schedule.enabled),
    entryTime,
    symbol,
    autoEnter: Boolean(input.autoEnter ?? schedule.autoEnter ?? true),
    monitorIntervalSec,
    saveToTracker: Boolean(input.saveToTracker ?? schedule.saveToTracker ?? true),
    lastExecutedDate: input.lastExecutedDate ?? schedule.lastExecutedDate ?? null,
    lastSnapshot: input.lastSnapshot ?? schedule.lastSnapshot ?? null,
    lastError: input.lastError ?? schedule.lastError ?? null,
    lastErrorAt: input.lastErrorAt ?? schedule.lastErrorAt ?? null,
  };
}

export async function loadSchedule() {
  try {
    const raw = await fs.readFile(schedulePath(), 'utf-8');
    schedule = normalizeSchedule(JSON.parse(raw));
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn('[schedule] load failed:', err.message);
    }
    schedule = { ...DEFAULT_SCHEDULE, symbol: config.trading.symbol };
  }
  return getSchedule();
}

export async function updateSchedule(updates) {
  schedule = normalizeSchedule({ ...schedule, ...updates });
  await fs.mkdir(config.dataDir, { recursive: true });
  await fs.writeFile(schedulePath(), JSON.stringify(schedule, null, 2), 'utf-8');
  return getSchedule();
}

export async function markScheduleExecuted(snapshot, enterResult = null) {
  schedule = {
    ...schedule,
    lastExecutedDate: snapshot.date,
    lastSnapshot: { ...snapshot, enterResult },
    lastError: null,
    lastErrorAt: null,
  };
  await fs.writeFile(schedulePath(), JSON.stringify(schedule, null, 2), 'utf-8');
  return getSchedule();
}

export async function markScheduleFailed(date, message) {
  schedule = {
    ...schedule,
    lastError: String(message),
    lastErrorAt: new Date().toISOString(),
  };
  await fs.writeFile(schedulePath(), JSON.stringify(schedule, null, 2), 'utf-8');
  return getSchedule();
}
