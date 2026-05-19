import { config } from '../config.js';
import { fetchAnchor } from '../fetcher.js';
import { isLoggedIn } from '../kotak/client.js';
import { fetchStraddleQuote } from '../kotak/quotes.js';
import { getISTDateString, formatISTTime } from '../marketHours.js';
import { setAnchor, appendReading } from '../storage.js';
import { enterStraddle } from './straddleExecutor.js';
import { getSchedule, markScheduleExecuted } from './scheduleStorage.js';
import { readTrade } from './tradeStorage.js';

/**
 * At user's entry time: spot → ATM strike → straddle premium, then optional Kotak entry.
 */
export async function runScheduledEntry({ force = false } = {}) {
  const sched = getSchedule();
  const today = getISTDateString();

  if (!sched.enabled && !force) {
    return { skipped: true, reason: 'Schedule disabled' };
  }
  if (!force && sched.lastExecutedDate === today) {
    return { skipped: true, reason: 'Already executed today' };
  }

  const symbol = sched.symbol || config.trading.symbol;
  const existing = await readTrade(symbol);
  if (existing?.status === 'open') {
    return { skipped: true, reason: 'Trade already open' };
  }

  console.log(`[schedule] ${formatISTTime()} — capturing ${symbol} spot + strike`);

  const anchorData = await fetchAnchor(symbol);
  let premium = anchorData.straddlePremium;
  let quoteSource = anchorData.source || 'NSE/BSE';

  if (isLoggedIn()) {
    try {
      const kotak = await fetchStraddleQuote(symbol, anchorData.strike);
      premium = kotak.straddlePremium;
      quoteSource = 'kotak';
      anchorData.spot = kotak.spot ?? anchorData.spot;
      anchorData.cePremium = kotak.cePremium;
      anchorData.pePremium = kotak.pePremium;
    } catch (err) {
      console.warn(`[schedule] Kotak quote failed, using chain premium:`, err.message);
    }
  }

  const snapshot = {
    date: today,
    time: formatISTTime(),
    symbol,
    spot: anchorData.spot,
    strike: anchorData.strike,
    cePremium: anchorData.cePremium,
    pePremium: anchorData.pePremium,
    straddlePremium: premium,
    quoteSource,
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
      enterResult = await enterStraddle({
        symbol,
        strike: snapshot.strike,
        entryPremium: premium,
      });
      console.log(`[schedule] Auto-enter:`, JSON.stringify(enterResult));
    }
  }

  await markScheduleExecuted(snapshot, enterResult);

  return {
    success: true,
    snapshot,
    enterResult,
  };
}
