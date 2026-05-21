import { config } from '../config.js';
import { fetchAnchor } from '../fetcher.js';
import { isLoggedIn, loadSession } from '../kotak/client.js';
import { fetchKotakAnchor } from '../kotak/quotes.js';
import { getISTDateString, formatISTTime } from '../marketHours.js';
import { setAnchor, appendReading } from '../storage.js';
import { enterStraddle } from './straddleExecutor.js';
import {
  getSchedule,
  markScheduleExecuted,
  markScheduleFailed,
} from './scheduleStorage.js';
import { readTrade } from './tradeStorage.js';

async function captureAnchor(symbol) {
  const sym = symbol.toUpperCase();

  if (isLoggedIn()) {
    try {
      return await fetchKotakAnchor(sym);
    } catch (err) {
      if (sym === 'SENSEX') {
        throw new Error(
          `SENSEX via Kotak failed: ${err.message}. Stay logged in on the Kotak page — the BSE website API is blocked and cannot be used as a fallback.`
        );
      }
      console.warn(`[schedule] Kotak anchor failed, trying NSE:`, err.message);
    }
  }

  if (sym === 'SENSEX') {
    throw new Error(
      'SENSEX needs Kotak login (TOTP + MPIN). The BSE option chain API is blocked from this server.'
    );
  }

  return fetchAnchor(sym);
}

/**
 * At user's entry time: spot → ATM strike → straddle premium, then optional Kotak entry.
 */
export async function runScheduledEntry({ force = false } = {}) {
  await loadSession();
  const sched = getSchedule();
  const today = getISTDateString();

  if (!sched.enabled && !force) {
    return { skipped: true, reason: 'Schedule disabled' };
  }
  if (!force && sched.lastExecutedDate === today) {
    return { skipped: true, reason: 'Already executed today' };
  }

  const symbol = (sched.symbol || config.trading.symbol).toUpperCase();
  const existing = await readTrade(symbol);
  if (existing?.status === 'open') {
    return { skipped: true, reason: 'Trade already open' };
  }

  console.log(`[schedule] ${formatISTTime()} — capturing ${symbol} spot + strike`);

  let anchorData;
  try {
    anchorData = await captureAnchor(symbol);
  } catch (err) {
    await markScheduleFailed(today, err.message);
    throw err;
  }

  const snapshot = {
    date: today,
    time: formatISTTime(),
    symbol,
    spot: anchorData.spot,
    strike: anchorData.strike,
    cePremium: anchorData.cePremium,
    pePremium: anchorData.pePremium,
    straddlePremium: anchorData.straddlePremium,
    quoteSource: anchorData.source || 'NSE/BSE',
  };

  if (sched.saveToTracker) {
    await setAnchor(symbol, {
      time: snapshot.time,
      spot: snapshot.spot,
      strike: snapshot.strike,
      cePremium: snapshot.cePremium,
      pePremium: snapshot.pePremium,
      straddlePremium: snapshot.straddlePremium,
    });
    await appendReading(symbol, {
      spot: snapshot.spot,
      strike: snapshot.strike,
      cePremium: snapshot.cePremium,
      pePremium: snapshot.pePremium,
      straddlePremium: snapshot.straddlePremium,
    });
    console.log(
      `[schedule] Tracker anchor set — spot ${snapshot.spot}, strike ${snapshot.strike}`
    );
  }

  let enterResult = null;
  if (sched.autoEnter) {
    if (!isLoggedIn()) {
      enterResult = { skipped: true, reason: 'Kotak not logged in for auto-enter' };
    } else {
      try {
        enterResult = await enterStraddle({
          symbol,
          strike: snapshot.strike,
          entryPremium: snapshot.straddlePremium,
        });
        console.log(`[schedule] Auto-enter:`, JSON.stringify(enterResult));
      } catch (err) {
        const msg = err.response?.data?.message || err.message;
        enterResult = { success: false, error: msg };
        console.error(`[schedule] Auto-enter failed:`, msg);
      }
    }
  }

  await markScheduleExecuted(snapshot, enterResult);

  return {
    success: true,
    snapshot,
    enterResult,
  };
}
