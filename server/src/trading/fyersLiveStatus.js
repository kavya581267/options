import { fetchStraddleQuote } from '../fyers/quotes.js';
import { computeLiveMetrics } from './liveStatus.js';

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
