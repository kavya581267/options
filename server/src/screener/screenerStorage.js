import fs from 'fs/promises';
import path from 'path';
import { config } from '../config.js';
import { getISTDateString } from '../marketHours.js';
import { queryId } from './query.js';

function queryDir(id) {
  return path.join(config.dataDir, 'screener', 'queries', id);
}

function filePath(id, dateStr) {
  return path.join(queryDir(id), `${dateStr}.json`);
}

export async function saveScanResult(result) {
  const id = result.queryId || queryId(result.query);
  const dir = queryDir(id);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath(id, result.date), JSON.stringify(result, null, 2), 'utf-8');
  return result;
}

export async function readScanResult(queryIdValue, dateStr) {
  try {
    const raw = await fs.readFile(filePath(queryIdValue, dateStr), 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

export async function listScanDates(queryIdValue) {
  const dir = queryDir(queryIdValue);
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

export async function listSavedQueries() {
  const root = path.join(config.dataDir, 'screener', 'queries');
  try {
    const dirs = await fs.readdir(root);
    const out = [];
    for (const id of dirs) {
      const dates = await listScanDates(id);
      if (!dates.length) continue;
      const latest = await readScanResult(id, dates[0]);
      out.push({
        queryId: id,
        label: latest?.queryLabel || id,
        lastDate: dates[0],
        lastMatched: latest?.matchedCount ?? null,
      });
    }
    return out.sort((a, b) => (b.lastDate || '').localeCompare(a.lastDate || ''));
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

export async function getSymbolHistory(symbol, queryIdValue) {
  const sym = symbol.toUpperCase();
  const dates = await listScanDates(queryIdValue);
  const history = [];

  for (const date of dates) {
    const day = await readScanResult(queryIdValue, date);
    const row = day?.stocks?.find((s) => s.symbol === sym);
    if (row) {
      history.push({
        date,
        close: row.close,
        indicators: row.indicators,
      });
    }
  }

  return history;
}

export function todayDateStr() {
  return getISTDateString();
}
