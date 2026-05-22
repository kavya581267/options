import { config } from '../config.js';
import { fetchAnchor } from '../fetcher.js';
import { isLoggedIn, loadSession } from '../fyers/client.js';
import { fetchFyersAnchor } from '../fyers/quotes.js';
import { getISTDateString, formatISTTime } from '../marketHours.js';
import { setAnchor, appendReading } from '../storage.js';
import { enterStraddle } from './fyersStraddleExecutor.js';
import {
  getSchedule,
  markScheduleExecuted,
  markScheduleFailed,
} from './fyersScheduleStorage.js';
import { readTrade } from './fyersTradeStorage.js';

async function captureAnchor(symbol) {
  const sym = symbol.toUpperCase();

  if (isLoggedIn()) {
    try {
      return await fetchFyersAnchor(sym);
    } catch (err) {
      if (sym === 'SENSEX') {
        throw new Error(
          `SENSEX via Fyers failed: ${err.message}. Stay logged in on the Fyers page.`
        );
      }
      console.warn(`[fyers-schedule] Fyers anchor failed, trying NSE/BSE:`, err.message);
    }
  }

  if (sym === 'SENSEX') {
    throw new Error(
      'SENSEX needs Fyers login. The BSE website API is blocked from this server.'
    );
  }

  return fetchAnchor(sym);
}

export async function runFyersScheduledEntry({ force = false } = {}) {
  await loadSession();
  const sched = getSchedule();
  const today = getISTDateString();

  if (!sched.enabled && !force) {
    return { skipped: true, reason: 'Schedule disabled' };
  }
  if (!force && sched.lastExecutedDate === today) {
    return { skipped: true, reason: 'Already executed today' };
  }

  const symbol = (sched.symbol || config.fyersTrading.symbol).toUpperCase();
  const existing = await readTrade(symbol);
  if (existing?.status === 'open') {
    return { skipped: true, reason: 'Trade already open' };
  }

  console.log(`[fyers-schedule] ${formatISTTime()} — capturing ${symbol} spot + strike`);

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
    quoteSource: anchorData.source || 'fyers',
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
      `[fyers-schedule] Tracker anchor set — spot ${snapshot.spot}, strike ${snapshot.strike}`
    );
  }

  let enterResult = null;
  if (sched.autoEnter) {
    if (!isLoggedIn()) {
      enterResult = { skipped: true, reason: 'Fyers not logged in for auto-enter' };
    } else {
      try {
        enterResult = await enterStraddle({
          symbol,
          strike: snapshot.strike,
          entryPremium: snapshot.straddlePremium,
        });
        console.log(`[fyers-schedule] Auto-enter:`, JSON.stringify(enterResult));
      } catch (err) {
        const msg = err.response?.data?.message || err.message;
        enterResult = { success: false, error: msg };
        console.error(`[fyers-schedule] Auto-enter failed:`, msg);
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
