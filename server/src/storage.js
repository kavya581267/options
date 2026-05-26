import fs from 'fs/promises';
import path from 'path';
import { config } from './config.js';
import { getISTDateString, formatISTTime } from './marketHours.js';

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

function filePath(symbol, dateStr) {
  return path.join(config.dataDir, symbol, `${dateStr}.json`);
}

function normalizeDayFile(parsed) {
  if (Array.isArray(parsed)) {
    return {
      anchor: null,
      readings: parsed.map((r) => ({
        ...r,
        strike: r.strike ?? r.atmStrike,
      })),
    };
  }
  return {
    anchor: parsed.anchor ?? null,
    readings: Array.isArray(parsed.readings) ? parsed.readings : [],
  };
}

async function readDayFile(symbol, dateStr) {
  const fp = filePath(symbol, dateStr);
  try {
    const raw = await fs.readFile(fp, 'utf-8');
    return normalizeDayFile(JSON.parse(raw));
  } catch (err) {
    if (err.code === 'ENOENT') return { anchor: null, readings: [] };
    throw err;
  }
}

async function writeDayFile(symbol, dateStr, day) {
  const dir = path.join(config.dataDir, symbol);
  await ensureDir(dir);
  await fs.writeFile(
    filePath(symbol, dateStr),
    JSON.stringify(day, null, 2),
    'utf-8'
  );
}

export async function getAnchor(symbol, dateStr = getISTDateString()) {
  const day = await readDayFile(symbol, dateStr);
  return day.anchor;
}

export async function setAnchor(symbol, anchorData) {
  const dateStr = getISTDateString();
  const day = await readDayFile(symbol, dateStr);

  day.anchor = {
    time: formatISTTime(),
    spot: anchorData.spot,
    strike: anchorData.strike,
    straddlePremium: anchorData.straddlePremium,
  };

  await writeDayFile(symbol, dateStr, day);
  return day.anchor;
}

function toReading(data) {
  return {
    time: formatISTTime(),
    timestamp: new Date().toISOString(),
    spot: data.spot,
    strike: data.strike,
    cePremium: data.cePremium,
    pePremium: data.pePremium,
    straddlePremium: data.straddlePremium,
  };
}

export async function appendReading(symbol, data) {
  const dateStr = getISTDateString();
  const day = await readDayFile(symbol, dateStr);
  const entry = toReading(data);
  day.readings.push(entry);
  await writeDayFile(symbol, dateStr, day);
  return entry;
}

export async function readDayData(symbol, dateStr) {
  const day = await readDayFile(symbol, dateStr);
  return {
    anchor: day.anchor,
    readings: day.readings,
  };
}

export async function listAvailableDates(symbol) {
  const dir = path.join(config.dataDir, symbol);
  try {
    const files = await fs.readdir(dir);
    return files
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace('.json', ''))
      .sort()
      .reverse();
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

export function computeDayStats(readings, anchor, symbol = '') {
  const lotSize = symbol === 'NIFTY' ? 65 : symbol === 'SENSEX' ? 20 : 1;

  if (!readings.length) {
    return {
      anchorSpot: anchor?.spot ?? null,
      anchorStrike: anchor?.strike ?? null,
      premiumHigh: null,
      premiumLow: null,
      count: 0,
      entryPremium: null,
      lotSize,
      entryAmount: null,
      high300: null,
      low300: null,
      maxLoss300: null,
      maxGain300: null,
      exitPremium300: null,
      exitPnL300: null,
      high325: null,
      low325: null,
      maxLoss325: null,
      maxGain325: null,
      exitPremium320: null,
      exitPnL320: null,
    };
  }

  const premiums = readings.map((r) => r.straddlePremium);

  const entryReading = readings.find(
    (r) => r.time && r.time >= '09:20:00'
  );
  const entryPremium = entryReading ? entryReading.straddlePremium : null;

  // 9:20 - 3:00 range
  const range300 = readings.filter(
    (r) => r.time && r.time >= '09:20:00' && r.time <= '15:00:00'
  );
  const premiums300 = range300.map((r) => r.straddlePremium);
  const high300 = premiums300.length ? Math.max(...premiums300) : null;
  const low300 = premiums300.length ? Math.min(...premiums300) : null;

  // 3:00 PM exit (15:00:00)
  const exitReading300 = readings.find(r => r.time && r.time.startsWith('15:00')) || readings.find(r => r.time && r.time >= '15:00:00');
  const exitPremium300 = exitReading300 ? exitReading300.straddlePremium : null;

  // 9:20 - 3:25 range
  const range325 = readings.filter(
    (r) => r.time && r.time >= '09:20:00' && r.time <= '15:25:00'
  );
  const premiums325 = range325.map((r) => r.straddlePremium);
  const high325 = premiums325.length ? Math.max(...premiums325) : null;
  const low325 = premiums325.length ? Math.min(...premiums325) : null;

  // 3:20 PM exit (15:20:00)
  const exitReading320 = readings.find(r => r.time && r.time.startsWith('15:20')) || readings.find(r => r.time && r.time >= '15:20:00');
  const exitPremium320 = exitReading320 ? exitReading320.straddlePremium : null;

  const entryAmount = entryPremium != null ? entryPremium * lotSize : null;

  const maxLoss300 = (high300 != null && entryPremium != null)
    ? Math.max(0, high300 - entryPremium) * lotSize
    : null;
  const maxGain300 = (low300 != null && entryPremium != null)
    ? Math.max(0, entryPremium - low300) * lotSize
    : null;
  const exitPnL300 = (entryPremium != null && exitPremium300 != null)
    ? (entryPremium - exitPremium300) * lotSize
    : null;

  const maxLoss325 = (high325 != null && entryPremium != null)
    ? Math.max(0, high325 - entryPremium) * lotSize
    : null;
  const maxGain325 = (low325 != null && entryPremium != null)
    ? Math.max(0, entryPremium - low325) * lotSize
    : null;
  const exitPnL320 = (entryPremium != null && exitPremium320 != null)
    ? (entryPremium - exitPremium320) * lotSize
    : null;

  return {
    anchorSpot: anchor?.spot ?? readings[0]?.spot ?? null,
    anchorStrike: anchor?.strike ?? readings[0]?.strike ?? null,
    premiumHigh: Math.max(...premiums),
    premiumLow: Math.min(...premiums),
    count: readings.length,
    entryPremium,
    lotSize,
    entryAmount,
    high300,
    low300,
    maxLoss300,
    maxGain300,
    exitPremium300,
    exitPnL300,
    high325,
    low325,
    maxLoss325,
    maxGain325,
    exitPremium320,
    exitPnL320,
  };
}
