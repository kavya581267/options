import { fetchNseAnchor, fetchNseStraddleAtStrike } from './nseFetcher.js';
import {
  fetchSensexAnchor,
  fetchSensexStraddleAtStrike,
} from './bseFetcher.js';

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

/** 9:15 — spot + strike (ATM from that spot) + straddle at that strike */
export async function fetchAnchor(symbol) {
  const sym = symbol.toUpperCase();
  if (route(sym) === 'BSE') return fetchSensexAnchor();
  return fetchNseAnchor(sym);
}

/** Every minute after anchor — straddle premium at the fixed 9:15 strike */
export async function fetchStraddleAtStrike(symbol, strike) {
  const sym = symbol.toUpperCase();
  if (route(sym) === 'BSE') return fetchSensexStraddleAtStrike(strike);
  return fetchNseStraddleAtStrike(sym, strike);
}
