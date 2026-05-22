import { fyersGet } from './client.js';
import { findListedAtmStrike, resolveStraddleLegs } from './scripMaster.js';
import { atmStrikeFromSpot, indexSymbol } from './symbols.js';

function parseLtp(item) {
  if (item == null) return null;
  const n = parseFloat(item.ltp ?? item.lp ?? item.last_price);
  return !Number.isNaN(n) && n > 0 ? n : null;
}

export async function fetchQuotes(symbols) {
  const list = [...new Set(symbols.filter(Boolean))];
  if (!list.length) throw new Error('No symbols for quotes');
  const res = await fyersGet('/quotes', { symbols: list.join(',') });
  const map = {};
  const d = res.d || res.data || [];
  if (Array.isArray(d)) {
    for (const item of d) {
      const key = item.n || item.symbol || item.v;
      if (key) map[key] = item;
    }
  } else if (typeof d === 'object') {
    Object.assign(map, d);
  }
  return list.map((sym) => ({
    symbol: sym,
    ltp: parseLtp(map[sym]),
    raw: map[sym],
  }));
}

export async function fetchStraddleQuote(symbol, strike) {
  const sym = symbol.toUpperCase();
  const strikeNum = Number(strike);
  if (!strikeNum || Number.isNaN(strikeNum)) {
    throw new Error('Valid strike required');
  }

  const legs = await resolveStraddleLegs(sym, strikeNum);
  const indexSym = indexSymbol(sym);
  const quoted = await fetchQuotes([
    indexSym,
    legs.ce.fyersSymbol,
    legs.pe.fyersSymbol,
  ]);

  const indexQ = quoted.find((q) => q.symbol === indexSym);
  const ceQ = quoted.find((q) => q.symbol === legs.ce.fyersSymbol);
  const peQ = quoted.find((q) => q.symbol === legs.pe.fyersSymbol);

  const cePremium = ceQ?.ltp;
  const pePremium = peQ?.ltp;
  if (cePremium == null || pePremium == null) {
    throw new Error(
      `Could not parse Fyers LTP for ${sym} ${strikeNum} (CE=${cePremium}, PE=${pePremium})`
    );
  }

  return {
    symbol: sym,
    strike: strikeNum,
    source: 'fyers',
    spot: indexQ?.ltp ?? null,
    cePremium,
    pePremium,
    straddlePremium: cePremium + pePremium,
    ceSymbol: legs.ce.fyersSymbol,
    peSymbol: legs.pe.fyersSymbol,
    fetchedAt: new Date().toISOString(),
  };
}

export async function fetchFyersAnchor(symbol) {
  const sym = symbol.toUpperCase();
  const [indexQ] = await fetchQuotes([indexSymbol(sym)]);
  const spot = indexQ?.ltp;
  if (spot == null) {
    throw new Error(`Could not read ${sym} spot from Fyers`);
  }

  const strike = await findListedAtmStrike(sym, spot);
  const straddle = await fetchStraddleQuote(sym, strike);

  return {
    symbol: sym,
    spot: straddle.spot ?? spot,
    strike,
    cePremium: straddle.cePremium,
    pePremium: straddle.pePremium,
    straddlePremium: straddle.straddlePremium,
    source: 'fyers',
    fetchedAt: new Date().toISOString(),
  };
}
