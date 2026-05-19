import { fetchStraddleQuote } from '../kotak/quotes.js';

export function computeLiveMetrics(trade, currentPremium) {
  const entry = trade.entryPremium;
  const isShort = trade.side === 'SELL';
  const pnl = isShort ? entry - currentPremium : currentPremium - entry;
  const pnlPct = entry ? (pnl / entry) * 100 : 0;
  const { stopLoss, target } = trade.levels || {};

  let awayFromSl = null;
  let awayFromTarget = null;
  if (stopLoss != null && target != null) {
    if (isShort) {
      awayFromSl = stopLoss - currentPremium;
      awayFromTarget = currentPremium - target;
    } else {
      awayFromSl = currentPremium - stopLoss;
      awayFromTarget = target - currentPremium;
    }
  }

  return {
    currentPremium,
    entryPremium: entry,
    pnl,
    pnlPct,
    awayFromSl,
    awayFromTarget,
    stopLoss,
    target,
  };
}

export async function getOpenTradeLive(trade, symbol) {
  const quote = await fetchStraddleQuote(symbol, trade.strike);
  const metrics = computeLiveMetrics(trade, quote.straddlePremium);
  return {
    symbol,
    trade: {
      symbol: trade.symbol,
      strike: trade.strike,
      side: trade.side,
      entryPremium: trade.entryPremium,
      enteredAt: trade.enteredAt,
      mode: trade.mode,
      orders: trade.orders,
      levels: trade.levels,
    },
    quote,
    metrics,
    updatedAt: new Date().toISOString(),
  };
}
