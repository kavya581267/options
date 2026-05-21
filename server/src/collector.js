import { config } from './config.js';
import { fetchAnchor, fetchStraddleAtStrike } from './fetcher.js';
import { loadSession } from './kotak/client.js';
import {
  isWithinMarketHours,
  canCaptureAnchorNow,
  isBeforeMarketStart,
  formatISTTime,
} from './marketHours.js';
import {
  appendReading,
  getAnchor,
  setAnchor,
} from './storage.js';

const MIN_GAP_MS = 55000;
const lastFetchBySymbol = new Map();

export async function collectSymbol(symbol, { forceAnchor = false } = {}) {
  const existingAnchor = await getAnchor(symbol);

  if (!existingAnchor) {
    if (!forceAnchor && !canCaptureAnchorNow()) {
      const reason = isBeforeMarketStart()
        ? `Opens at ${config.marketStart} IST — anchor not set yet`
        : `Waiting for ${config.marketStart} anchor window (${config.marketStart}–9:20 IST)`;
      return { symbol, skipped: true, reason };
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

export async function collectAll(symbols = config.symbols, { forceAnchor = false } = {}) {
  await loadSession();

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
      const result = await collectSymbol(symbol, { forceAnchor });
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
