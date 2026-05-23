import fs from 'fs/promises';
import path from 'path';
import { config } from '../config.js';
import { getNseClient, getBseClient } from './exchangeClients.js';

const NON_EQUITY_SERIES = new Set(['GB', 'GS', 'TB', 'MF']);

function cacheRoot() {
  return path.join(config.dataDir, 'screener', 'bhavcache');
}

function cacheFile(exchange, dateStr) {
  return path.join(cacheRoot(), exchange.toLowerCase(), `${dateStr}.json`);
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
      parts.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  parts.push(current);
  return parts;
}

function isNseEquityRow(row) {
  return row.FinInstrmTp === 'STK' && !NON_EQUITY_SERIES.has(row.SctySrs);
}

function isBseEquityRow(row) {
  return row.FinInstrmTp === 'STK';
}

function rowToEntry(row) {
  return {
    symbol: String(row.TckrSymb || '').toUpperCase(),
    close: Number(row.ClsPric ?? row.LastPric ?? 0),
    volume: Number(row.TtlTradgVol ?? 0),
    name: row.FinInstrmNm || row.TckrSymb,
    isin: row.ISIN || null,
    series: row.SctySrs || null,
    scripCode: row.FinInstrmId ? String(row.FinInstrmId) : null,
  };
}

export async function parseBhavcopyFile(filePath, exchange) {
  const raw = await fs.readFile(filePath, 'utf-8');
  const lines = raw.trim().split(/\r?\n/);
  if (lines.length < 2) return {};

  const headers = parseCsvLine(lines[0]);
  const idx = Object.fromEntries(headers.map((h, i) => [h, i]));
  const symbols = {};

  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const cols = parseCsvLine(line);
    const row = Object.fromEntries(headers.map((h, i) => [h, cols[idx[h]] ?? '']));
    const isEquity = exchange === 'NSE' ? isNseEquityRow(row) : isBseEquityRow(row);
    if (!isEquity) continue;

    const entry = rowToEntry(row);
    if (!entry.symbol || !entry.close || Number.isNaN(entry.close)) continue;
    symbols[entry.symbol] = entry;
  }

  return symbols;
}

export function getRecentTradingDates(count, fromDate = new Date()) {
  const dates = [];
  const cursor = new Date(fromDate);

  while (dates.length < count) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) {
      dates.push(cursor.toISOString().slice(0, 10));
    }
    cursor.setDate(cursor.getDate() - 1);
  }

  return dates;
}

async function downloadBhavcopyFile(exchange, dateStr) {
  const date = new Date(`${dateStr}T12:00:00`);
  if (exchange === 'NSE') {
    const nse = getNseClient();
    return nse.download.downloadEquityBhavcopy(date);
  }
  const bse = getBseClient();
  return bse.bhavcopyReport(date);
}

function cacheNeedsVolumeRefresh(payload) {
  if (!payload?.symbols || !Object.keys(payload.symbols).length) return false;
  if (payload.cacheVersion >= 2) return false;
  const sample = Object.values(payload.symbols).slice(0, 20);
  return sample.every((entry) => !(entry.volume > 0));
}

async function refreshStaleCacheFiles() {
  for (const exchange of ['NSE', 'BSE']) {
    const dir = path.join(cacheRoot(), exchange.toLowerCase());
    try {
      const files = await fs.readdir(dir);
      for (const file of files.filter((f) => f.endsWith('.json'))) {
        const fp = path.join(dir, file);
        try {
          const cached = JSON.parse(await fs.readFile(fp, 'utf-8'));
          if (cacheNeedsVolumeRefresh(cached)) {
            await fs.unlink(fp);
          }
        } catch {
          /* ignore bad files */
        }
      }
    } catch {
      /* dir missing */
    }
  }
}

export async function ensureBhavcopyDay(exchange, dateStr) {
  const fp = cacheFile(exchange, dateStr);
  try {
    await fs.access(fp);
    const raw = await fs.readFile(fp, 'utf-8');
    const cached = JSON.parse(raw);
    if (!cacheNeedsVolumeRefresh(cached)) {
      return cached;
    }
    await fs.unlink(fp);
  } catch {
    /* download below */
  }

  let filePath;
  try {
    filePath = await downloadBhavcopyFile(exchange, dateStr);
  } catch (err) {
    throw new Error(`${exchange} bhavcopy ${dateStr}: ${err.message}`);
  }

  const symbols = await parseBhavcopyFile(filePath, exchange);
  const payload = {
    exchange,
    date: dateStr,
    symbolCount: Object.keys(symbols).length,
    cacheVersion: 2,
    symbols,
  };

  await fs.mkdir(path.dirname(fp), { recursive: true });
  await fs.writeFile(fp, JSON.stringify(payload), 'utf-8');
  return payload;
}

export async function buildBhavcopyHistoryCache({
  days = 70,
  onProgress,
} = {}) {
  await refreshStaleCacheFiles();

  const dates = getRecentTradingDates(days);
  const exchanges = ['NSE', 'BSE'];
  const total = dates.length * exchanges.length;
  let done = 0;
  const errors = [];

  for (const dateStr of dates) {
    for (const exchange of exchanges) {
      try {
        await ensureBhavcopyDay(exchange, dateStr);
      } catch (err) {
        errors.push({ exchange, date: dateStr, error: err.message });
      }
      done += 1;
      onProgress?.({ done, total, date: dateStr, exchange });
    }
  }

  return { dates, errors };
}

/** In-memory cache so each bhav day is read once per scan, not per stock. */
const memoryDayCache = new Map();
/** Pre-built close/volume series per symbol+exchange for O(1) lookups during scan. */
const symbolSeriesCache = new Map();

