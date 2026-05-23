import { getNseClient, getBseClient } from './exchangeClients.js';
import { findStock } from './universe.js';
import { getSymbolHistory } from './screenerStorage.js';

export async function fetchStockDetails(symbol, queryIdValue = null) {
  const sym = symbol.toUpperCase();
  const stock = await findStock(sym);
  if (!stock) {
    throw new Error(`Symbol ${sym} not found in screener universe`);
  }

  const nse = getNseClient();
  const bse = getBseClient();

  const details = {
    symbol: sym,
    name: stock.name,
    exchanges: stock.exchanges || [stock.exchange],
    marketCap: stock.marketCap ?? null,
    faceValue: stock.faceValue ?? null,
    isin: stock.isin ?? null,
    industry: stock.industry ?? null,
    group: stock.group ?? null,
    bseScripCode: stock.bseScripCode ?? null,
    url: stock.url ?? null,
    quote: null,
    corporateActions: [],
    announcements: [],
    boardMeetings: [],
    scanHistory: [],
    fyersQuote: null,
  };

  if (stock.bseScripCode) {
    try {
      const q = await bse.quote(String(stock.bseScripCode));
      details.quote = {
        ltp: q.LTP ?? null,
        open: q.Open ?? null,
        high: q.High ?? null,
        low: q.Low ?? null,
        prevClose: q.PrevClose ?? null,
      };
    } catch {
      /* optional */
    }
  }

  if (stock.exchanges?.includes('NSE')) {
    try {
      details.corporateActions = await nse.corporate.getActions({
        symbol: sym,
        index: 'equities',
      });
    } catch {
      details.corporateActions = [];
    }

    try {
      details.announcements = await nse.corporate.getAnnouncements({
        symbol: sym,
        index: 'equities',
      });
    } catch {
      details.announcements = [];
    }

    try {
      details.boardMeetings = await nse.corporate.getBoardMeetings({
        symbol: sym,
        index: 'equities',
      });
    } catch {
      details.boardMeetings = [];
    }
  }

  try {
    const { isLoggedIn } = await import('../fyers/client.js');
    if (isLoggedIn()) {
      const { fetchQuotes } = await import('../fyers/quotes.js');
      const prefix = stock.exchanges?.includes('NSE') ? 'NSE' : 'BSE';
      const quotes = await fetchQuotes([`${prefix}:${sym}-EQ`]);
      details.fyersQuote = quotes?.[0] ?? null;
    }
  } catch {
    details.fyersQuote = null;
  }

  details.scanHistory = queryIdValue
    ? await getSymbolHistory(sym, queryIdValue)
    : [];
  return details;
}
