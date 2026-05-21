import { fetchNseAnchor, fetchNseStraddleAtStrike } from './nseFetcher.js';
import {
  fetchSensexAnchor,
  fetchSensexStraddleAtStrike,
} from './bseFetcher.js';
import { isLoggedIn } from './kotak/client.js';
import { fetchKotakAnchor, fetchStraddleQuote } from './kotak/quotes.js';

const NSE_INDICES = new Set([
  'NIFTY',
  'BANKNIFTY',
  'FINNIFTY',
  'MIDCPNIFTY',
  'NIFTYNXT50',
]);

function route(symbol) {
  const sym = symbol.toUpperCase();
  if (sym === 'SENSEX') return 'BSE';
  if (NSE_INDICES.has(sym)) return 'NSE';
  return 'NSE';
}

async function fetchSensexViaKotak(strike) {
  if (!isLoggedIn()) {
    throw new Error(
      'SENSEX needs Kotak login (TOTP + MPIN). The BSE option chain API is blocked from this server.'
    );
  }
  if (strike != null) {
    const q = await fetchStraddleQuote('SENSEX', strike);
    return {
      symbol: 'SENSEX',
      spot: q.spot,
      strike: q.strike,
      cePremium: q.cePremium,
      pePremium: q.pePremium,
      straddlePremium: q.straddlePremium,
      source: 'kotak',
      fetchedAt: q.fetchedAt,
    };
  }
  return fetchKotakAnchor('SENSEX');
}

/** 9:15 — spot + strike (ATM from that spot) + straddle at that strike */
export async function fetchAnchor(symbol) {
  const sym = symbol.toUpperCase();
  if (sym === 'SENSEX') {
    try {
      return await fetchSensexViaKotak();
    } catch (err) {
      if (isLoggedIn()) throw err;
    }
    return fetchSensexAnchor();
  }
  return fetchNseAnchor(sym);
}

/** Every minute after anchor — straddle premium at the fixed 9:15 strike */
export async function fetchStraddleAtStrike(symbol, strike) {
  const sym = symbol.toUpperCase();
  if (sym === 'SENSEX') {
    try {
      return await fetchSensexViaKotak(strike);
    } catch (err) {
      if (isLoggedIn()) throw err;
    }
    return fetchSensexStraddleAtStrike(strike);
  }
  return fetchNseStraddleAtStrike(sym, strike);
}
