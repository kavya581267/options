import axios from 'axios';
import { authHeaders, getSession, isLoggedIn } from './client.js';

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const headers = lines[0]
    .split(',')
    .map((h) => h.trim().replace(/^"|"$/g, '').replace(/;+$/, ''));
  return lines.slice(1).map((line) => {
    const cols = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    const row = {};
    headers.forEach((h, i) => {
      row[h] = cols[i] ?? '';
    });
    return row;
  });
}

const SEGMENT = {
  NIFTY: 'nse_fo',
  SENSEX: 'bse_fo',
};

const INDEX_PREFIX = {
  NIFTY: 'NIFTY',
  SENSEX: 'SENSEX',
};

let cache = { at: 0, rows: [], segment: null };
const CACHE_MS = 6 * 60 * 60 * 1000;

async function fetchCsvRows(segment) {
  if (!isLoggedIn()) {
    throw new Error('Kotak login required for scrip master');
  }
  const session = getSession();
  const base = session.baseUrl || 'https://cis.kotaksecurities.com';
  const { data } = await axios.get(
    `${base}/script-details/1.0/masterscrip/file-paths`,
    { headers: authHeaders() }
  );

  const files = data?.data?.filesPaths || [];
  const url = files.find((f) => f.includes(`/${segment}.csv`));
  if (!url) throw new Error(`Scrip master CSV not found for ${segment}`);

  const csvRes = await axios.get(url, { responseType: 'text' });
  return parseCsv(csvRes.data);
}

async function getRows(segment) {
  if (Date.now() - cache.at < CACHE_MS && cache.segment === segment) {
    return cache.rows;
  }
  const rows = await fetchCsvRows(segment);
  cache = { at: Date.now(), segment, rows };
  return rows;
}

const EPOCH_1980_IST_SEC = Math.floor(
  new Date('1980-01-01T00:00:00+05:30').getTime() / 1000
);

