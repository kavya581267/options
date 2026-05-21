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

function pickField(input, key, fallback) {
  return Object.prototype.hasOwnProperty.call(input, key) ? input[key] : fallback;
}

function normalizeSchedule(input = {}, base = schedule) {
  const entryTime = String(input.entryTime || base.entryTime || '09:15');
  if (!/^\d{2}:\d{2}$/.test(entryTime)) {
    throw new Error('entryTime must be HH:mm (24h IST)');
  }
  const symbol = String(input.symbol || base.symbol || 'NIFTY').toUpperCase();
  if (!['NIFTY', 'SENSEX'].includes(symbol)) {
    throw new Error('symbol must be NIFTY or SENSEX');
  }
  const monitorIntervalSec = Math.min(
    60,
    Math.max(15, parseInt(input.monitorIntervalSec ?? base.monitorIntervalSec ?? 30, 10))
  );

  return {
    enabled: Boolean(pickField(input, 'enabled', base.enabled)),
    entryTime,
    symbol,
    autoEnter: Boolean(pickField(input, 'autoEnter', base.autoEnter ?? true)),
    monitorIntervalSec,
    saveToTracker: Boolean(pickField(input, 'saveToTracker', base.saveToTracker ?? true)),
    lastExecutedDate: pickField(input, 'lastExecutedDate', base.lastExecutedDate ?? null),
    lastSnapshot: pickField(input, 'lastSnapshot', base.lastSnapshot ?? null),
    lastError: pickField(input, 'lastError', base.lastError ?? null),
    lastErrorAt: pickField(input, 'lastErrorAt', base.lastErrorAt ?? null),
  };
}

export async function loadSchedule() {
  try {
    const raw = await fs.readFile(schedulePath(), 'utf-8');
    const parsed = JSON.parse(raw);
    schedule = normalizeSchedule(
      { ...DEFAULT_SCHEDULE, ...parsed },
      DEFAULT_SCHEDULE
    );
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

/** Clear today's run snapshot so schedule can fire again and UI resets. */
export async function clearScheduleExecution() {
  return updateSchedule({
    lastExecutedDate: null,
    lastSnapshot: null,
    lastError: null,
    lastErrorAt: null,
  });
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
