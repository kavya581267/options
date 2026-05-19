import axios from 'axios';
import { authHeaders, getSession, isLoggedIn } from './client.js';
import { resolveStraddleLegs } from './scripMaster.js';

const DEFAULT_BASE = 'https://cis.kotaksecurities.com';

const INDEX_QUOTE = {
  NIFTY: { exchangeSegment: 'nse_cm', instrumentToken: 'Nifty 50' },
  SENSEX: { exchangeSegment: 'bse_cm', instrumentToken: 'SENSEX' },
};

function quotesBaseUrl() {
  const session = getSession();
  return (session?.baseUrl || DEFAULT_BASE).replace(/\/$/, '');
}

function neoSymbolParam(tokens) {
  const raw = tokens
    .map((t) => `${t.exchangeSegment}|${t.instrumentToken}`)
    .join(',');
  return encodeURIComponent(raw);
}

function parseLtp(item) {
  if (item == null) return null;
  if (typeof item === 'number') return item;
  const candidates = [
    item.ltp,
    item.LTP,
    item.last_traded_price,
    item.LastTradedPrice,
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
    return Object.values(data.data);
  }
  return [data];
}

/**
 * @param {{ exchangeSegment: string, instrumentToken: string }[]} tokens
 * @param {string} [quoteType] ltp | all | ohlc | oi
 */
export async function fetchQuotes(tokens, quoteType = 'ltp') {
  if (!tokens?.length) throw new Error('No instruments for quotes');
  if (!isLoggedIn()) {
    throw new Error('Kotak login required for live quotes (scrip master)');
  }

  const url = `${quotesBaseUrl()}/script-details/1.0/quotes/neosymbol/${neoSymbolParam(tokens)}/${quoteType}`;
  const { data } = await axios.get(url, { headers: authHeaders() });
  const items = normalizeQuoteItems(data);

  return tokens.map((token, i) => {
    const item = items[i] ?? items.find((q) => {
      const seg = q.exchange_segment || q.es || q.pExchSeg;
      const sym = q.instrument_token || q.token || q.pSymbol;
      return seg === token.exchangeSegment && sym === token.instrumentToken;
    });
    return {
      ...token,
      ltp: parseLtp(item),
      raw: item,
    };
  });
}

/** Live straddle premium for NIFTY / SENSEX at strike via Kotak quotes */
export async function fetchStraddleQuote(symbol, strike) {
  const sym = symbol.toUpperCase();
  const strikeNum = Number(strike);
  if (!strikeNum || Number.isNaN(strikeNum)) {
    throw new Error('Valid strike required');
  }

  const legs = await resolveStraddleLegs(sym, strikeNum);
  const optionTokens = [
    {
      exchangeSegment: legs.exchangeSegment,
      instrumentToken: legs.ce.scripToken,
      leg: 'CE',
      tradingSymbol: legs.ce.tradingSymbol,
    },
    {
      exchangeSegment: legs.exchangeSegment,
      instrumentToken: legs.pe.scripToken,
      leg: 'PE',
      tradingSymbol: legs.pe.tradingSymbol,
    },
  ];

  const indexToken = INDEX_QUOTE[sym];
  const allTokens = indexToken
    ? [
        { exchangeSegment: indexToken.exchangeSegment, instrumentToken: indexToken.instrumentToken, leg: 'INDEX' },
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
    throw new Error(
      `Could not parse Kotak LTP for ${sym} ${strikeNum} (CE=${cePremium}, PE=${pePremium})`
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