function parseExpiryMs(row) {
  const raw = row.lExpiryDate || row.pExpiryDate;
  if (!raw) return 0;
  const n = Number(raw);
  if (!Number.isNaN(n) && n > 0) {
    if (n > 1e12) return n;
    if (n > 1e9) {
      const asUnixMs = n * 1000;
      if (new Date(asUnixMs).getUTCFullYear() >= 2024) return asUnixMs;
      return (EPOCH_1980_IST_SEC + n) * 1000;
    }
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

function rowOptionType(row) {
  return (row.pOptionType || row.pOptType || '').toUpperCase();
}

function tradingSymbol(row) {
  return (row.pTrdSymbol || row.pSymbolName || '').toUpperCase();
}

/** BSE SENSEX options may use SENSEX / BSX / SX prefixes in pTrdSymbol. */
function matchesIndexSymbol(sym, indexSym) {
  const s = sym.toUpperCase();
  if (indexSym === 'SENSEX') {
    return (
      s.includes('SENSEX') ||
      /^BSX\d/.test(s) ||
      /^SX\d/.test(s) ||
      s.includes('SENSEX50')
    );
  }
  return s.startsWith(INDEX_PREFIX[indexSym] || indexSym);
}

function isIndexOptionRow(row, indexSym) {
  const opt = rowOptionType(row);
  if (opt !== 'CE' && opt !== 'PE') return false;
  return matchesIndexSymbol(tradingSymbol(row), indexSym);
}

const MONTH_IN_SYMBOL =
  /(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)(\d{4,6})(?:CE|PE)$/i;

/** SENSEX2652175500CE / NIFTY2660923800CE — date digits before strike; take last 5 digits. */
function strikeFromNumericDatedSymbol(sym) {
  const m = sym.match(/(\d{5})(?:CE|PE)$/i);
  return m ? parseFloat(m[1]) : null;
}

function strikeFromSymbol(sym) {
  const s = sym.toUpperCase();
  const monthFmt = s.match(MONTH_IN_SYMBOL);
  if (monthFmt) return parseFloat(monthFmt[1]);
  const dated = strikeFromNumericDatedSymbol(s);
  if (dated) return dated;
  const m = s.match(/(\d{4,6})(?:\.0+)?(?:CE|PE)$/i);
  return m ? parseFloat(m[1]) : null;
}

function strikeFromRow(row, spotHint = null) {
  const raw = row.dStrikePrice ?? row['dStrikePrice;'] ?? row.pStrikePrice ?? '';
  const parsed = parseFloat(String(raw).replace(/,/g, ''));
  const fromField = normalizeStrikeValue(parsed, spotHint);
  if (fromField > 0) return fromField;
  return normalizeStrikeValue(strikeFromSymbol(tradingSymbol(row)), spotHint);
}

/** Kotak/BSE CSV may store strike as 74800 or 7480000 (×100). */
function normalizeStrikeValue(n, spotHint = null) {
  if (!n || Number.isNaN(n) || n <= 0) return 0;
  if (spotHint && n > spotHint * 50) return n / 100;
  if (n > 500000) return n / 100;
  return n;
}

function rowStrike(row, spotHint = null) {
  return strikeFromRow(row, spotHint);
}

/** Keep contracts that expire today or later (IST end-of-day grace). */
function isUnexpired(expMs, now = Date.now()) {
  if (!expMs || expMs <= 0) return true;
  return expMs >= now - 86400000;
}

function pickNearestExpiryRow(matches, now = Date.now()) {
  if (!matches.length) return null;
  const ranked = matches
    .map((row) => ({ row, exp: parseExpiryMs(row) }))
    .filter((x) => isUnexpired(x.exp, now))
    .sort((a, b) => {
      const aExp = a.exp > 0 ? a.exp : Number.MAX_SAFE_INTEGER;
      const bExp = b.exp > 0 ? b.exp : Number.MAX_SAFE_INTEGER;
      return aExp - bExp;
    });
  return ranked[0]?.row ?? matches[0];
}

function listListedStrikes(rows, indexSym, spotHint = null) {
  const strikes = new Set();
  for (const row of rows) {
    if (!isIndexOptionRow(row, indexSym)) continue;
    const strike = rowStrike(row, spotHint);
    if (strike > 0) strikes.add(strike);
  }
  return [...strikes].sort((a, b) => a - b);
}

/** Nearest exchange-listed strike to spot (from Kotak scrip master). */
export async function findListedAtmStrike(symbol, spot) {
  const sym = symbol.toUpperCase();
  const segment = SEGMENT[sym];
  if (!segment) throw new Error(`Unsupported symbol for Kotak: ${sym}`);

  const rows = await getRows(segment);
  const spotNum = Number(spot);
  const strikes = listListedStrikes(rows, sym, spotNum);
  if (!strikes.length) {
    throw new Error(
      `No ${sym} option strikes in Kotak scrip master — check segment ${segment}`
    );
  }

  let best = strikes[0];
  let bestDiff = Math.abs(best - spotNum);
  for (const s of strikes) {
    const diff = Math.abs(s - spotNum);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = s;
    }
  }
  return best;
}

function pickStrikeRow(rows, indexSym, strike, optionType) {
  const target = Number(strike);
  const matches = rows.filter((r) => {
    const opt = rowOptionType(r);
    if (opt !== optionType) return false;
    if (!matchesIndexSymbol(tradingSymbol(r), indexSym)) return false;
    return Math.abs(rowStrike(r, target) - target) < 0.01;
  });

  if (!matches.length) return null;
  return pickNearestExpiryRow(matches);
}

export async function resolveStraddleLegs(symbol, strike) {
  const sym = symbol.toUpperCase();
  const segment = SEGMENT[sym];
  const prefix = INDEX_PREFIX[sym];
  if (!segment) throw new Error(`Unsupported symbol for Kotak: ${sym}`);

  const rows = await getRows(segment);
  const strikeNum = Number(strike);

  let ce = pickStrikeRow(rows, sym, strikeNum, 'CE');
  let pe = pickStrikeRow(rows, sym, strikeNum, 'PE');

  if (!ce || !pe) {
    const listed = listListedStrikes(rows, sym, strikeNum);
    const nearby = listed
      .map((s) => ({ s, d: Math.abs(s - strikeNum) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 5)
      .map((x) => x.s);
    throw new Error(
      `Could not resolve CE/PE for ${sym} strike ${strikeNum}` +
        (nearby.length ? ` (listed nearby: ${nearby.join(', ')})` : '')
    );
  }

  const exchSeg = String(ce.pExchSeg || pe.pExchSeg || segment).toLowerCase();

  return {
    exchangeSegment: segment,
    lotSize: Number(ce.lLotSize || pe.lLotSize || 1),
    ce: {
      tradingSymbol: ce.pTrdSymbol,
      scripToken: String(ce.pSymbol),
      exchSeg,
      row: ce,
    },
    pe: {
      tradingSymbol: pe.pTrdSymbol,
      scripToken: String(pe.pSymbol),
      exchSeg,
      row: pe,
    },
  };
}
