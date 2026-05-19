import { config } from './config.js';
import { fetchAnchor, fetchStraddleAtStrike } from './fetcher.js';
import {
  isWithinMarketHours,
  shouldCaptureAnchor,
  formatISTTime,
} from './marketHours.js';
import {
  appendReading,
  getAnchor,
  setAnchor,
} from './storage.js';

const MIN_GAP_MS = 55000;
const lastFetchBySymbol = new Map();

export async function collectSymbol(symbol) {
  const existingAnchor = await getAnchor(symbol);

  if (!existingAnchor) {
    if (!shouldCaptureAnchor()) {
      return {
        symbol,
        skipped: true,
        reason: 'Waiting for 9:15 anchor (spot + strike)',
      };
    }

    const anchorData = await fetchAnchor(symbol);
    const anchor = await setAnchor(symbol, anchorData);
    const entry = await appendReading(symbol, anchorData);

    console.log(
      `[collector] ${symbol} anchor @ ${formatISTTime()} — spot ${anchor.spot}, strike ${anchor.strike}`
    );

    return { symbol, success: true, anchor: true, entry, anchorMeta: anchor };
  }

  const data = await fetchStraddleAtStrike(symbol, existingAnchor.strike);
  const entry = await appendReading(symbol, data);

  return { symbol, success: true, anchor: false, entry };
}

export async function collectAll(symbols = config.symbols) {
  if (!isWithinMarketHours()) {
    return { skipped: true, reason: 'Outside market hours' };
  }

  const results = [];

  for (const symbol of symbols) {
    const last = lastFetchBySymbol.get(symbol) || 0;
    if (Date.now() - last < MIN_GAP_MS) {
      results.push({ symbol, skipped: true, reason: 'Rate limit guard' });
      continue;
    }

    try {
      const result = await collectSymbol(symbol);
      lastFetchBySymbol.set(symbol, Date.now());
      results.push(result);
      await new Promise((r) => setTimeout(r, 2000));
    } catch (err) {
      console.error(`[collector] ${symbol} failed:`, err.message);
      results.push({ symbol, success: false, error: err.message });
    }
  }

  return { skipped: false, results };
}
