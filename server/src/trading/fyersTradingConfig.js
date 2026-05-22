import fs from 'fs/promises';
import path from 'path';
import { config } from '../config.js';

function configPath() {
  return path.join(config.dataDir, 'fyers-trading-config.json');
}

const SIDES = new Set(['SELL', 'BUY']);
const PRODUCTS = new Set(['MIS', 'NRML', 'CNC']);
const LEVEL_TYPES = new Set(['percent', 'fixed']);
const SYMBOLS = new Set(['NIFTY', 'SENSEX']);

export function normalizeTrading(input = {}) {
  const t = config.fyersTrading;
  const side = String(input.side || t.side).toUpperCase();
  const product = String(input.product || t.product).toUpperCase();
  const symbol = String(input.symbol || t.symbol).toUpperCase();
  const slType = String(input.slType || t.slType).toLowerCase();
  const targetType = String(input.targetType || t.targetType).toLowerCase();

  if (!SIDES.has(side)) throw new Error('side must be SELL or BUY');
  if (!PRODUCTS.has(product)) throw new Error('product must be MIS, NRML, or CNC');
  if (!SYMBOLS.has(symbol)) throw new Error('symbol must be NIFTY or SENSEX');
  if (!LEVEL_TYPES.has(slType)) throw new Error('slType must be percent or fixed');
  if (!LEVEL_TYPES.has(targetType)) {
    throw new Error('targetType must be percent or fixed');
  }

  const lots = Math.max(1, parseInt(input.lots ?? t.lots, 10));
  const slValue = Math.max(0, parseFloat(input.slValue ?? t.slValue));
  const targetValue = Math.max(0, parseFloat(input.targetValue ?? t.targetValue));

  if (Number.isNaN(slValue) || Number.isNaN(targetValue)) {
    throw new Error('slValue and targetValue must be numbers');
  }

  return {
    symbol,
    side,
    lots,
    product,
    useBracketOrder: false,
    slType,
    slValue,
    targetType,
    targetValue,
  };
}

export async function loadFyersTradingConfig() {
  try {
    const raw = await fs.readFile(configPath(), 'utf-8');
    const saved = normalizeTrading(JSON.parse(raw));
    Object.assign(config.fyersTrading, saved);
    return saved;
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn('[fyers-trading] could not load saved config:', err.message);
    }
    return config.fyersTrading;
  }
}

export async function updateFyersTradingConfig(updates) {
  const next = normalizeTrading({ ...config.fyersTrading, ...updates });
  Object.assign(config.fyersTrading, next);
  await fs.mkdir(config.dataDir, { recursive: true });
  await fs.writeFile(configPath(), JSON.stringify(next, null, 2), 'utf-8');
  return next;
}

export async function hasSavedFyersConfigFile() {
  try {
    await fs.access(configPath());
    return true;
  } catch {
    return false;
  }
}
