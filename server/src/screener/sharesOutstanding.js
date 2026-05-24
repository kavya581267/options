import fs from 'fs/promises';
import path from 'path';
import { config } from '../config.js';
import { getNseClient } from './exchangeClients.js';
import { getRecentTradingDates } from './bhavcopyHistory.js';

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

let cachedMap = null;
let cachedAt = 0;
let cachedDate = null;

function cachePath() {
  return path.join(config.dataDir, 'screener', 'shares_cache.json');
}

function parseCsvLine(line) {
  const parts = [];
  let current = '';
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  parts.push(current.trim());
  return parts;
}

function parseSecurityReportText(raw) {
  const lines = raw.trim().split(/\r?\n/);
  if (lines.length < 2) return new Map();

  const headers = parseCsvLine(lines[0]);
  const idx = Object.fromEntries(headers.map((h, i) => [h, i]));
  const map = new Map();

  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const cols = parseCsvLine(line);
    const symbol = String(cols[idx.TckrSymb] || '').trim().toUpperCase();
    const series = String(cols[idx.SctySrs] || '').trim().toUpperCase();
    const shares = Number(cols[idx.IssdCptl] ?? 0);

    if (!symbol || series !== 'EQ' || !(shares > 0)) continue;
    map.set(symbol, shares);
  }

  return map;
}

async function downloadSecurityReport(dateStr) {
  const date = new Date(`${dateStr}T12:00:00`);
  const nse = getNseClient();
  return nse.download.downloadCmMiiSecurityReport(date);
}

async function readCache() {
  try {
    const raw = await fs.readFile(cachePath(), 'utf-8');
    const payload = JSON.parse(raw);
    if (!payload?.symbols || Date.now() - (payload.updatedAt || 0) > CACHE_TTL_MS) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

async function writeCache(dateStr, map) {
  const payload = {
    updatedAt: Date.now(),
    asOfDate: dateStr,
    symbolCount: map.size,
    symbols: Object.fromEntries(map),
  };
  await fs.mkdir(path.dirname(cachePath()), { recursive: true });
  await fs.writeFile(cachePath(), JSON.stringify(payload), 'utf-8');
  return payload;
}

async function resolveReportDate(preferredDate = null) {
  const candidates = preferredDate
    ? [preferredDate, ...getRecentTradingDates(10).filter((d) => d !== preferredDate)]
    : getRecentTradingDates(10);

  for (const dateStr of candidates) {
    try {
      await downloadSecurityReport(dateStr);
      return dateStr;
    } catch {
      /* try previous trading day */
    }
  }
  return null;
}

export async function loadSharesMap(preferredDate = null, { force = false } = {}) {
  const now = Date.now();
  if (
    !force &&
    cachedMap &&
    cachedAt &&
    now - cachedAt < 60_000 &&
    (!preferredDate || preferredDate === cachedDate)
  ) {
    return cachedMap;
  }

  if (!force) {
    const cached = await readCache();
    if (cached?.symbols && (!preferredDate || cached.asOfDate === preferredDate)) {
      cachedMap = new Map(Object.entries(cached.symbols).map(([k, v]) => [k, Number(v)]));
      cachedAt = now;
      cachedDate = cached.asOfDate;
      return cachedMap;
    }
  }

  const dateStr = await resolveReportDate(preferredDate);
  if (!dateStr) {
    cachedMap = new Map();
    cachedAt = now;
    cachedDate = null;
    return cachedMap;
  }

  const filePath = await downloadSecurityReport(dateStr);
  const raw = await fs.readFile(filePath, 'utf-8');
  const map = parseSecurityReportText(raw);
  await writeCache(dateStr, map);

  cachedMap = map;
  cachedAt = now;
  cachedDate = dateStr;
  return map;
}

export function getSharesOutstanding(map, symbol) {
  return map?.get(symbol?.toUpperCase()) ?? null;
}

/** Market cap in ₹ crore (10^7 rupees). */
export function getMarketCapCr(map, symbol, close) {
  const shares = getSharesOutstanding(map, symbol);
  if (!(shares > 0) || !(close > 0)) return null;
  return Number(((close * shares) / 1e7).toFixed(2));
}

export function clearSharesCache() {
  cachedMap = null;
  cachedAt = 0;
  cachedDate = null;
}
