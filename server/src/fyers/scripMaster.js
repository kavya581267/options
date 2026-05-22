import { fyersGet } from './client.js';
import { atmStrikeFromSpot, optionChainSymbol } from './symbols.js';

function parseExpiryTs(exp) {
  if (!exp) return 0;
  if (typeof exp === 'number') return exp > 1e12 ? exp : exp * 1000;
  const d = new Date(exp);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

function normalizeChainRows(data) {
  const chain = data?.optionsChain || data?.optionChain || data?.data || [];
  if (!Array.isArray(chain)) return [];
  return chain;
}

function pickNearestExpiry(chainRows) {
  const now = Date.now();
  const expiries = new Map();
  for (const row of chainRows) {
    const exp = parseExpiryTs(row.expiry || row.expiry_time || row.expiryTime);
    if (exp >= now - 86400000) {
      if (!expiries.has(exp)) expiries.set(exp, []);
      expiries.get(exp).push(row);
    }
  }
  if (!expiries.size) return chainRows;
  const nearest = [...expiries.keys()].sort((a, b) => a - b)[0];
  return expiries.get(nearest);
}

function strikeFromRow(row) {
  const s = row.strike ?? row.strike_price ?? row.strikePrice;
  return Number(s);
}

function symbolFromLeg(row, type) {
  if (type === 'CE') {
    return (
      row.call_symbol ||
      row.callSymbol ||
      row.ce_symbol ||
      row.CE_symbol ||
      row.ceSymbol
    );
  }
  return (
    row.put_symbol ||
    row.putSymbol ||
    row.pe_symbol ||
    row.PE_symbol ||
    row.peSymbol
  );
}

export async function fetchOptionChain(symbol) {
  const sym = symbol.toUpperCase();
  const res = await fyersGet('/option-chain', {
    symbol: optionChainSymbol(sym),
    timestamp: '',
  });
  const rows = normalizeChainRows(res.data ?? res);
  return pickNearestExpiry(rows);
}

export async function findListedAtmStrike(symbol, spot) {
  const rows = await fetchOptionChain(symbol);
  const spotNum = Number(spot);
  const strikes = new Set();
  for (const row of rows) {
    const strike = strikeFromRow(row);
    if (strike > 0) strikes.add(strike);
  }
  const list = [...strikes].sort((a, b) => a - b);
  if (!list.length) {
    return atmStrikeFromSpot(spotNum, symbol);
  }
  let best = list[0];
  let bestDiff = Math.abs(best - spotNum);
  for (const s of list) {
    const d = Math.abs(s - spotNum);
    if (d < bestDiff) {
      bestDiff = d;
      best = s;
    }
  }
  return best;
}

export async function resolveStraddleLegs(symbol, strike) {
  const sym = symbol.toUpperCase();
  const strikeNum = Number(strike);
  const rows = await fetchOptionChain(sym);

  let ceRow = null;
  let peRow = null;
  for (const row of rows) {
    if (Math.abs(strikeFromRow(row) - strikeNum) >= 0.01) continue;
    if (!ceRow && symbolFromLeg(row, 'CE')) ceRow = row;
    if (!peRow && symbolFromLeg(row, 'PE')) peRow = row;
  }

  if (!ceRow || !peRow) {
    throw new Error(
      `Could not resolve CE/PE for ${sym} strike ${strikeNum} on nearest Fyers expiry`
    );
  }

  const ceSym = symbolFromLeg(ceRow, 'CE');
  const peSym = symbolFromLeg(peRow, 'PE');
  const lotSize = Number(
    ceRow.lot_size || ceRow.lotSize || peRow.lot_size || peRow.lotSize || 1
  );

  return {
    exchangeSegment: sym === 'SENSEX' ? 'BSE' : 'NSE',
    lotSize,
    ce: {
      tradingSymbol: ceSym,
      fyersSymbol: ceSym,
      scripToken: ceSym,
      row: ceRow,
    },
    pe: {
      tradingSymbol: peSym,
      fyersSymbol: peSym,
      scripToken: peSym,
      row: peRow,
    },
  };
}
