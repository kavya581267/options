import fs from 'fs/promises';
import path from 'path';
import { config } from '../config.js';
import {
  ensureBhavcopyDay,
  getRecentTradingDates,
  warmDayCache,
} from '../screener/bhavcopyHistory.js';

const NIFTY_PROXY_SYMBOLS = ['NIFTYBEES', 'NIFTY', 'NIFTY50', 'NIFTY 50'];

function bhavCsvDir() {
  return path.join(config.dataDir, 'screener', 'bhav');
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

function normalizeHeader(h) {
  return h.toLowerCase().replace(/\s+/g, '_');
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function barFromRow(row, dateStr) {
  const symbol = String(row.symbol || '').toUpperCase();
  if (!symbol || !(num(row.close) > 0)) return null;
  return {
    date: row.date || dateStr,
    symbol,
    open: num(row.open) || num(row.close),
    high: num(row.high) || num(row.close),
    low: num(row.low) || num(row.close),
    close: num(row.close),
    volume: num(row.volume),
    delivery_qty: num(row.delivery_qty),
    delivery_pct: num(row.delivery_pct),
    trades: num(row.trades),
    series: row.series ? String(row.series).toUpperCase() : null,
  };
}

async function parseCsvFile(filePath) {
  const raw = await fs.readFile(filePath, 'utf-8');
  const lines = raw.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map(normalizeHeader);
  const idx = Object.fromEntries(headers.map((h, i) => [h, i]));
  const bars = [];

  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const cols = parseCsvLine(line);
    const row = {};
    for (const h of headers) {
      row[h] = cols[idx[h]] ?? '';
    }
    const bar = barFromRow(row);
    if (bar) bars.push(bar);
  }
  return bars;
}

function entryToBar(entry, dateStr, exchange) {
  if (!entry?.symbol || !(entry.close > 0)) return null;
  return {
    date: dateStr,
    symbol: entry.symbol.toUpperCase(),
    exchange,
    open: num(entry.open) || entry.close,
    high: num(entry.high) || entry.close,
    low: num(entry.low) || entry.close,
    close: entry.close,
    volume: num(entry.volume),
    delivery_qty: num(entry.delivery_qty),
    delivery_pct: num(entry.delivery_pct),
    trades: num(entry.trades),
    series: entry.series ? String(entry.series).toUpperCase() : null,
  };
}

function appendBar(map, bar) {
  const sym = bar.symbol;
  if (!map.has(sym)) map.set(sym, []);
  map.get(sym).push(bar);
}

function sortBars(map) {
  for (const [sym, bars] of map.entries()) {
    bars.sort((a, b) => a.date.localeCompare(b.date));
    const byDate = new Map();
    for (const b of bars) {
      const existing = byDate.get(b.date);
      if (!existing || preferBar(b, existing)) {
        byDate.set(b.date, b);
      }
    }
    map.set(sym, [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)));
  }
}

function preferBar(candidate, existing) {
  if ((candidate.delivery_pct > 0) && !(existing.delivery_pct > 0)) return true;
  if ((existing.delivery_pct > 0) && !(candidate.delivery_pct > 0)) return false;
  if (candidate.exchange === 'NSE' && existing.exchange !== 'NSE') return true;
  return false;
}

let store = null;

