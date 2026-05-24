import fs from 'fs/promises';
import path from 'path';
import { config } from '../config.js';
import { getISTDateString } from '../marketHours.js';

const QUERY_ID = 'breakout_swing_v1';

function resultsDir() {
  return path.join(config.dataDir, 'screener', 'breakout');
}

function filePath(dateStr) {
  return path.join(resultsDir(), `${dateStr}.json`);
}

export function breakoutQueryId() {
  return QUERY_ID;
}

export async function saveBreakoutResult(result) {
  await fs.mkdir(resultsDir(), { recursive: true });
  await fs.writeFile(filePath(result.date), JSON.stringify(result, null, 2), 'utf-8');
  return result;
}

export async function readBreakoutResult(dateStr) {
  try {
    const raw = await fs.readFile(filePath(dateStr), 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

export async function listBreakoutDates() {
  try {
    const files = await fs.readdir(resultsDir());
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

export function todayDateStr() {
  return getISTDateString();
}

export const OUTPUT_COLUMNS = [
  { key: 'symbol', label: 'Symbol' },
  { key: 'sector', label: 'Sector' },
  { key: 'close', label: 'Close', numeric: true },
  { key: 'market_cap_cr', label: 'Mkt Cap (Cr)', numeric: true },
  { key: 'ema50', label: 'EMA 50', numeric: true },
  { key: 'ema200', label: 'EMA 200', numeric: true },
  { key: 'rsi14', label: 'RSI 14', numeric: true },
  { key: 'volume', label: 'Volume', numeric: true },
  { key: 'avg_volume_20', label: 'Avg Vol 20d', numeric: true },
  { key: 'delivery_pct', label: 'Delivery %', numeric: true },
  { key: 'relative_strength', label: 'Rel Strength', numeric: true },
  { key: 'base_score', label: 'Base Score', numeric: true },
  { key: 'atr14', label: 'ATR 14', numeric: true },
  { key: 'breakout_flag', label: 'Breakout' },
  { key: 'final_score', label: 'Score', numeric: true },
  { key: 'rank_percentile', label: 'Rank %ile', numeric: true },
  { key: 'breakout_age', label: 'Breakout Age', numeric: true },
  { key: 'distance_from_breakout_pct', label: 'Dist from BO %', numeric: true },
  { key: 'stop_loss', label: 'Stop (2×ATR)', numeric: true },
  { key: 'target', label: 'Target (3×ATR)', numeric: true },
  { key: 'risk_reward', label: 'R:R', numeric: true },
  { key: 'liquidity_score', label: 'Liquidity', numeric: true },
];
