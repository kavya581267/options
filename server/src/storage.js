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

export function computeDayStats(readings, anchor) {
  if (!readings.length) {
    return {
      anchorSpot: anchor?.spot ?? null,
      anchorStrike: anchor?.strike ?? null,
      premiumHigh: null,
      premiumLow: null,
      count: 0,
    };
  }

  const premiums = readings.map((r) => r.straddlePremium);

  return {
    anchorSpot: anchor?.spot ?? readings[0]?.spot ?? null,
    anchorStrike: anchor?.strike ?? readings[0]?.strike ?? null,
    premiumHigh: Math.max(...premiums),
    premiumLow: Math.min(...premiums),
    count: readings.length,
  };
}
