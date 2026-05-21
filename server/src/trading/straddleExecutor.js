import { config } from '../config.js';
import { isLoggedIn } from '../kotak/client.js';
import { resolveStraddleLegs } from '../kotak/scripMaster.js';
import { placeOrder, cancelOrder } from '../kotak/orders.js';
import { computeExitLevels, checkExit } from './slTarget.js';
import { readTrade, writeTrade, clearTrade } from './tradeStorage.js';
import { fetchStraddleAtStrike } from '../fetcher.js';
import { fetchStraddleQuote } from '../kotak/quotes.js';
import { getAnchor } from '../storage.js';

async function liveStraddlePremium(symbol, strike) {
  if (isLoggedIn()) {
    try {
      const q = await fetchStraddleQuote(symbol, strike);
      return q.straddlePremium;
    } catch (err) {
      console.warn(`[kotak] quotes failed for ${symbol}, using NSE/BSE:`, err.message);
    }
  }
  const live = await fetchStraddleAtStrike(symbol, strike);
  return live.straddlePremium;
}

function txnType(side, leg) {
  const sell = side === 'SELL';
  if (leg === 'entry') return sell ? 'S' : 'B';
  return sell ? 'B' : 'S';
}

function qty(lotSize, lots) {
  return String(Math.max(1, Number(lots) || 1) * Math.max(1, Number(lotSize) || 1));
}

export async function enterStraddle({ symbol, strike, entryPremium }) {
  if (!isLoggedIn()) {
    return { skipped: true, reason: 'Kotak not logged in' };
  }

  const sym = symbol.toUpperCase();
  const existing = await readTrade(sym);
  if (existing?.status === 'open') {
    return { skipped: true, reason: 'Trade already open' };
  }

  let resolvedStrike = strike;
  let premium = entryPremium;
  if (!resolvedStrike) {
    const anchor = await getAnchor(sym);
    if (!anchor?.strike) {
      throw new Error('Strike required (or set 9:15 anchor in tracker first)');
    }
    resolvedStrike = anchor.strike;
    premium = premium ?? anchor.straddlePremium;
  }

  const legs = await resolveStraddleLegs(sym, resolvedStrike);
  const side = config.trading.side;
  const useBo =
    config.trading.useBracketOrder && config.trading.product === 'BO';
  const entry =
    premium ?? (await liveStraddlePremium(sym, resolvedStrike));
  const levels = computeExitLevels(entry, side, config.trading);

  const exchSeg = (legs.ce.exchSeg || legs.pe.exchSeg || legs.exchangeSegment || '')
    .toLowerCase();

  const orderOpts = (leg, boExtra = {}) => ({
    exchangeSegment: exchSeg,
    product: useBo ? 'BO' : config.trading.product,
    orderType: 'MKT',
    quantity: qty(legs.lotSize, config.trading.lots),
    tradingSymbol: leg.tradingSymbol,
    transactionType: txnType(side, 'entry'),
    validity: 'DAY',
    price: '0',
    scripToken: leg.scripToken,
    ...boExtra,
  });

  const ceRes = await placeOrder(orderOpts(legs.ce));
  const peRes = await placeOrder(orderOpts(legs.pe));

  const trade = {
    status: 'open',
    symbol: sym,
    strike: resolvedStrike,
    side,
    entryPremium: entry,
    levels,
    legs,
    orders: { ce: ceRes?.nOrdNo, pe: peRes?.nOrdNo },
    enteredAt: new Date().toISOString(),
    mode: useBo ? 'bracket' : 'software',
  };
  await writeTrade(sym, trade);

  console.log(
    `[kotak] ${sym} straddle ${side} strike ${resolvedStrike}, premium ${entry}`
  );

  return { success: true, trade };
}

export async function exitStraddle(symbol, reason = 'manual') {
  const sym = symbol.toUpperCase();
  const trade = await readTrade(sym);
  if (!trade || trade.status !== 'open') {
    return { skipped: true, reason: 'No open trade' };
  }

  if (!isLoggedIn()) {
    throw new Error('Kotak not logged in');
  }

  for (const id of [trade.orders?.ce, trade.orders?.pe]) {
    if (id) {
      try {
        await cancelOrder(id);
      } catch {
        /* may already be filled */
      }
    }
  }

  const { ce, pe } = trade.legs;
  const side = trade.side;
  const exitSeg = (
    trade.legs.ce?.exchSeg ||
    trade.legs.pe?.exchSeg ||
    trade.legs.exchangeSegment ||
    ''
  ).toLowerCase();

  const ceRes = await placeOrder({
    exchangeSegment: exitSeg,
    product: config.trading.product === 'BO' ? 'MIS' : config.trading.product,
    orderType: 'MKT',
    quantity: qty(trade.legs.lotSize, config.trading.lots),
    tradingSymbol: ce.tradingSymbol,
    transactionType: txnType(side, 'exit'),
    validity: 'DAY',
    price: '0',
  });
  const peRes = await placeOrder({
    exchangeSegment: exitSeg,
    product: config.trading.product === 'BO' ? 'MIS' : config.trading.product,
    orderType: 'MKT',
    quantity: qty(trade.legs.lotSize, config.trading.lots),
    tradingSymbol: pe.tradingSymbol,
    transactionType: txnType(side, 'exit'),
    validity: 'DAY',
    price: '0',
  });

  trade.status = 'closed';
  trade.closedAt = new Date().toISOString();
  trade.exitReason = reason;
  trade.exitOrders = { ce: ceRes?.nOrdNo, pe: peRes?.nOrdNo };
  await writeTrade(sym, trade);

  return { success: true, trade };
}

export async function monitorOpenTrade(symbol, currentPremium) {
  const sym = symbol.toUpperCase();
  const trade = await readTrade(sym);
  if (!trade || trade.status !== 'open') {
    return { monitored: false, reason: 'No open trade' };
  }
  if (trade.mode === 'bracket') {
    return { monitored: true, mode: 'bracket', message: 'Kotak BO manages SL/target' };
  }

  let premium = currentPremium;
  if (premium == null) {
    premium = await liveStraddlePremium(sym, trade.strike);
  }

  const hit = checkExit(premium, trade.levels, trade.side);
  if (!hit) {
    return { monitored: true, currentPremium: premium, hit: null };
  }

  await exitStraddle(sym, hit);
  return { monitored: true, currentPremium: premium, hit, exited: true };
}