export async function loadBhavStore({ days = 70, onProgress } = {}) {
  const symbolBars = new Map();
  let source = 'json_cache';
  let csvFiles = [];

  try {
    csvFiles = (await fs.readdir(bhavCsvDir())).filter((f) => f.toLowerCase().endsWith('.csv'));
  } catch {
    csvFiles = [];
  }

  if (csvFiles.length > 0) {
    source = 'csv';
    let done = 0;
    for (const file of csvFiles) {
      const bars = await parseCsvFile(path.join(bhavCsvDir(), file));
      for (const bar of bars) appendBar(symbolBars, bar);
      done += 1;
      onProgress?.({ phase: 'csv', done, total: csvFiles.length, file });
    }
    sortBars(symbolBars);
  } else {
    await warmDayCache(days, {
      onProgress: (p) => onProgress?.({ phase: 'cache', ...p }),
    });

    const dates = getRecentTradingDates(days).reverse();
    for (const dateStr of dates) {
      for (const exchange of ['BSE', 'NSE']) {
        try {
          const day = await ensureBhavcopyDay(exchange, dateStr);
          for (const entry of Object.values(day.symbols || {})) {
            const bar = entryToBar(entry, dateStr, exchange);
            if (bar) appendBar(symbolBars, bar);
          }
        } catch {
          /* skip */
        }
      }
    }
    sortBars(symbolBars);
  }

  const niftyBars = resolveNiftyBars(symbolBars);
  const dates = [...new Set([].concat(...[...symbolBars.values()].map((b) => b.map((x) => x.date))))].sort();
  const asOfDate = dates.at(-1) || null;

  store = { symbolBars, niftyBars, asOfDate, source, symbolCount: symbolBars.size };
  return store;
}

function resolveNiftyBars(symbolBars) {
  for (const sym of NIFTY_PROXY_SYMBOLS) {
    if (symbolBars.has(sym) && symbolBars.get(sym).length >= 20) {
      return symbolBars.get(sym);
    }
  }
  const nseSymbols = [...symbolBars.keys()].filter((s) => symbolBars.get(s).length >= 50);
  if (nseSymbols.length < 20) return null;

  const sample = nseSymbols.slice(0, 50);
  const len = Math.min(...sample.map((s) => symbolBars.get(s).length));
  const synthetic = [];
  for (let i = 0; i < len; i++) {
    let sum = 0;
    let count = 0;
    let date = null;
    for (const sym of sample) {
      const bar = symbolBars.get(sym)[i];
      if (bar?.close > 0) {
        sum += bar.close;
        count += 1;
        date = bar.date;
      }
    }
    if (count > 0 && date) {
      const avg = sum / count;
      synthetic.push({
        date,
        symbol: 'NIFTY_PROXY',
        open: avg,
        high: avg,
        low: avg,
        close: avg,
        volume: 0,
        delivery_qty: 0,
        delivery_pct: 0,
        trades: 0,
      });
    }
  }
  return synthetic.length >= 20 ? synthetic : null;
}

export function getStore() {
  return store;
}

export function getSymbolBars(symbol) {
  return store?.symbolBars?.get(symbol?.toUpperCase()) || null;
}

export function getNiftyBars() {
  return store?.niftyBars || null;
}

function isTradeableEquity(symbol, bars, { eqOnly = true } = {}) {
  if (!eqOnly) return true;
  if (/^\d/.test(symbol)) return false;
  if (/ETF/i.test(symbol)) return false;
  if (/(?:^|-)(?:GS|TB|MF|BE|BZ)$/i.test(symbol)) return false;

  const series = bars.at(-1)?.series;
  if (series && series !== 'EQ') return false;
  return true;
}

export function listSymbols({ minDays = 50, nseOnly = true, eqOnly = true } = {}) {
  if (!store) return [];
  return [...store.symbolBars.entries()]
    .filter(([, bars]) => bars.length >= minDays)
    .filter(([symbol, bars]) => isTradeableEquity(symbol, bars, { eqOnly }))
    .map(([symbol, bars]) => ({ symbol, days: bars.length, lastClose: bars.at(-1)?.close }))
    .filter((s) => !nseOnly || !s.symbol.endsWith('_BSE'))
    .sort((a, b) => a.symbol.localeCompare(b.symbol));
}

export function barsToSeries(bars) {
  return {
    dates: bars.map((b) => b.date),
    opens: bars.map((b) => b.open),
    highs: bars.map((b) => b.high),
    lows: bars.map((b) => b.low),
    closes: bars.map((b) => b.close),
    volumes: bars.map((b) => b.volume),
    deliveryPcts: bars.map((b) => b.delivery_pct),
    deliveryQtys: bars.map((b) => b.delivery_qty),
    trades: bars.map((b) => b.trades),
  };
}

export function clearBhavStore() {
  store = null;
}
