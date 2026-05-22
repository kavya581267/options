import fs from 'fs/promises';
import path from 'path';
import { config } from '../config.js';
import { getISTDateString } from '../marketHours.js';

function tradesDir() {
  return path.join(config.dataDir, 'trades', 'fyers');
}

function tradePath(symbol, dateStr = getISTDateString()) {
  return path.join(tradesDir(), `${dateStr}-${symbol.toUpperCase()}.json`);
}

export async function readTrade(symbol) {
  try {
    const raw = await fs.readFile(tradePath(symbol), 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

export async function writeTrade(symbol, trade) {
  await fs.mkdir(tradesDir(), { recursive: true });
  await fs.writeFile(tradePath(symbol), JSON.stringify(trade, null, 2), 'utf-8');
}

export async function clearTrade(symbol) {
  try {
    await fs.unlink(tradePath(symbol));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}

const TRACKED_SYMBOLS = ['NIFTY', 'SENSEX'];

export async function listOpenTrades() {
  const open = [];
  for (const symbol of TRACKED_SYMBOLS) {
    const trade = await readTrade(symbol);
    if (trade?.status === 'open') {
      open.push({ symbol, trade });
    }
  }
  return open;
}