export function clearDayCache() {
  memoryDayCache.clear();
  symbolSeriesCache.clear();
}

export async function warmDayCache(days = 70, { onProgress } = {}) {
  clearDayCache();
  await refreshStaleCacheFiles();

  const dates = getRecentTradingDates(days).reverse();
  const exchanges = ['NSE', 'BSE'];
  const total = dates.length * exchanges.length;
  let done = 0;
  const errors = [];

  for (const dateStr of dates) {
    for (const exchange of exchanges) {
      try {
        const day = await ensureBhavcopyDay(exchange, dateStr);
        memoryDayCache.set(`${exchange}:${dateStr}`, day);

        for (const [sym, entry] of Object.entries(day.symbols)) {
          if (!(entry?.close > 0)) continue;
          const key = `${sym}:${exchange}`;
          let series = symbolSeriesCache.get(key);
          if (!series) {
            series = { closes: [], volumes: [] };
            symbolSeriesCache.set(key, series);
          }
          series.closes.push(entry.close);
          series.volumes.push(entry.volume > 0 ? entry.volume : 0);
        }
      } catch (err) {
        errors.push({ exchange, date: dateStr, error: err.message });
      }
      done += 1;
      onProgress?.({ done, total, date: dateStr, exchange });
    }
  }

  return { dates: getRecentTradingDates(days), errors };
}

async function getDayCached(exchange, dateStr) {
  const key = `${exchange}:${dateStr}`;
  if (memoryDayCache.has(key)) return memoryDayCache.get(key);
  const day = await ensureBhavcopyDay(exchange, dateStr);
  memoryDayCache.set(key, day);
  return day;
}

export async function getSeries(symbol, exchanges, days = 70) {
  const sym = symbol.toUpperCase();
  const preferNse = exchanges?.includes('NSE');
  const preferBse = exchanges?.includes('BSE');
  const order = preferNse ? ['NSE', 'BSE'] : preferBse ? ['BSE', 'NSE'] : ['NSE', 'BSE'];

  for (const exchange of order) {
    const series = symbolSeriesCache.get(`${sym}:${exchange}`);
    if (series?.closes.length >= 20) {
      return { closes: series.closes, volumes: series.volumes, exchange };
    }
  }

  if (symbolSeriesCache.size === 0) {
    return getSeriesFromDays(symbol, exchanges, days);
  }

  return { closes: [], volumes: [], exchange: null };
}

async function getSeriesFromDays(symbol, exchanges, days = 70) {
  const sym = symbol.toUpperCase();
  const preferNse = exchanges?.includes('NSE');
  const preferBse = exchanges?.includes('BSE');
  const order = preferNse ? ['NSE', 'BSE'] : preferBse ? ['BSE', 'NSE'] : ['NSE', 'BSE'];

  const dates = getRecentTradingDates(days).reverse();
  for (const exchange of order) {
    const closes = [];
    const volumes = [];

    for (const dateStr of dates) {
      try {
        const day = await getDayCached(exchange, dateStr);
        const entry = day.symbols?.[sym];
        if (entry?.close > 0) {
          closes.push(entry.close);
          volumes.push(entry.volume > 0 ? entry.volume : 0);
        }
      } catch {
        /* skip missing day */
      }
    }

    if (closes.length >= 20) return { closes, volumes, exchange };
  }

  return { closes: [], volumes: [], exchange: null };
}

/** @deprecated use getSeries */
export async function getCloseSeries(symbol, exchanges, days = 70) {
  const { closes, exchange } = await getSeries(symbol, exchanges, days);
  return { closes, exchange };
}

export async function loadLatestUniverseFromBhavcopy() {
  const dates = getRecentTradingDates(10);
  let nseDay = null;
  let bseDay = null;

  for (const dateStr of dates) {
    if (!nseDay) {
      try {
        nseDay = await ensureBhavcopyDay('NSE', dateStr);
      } catch {
        /* try older date */
      }
    }
    if (!bseDay) {
      try {
        bseDay = await ensureBhavcopyDay('BSE', dateStr);
      } catch {
        /* try older date */
      }
    }
    if (nseDay && bseDay) break;
  }

  if (!nseDay && !bseDay) {
    throw new Error('Could not load NSE or BSE bhavcopy for equity universe');
  }

  const bySymbol = new Map();

  if (nseDay) {
    for (const [sym, entry] of Object.entries(nseDay.symbols)) {
      bySymbol.set(sym, {
        symbol: sym,
        name: entry.name,
        exchanges: ['NSE'],
        nseSeries: entry.series,
        isin: entry.isin,
        bseScripCode: null,
      });
    }
  }

  if (bseDay) {
    for (const [sym, entry] of Object.entries(bseDay.symbols)) {
      const existing = bySymbol.get(sym);
      if (existing) {
        existing.exchanges = [...new Set([...existing.exchanges, 'BSE'])];
        existing.bseScripCode = entry.scripCode;
        existing.name = existing.name || entry.name;
        existing.isin = existing.isin || entry.isin;
      } else {
        bySymbol.set(sym, {
          symbol: sym,
          name: entry.name,
          exchanges: ['BSE'],
          nseSeries: null,
          isin: entry.isin,
          bseScripCode: entry.scripCode,
        });
      }
    }
  }

  const all = [...bySymbol.values()];
  const nseEquity = all.filter((s) => s.exchanges.includes('NSE'));
  const bseEquity = all.filter((s) => s.exchanges.includes('BSE'));

  return {
    nse_equity: nseEquity,
    bse_equity: bseEquity,
    all,
    asOfDate: nseDay?.date || bseDay?.date,
  };
}
