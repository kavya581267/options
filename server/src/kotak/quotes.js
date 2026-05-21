import axios from 'axios';
import { authHeaders, getSession, isLoggedIn } from './client.js';
import { resolveStraddleLegs, findListedAtmStrike } from './scripMaster.js';

const DEFAULT_BASE = 'https://cis.kotaksecurities.com';

const INDEX_QUOTE = {
  NIFTY: { exchangeSegment: 'nse_cm', instrumentToken: 'Nifty 50' },
  SENSEX: { exchangeSegment: 'bse_cm', instrumentToken: 'SENSEX' },
};

export function atmStrikeFromSpot(spot, symbol) {
  const step = symbol.toUpperCase() === 'SENSEX' ? 100 : 50;
  return Math.round(Number(spot) / step) * step;
}

function quotesBaseUrl() {
  const session = getSession();
  return (session?.baseUrl || DEFAULT_BASE).replace(/\/$/, '');
}

function quoteHeaders() {
  const headers = authHeaders();
  if (isLoggedIn()) {
    const session = getSession();
    return { ...headers, Sid: session.tradeSid, Auth: session.tradeToken };
  }
  return headers;
}

function neoSymbolParam(tokens) {
  const raw = tokens
    .map((t) => `${t.exchangeSegment}|${t.instrumentToken}`)
    .join(',');
  return encodeURIComponent(raw);
}

function parseLtp(item) {
  if (item == null) return null;
  if (typeof item === 'number') return item > 0 ? item : null;
  if (typeof item === 'string') {
    const n = parseFloat(item);
    return !Number.isNaN(n) && n > 0 ? n : null;
  }
  const candidates = [
    item.ltp,
    item.LTP,
    item.last_traded_price,
    item.LastTradedPrice,
    item.lastPrice,
    item.iv,
    item.sp,
    item.fp,
  ];
  for (const v of candidates) {
    const n = parseFloat(v);
    if (!Number.isNaN(n) && n > 0) return n;
  }
  return null;
}

function normalizeQuoteItems(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(data.quotes)) return data.quotes;
  if (typeof data.data === 'object' && data.data !== null) {
    if (Array.isArray(data.data.quotes)) return data.data.quotes;
    const vals = Object.values(data.data);
    if (vals.length && vals.every((v) => v && typeof v === 'object')) return vals;
  }
  return [data];
}

function matchQuoteItem(items, token) {
  const seg = (token.exchangeSegment || '').toLowerCase();
  const sym = String(token.instrumentToken || '');
  const ts = String(token.tradingSymbol || '').toUpperCase();

  return items.find((q) => {
    if (!q || typeof q !== 'object') return false;
    const qSeg = (
      q.exchange_segment ||
      q.es ||
      q.pExchSeg ||
      q.exchange ||
      ''
    ).toLowerCase();
    const qSym = String(
      q.instrument_token ||
        q.token ||
        q.pSymbol ||
        q.exchange_token ||
        ''
    );
    const qTs = String(
      q.trading_symbol || q.ts || q.pTrdSymbol || q.display_symbol || ''
    ).toUpperCase();
    if (seg && qSeg && seg !== qSeg) return false;
    if (sym && qSym && sym === qSym) return true;
    if (ts && qTs && (qTs === ts || qTs.includes(ts) || ts.includes(qTs))) return true;
    return false;
  });
}

/**
 * @param {{ exchangeSegment: string, instrumentToken: string, tradingSymbol?: string }[]} tokens
 * @param {string} [quoteType] ltp | all | ohlc | oi
 */
export async function fetchQuotes(tokens, quoteType = 'ltp') {
  if (!tokens?.length) throw new Error('No instruments for quotes');
  if (!isLoggedIn()) {
    throw new Error('Kotak login required for live quotes (scrip master)');
  }

  const url = `${quotesBaseUrl()}/script-details/1.0/quotes/neosymbol/${neoSymbolParam(tokens)}/${quoteType}`;
  const { data } = await axios.get(url, { headers: quoteHeaders() });
  const items = normalizeQuoteItems(data);

  return tokens.map((token) => {
    const item = matchQuoteItem(items, token);
    return {
      ...token,
      ltp: parseLtp(item),
      raw: item,
    };
  });
}

/** Spot → ATM strike → straddle via Kotak (works for SENSEX when BSE chain fails). */
export async function fetchKotakAnchor(symbol) {
  const sym = symbol.toUpperCase();
  const indexToken = INDEX_QUOTE[sym];
  if (!indexToken) {
    throw new Error(`Kotak index quote not configured for ${sym}`);
  }

  const [indexQ] = await fetchQuotes(
    [
      {
        exchangeSegment: indexToken.exchangeSegment,
        instrumentToken: indexToken.instrumentToken,
        leg: 'INDEX',
      },
    ],
    'ltp'
  );
  const spot = indexQ?.ltp;
  if (spot == null) {
    throw new Error(`Could not read ${sym} spot from Kotak`);
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
    source: 'kotak',
    fetchedAt: new Date().toISOString(),
  };
}

/** Live straddle premium for NIFTY / SENSEX at strike via Kotak quotes */
export async function fetchStraddleQuote(symbol, strike) {
  const sym = symbol.toUpperCase();
  const strikeNum = Number(strike);
  if (!strikeNum || Number.isNaN(strikeNum)) {
    throw new Error('Valid strike required');
  }

  const legs = await resolveStraddleLegs(sym, strikeNum);
  const exchSeg = (legs.ce.exchSeg || legs.exchangeSegment || '').toLowerCase();

  const optionTokens = [
    {
      exchangeSegment: exchSeg,
      instrumentToken: legs.ce.scripToken,
      leg: 'CE',
      tradingSymbol: legs.ce.tradingSymbol,
    },
    {
      exchangeSegment: exchSeg,
      instrumentToken: legs.pe.scripToken,
      leg: 'PE',
      tradingSymbol: legs.pe.tradingSymbol,
    },
  ];

  const indexToken = INDEX_QUOTE[sym];
  const allTokens = indexToken
    ? [
        {
          exchangeSegment: indexToken.exchangeSegment,
          instrumentToken: indexToken.instrumentToken,
          leg: 'INDEX',
        },
        ...optionTokens,
      ]
    : optionTokens;

  const quoted = await fetchQuotes(allTokens, 'ltp');
  const indexQ = quoted.find((q) => q.leg === 'INDEX');
  const ceQ = quoted.find((q) => q.leg === 'CE');
  const peQ = quoted.find((q) => q.leg === 'PE');

  const cePremium = ceQ?.ltp;
  const pePremium = peQ?.ltp;
  if (cePremium == null || pePremium == null) {
    const ceDisp = ceQ?.raw?.display_symbol || legs.ce.tradingSymbol;
    const peDisp = peQ?.raw?.display_symbol || legs.pe.tradingSymbol;
    const ceLtp = ceQ?.raw?.ltp ?? 'n/a';
    const peLtp = peQ?.raw?.ltp ?? 'n/a';
    throw new Error(
      `Could not parse Kotak LTP for ${sym} ${strikeNum} (${ceDisp}=${ceLtp}, ${peDisp}=${peLtp}). ` +
        `Nearest weekly expiry is used — if LTP is 0, that contract may be illiquid.`
    );
  }

  return {
    symbol: sym,
    strike: strikeNum,
    source: 'kotak',
    spot: indexQ?.ltp ?? null,
    cePremium,
    pePremium,
    straddlePremium: cePremium + pePremium,
    ceSymbol: legs.ce.tradingSymbol,
    peSymbol: legs.pe.tradingSymbol,
    fetchedAt: new Date().toISOString(),
  };
}
