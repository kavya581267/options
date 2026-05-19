import fs from 'fs/promises';
import path from 'path';
import { config } from '../config.js';

function configPath() {
  return path.join(config.dataDir, 'kotak-trading-config.json');
}

const SIDES = new Set(['SELL', 'BUY']);
const PRODUCTS = new Set(['MIS', 'NRML', 'BO']);
const LEVEL_TYPES = new Set(['percent', 'fixed']);
const SYMBOLS = new Set(['NIFTY', 'SENSEX']);

export function normalizeTrading(input = {}) {
  const side = String(input.side || config.trading.side).toUpperCase();
  const product = String(input.product || config.trading.product).toUpperCase();
  const symbol = String(input.symbol || config.trading.symbol).toUpperCase();
  const slType = String(input.slType || config.trading.slType).toLowerCase();
  const targetType = String(
    input.targetType || config.trading.targetType
  ).toLowerCase();

  if (!SIDES.has(side)) throw new Error('side must be SELL or BUY');
  if (!PRODUCTS.has(product)) throw new Error('product must be MIS, NRML, or BO');
  if (!SYMBOLS.has(symbol)) throw new Error('symbol must be NIFTY or SENSEX');
  if (!LEVEL_TYPES.has(slType)) throw new Error('slType must be percent or fixed');
  if (!LEVEL_TYPES.has(targetType)) {
    throw new Error('targetType must be percent or fixed');
  }

  const lots = Math.max(1, parseInt(input.lots ?? config.trading.lots, 10));
  const slValue = Math.max(0, parseFloat(input.slValue ?? config.trading.slValue));
  const targetValue = Math.max(
    0,
    parseFloat(input.targetValue ?? config.trading.targetValue)
  );

  if (Number.isNaN(slValue) || Number.isNaN(targetValue)) {
    throw new Error('slValue and targetValue must be numbers');
  }

  return {
    symbol,
    side,
    lots,
    product,
    useBracketOrder: Boolean(
      input.useBracketOrder ?? config.trading.useBracketOrder
    ),
    slType,
    slValue,
    targetType,
    targetValue,
  };
}

export async function loadTradingConfig() {
  try {
    const raw = await fs.readFile(configPath(), 'utf-8');
    const saved = normalizeTrading(JSON.parse(raw));
    Object.assign(config.trading, saved);
    return saved;
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn('[trading] could not load saved config:', err.message);
    }
    return config.trading;
  }
}

export async function updateTradingConfig(updates) {
  const next = normalizeTrading({ ...config.trading, ...updates });
  Object.assign(config.trading, next);
  await fs.mkdir(config.dataDir, { recursive: true });
  await fs.writeFile(configPath(), JSON.stringify(next, null, 2), 'utf-8');
  return next;
}

export async function hasSavedConfigFile() {
  try {
    await fs.access(configPath());
    return true;
  } catch {
    return false;
  }
}
