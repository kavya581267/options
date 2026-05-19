import axios from 'axios';
import { authHeaders, getSession, isLoggedIn } from './client.js';

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
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

let cache = { at: 0, rows: [] };
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

function parseExpiryMs(row) {
  const raw = row.lExpiryDate || row.pExpiryDate;
  if (!raw) return 0;
  const n = Number(raw);
  if (!Number.isNaN(n) && n > 1e12) return n;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

function pickNearestExpiry(rows, prefix, optionType) {
  const now = Date.now();
  const filtered = rows.filter((r) => {
    const sym = (r.pTrdSymbol || r.pSymbolName || '').toUpperCase();
    const opt = (r.pOptionType || r.pOptType || '').toUpperCase();
    return sym.startsWith(prefix) && opt === optionType;
  });

  const future = filtered
    .map((r) => ({ row: r, exp: parseExpiryMs(r) }))
    .filter((x) => x.exp >= now - 86400000)
    .sort((a, b) => a.exp - b.exp);

  return future[0]?.row || null;
}

function pickStrikeRow(rows, prefix, strike, optionType) {
  const strikeStr = String(strike);
  const matches = rows.filter((r) => {
    const sym = (r.pTrdSymbol || '').toUpperCase();
    const opt = (r.pOptionType || r.pOptType || '').toUpperCase();
    const rowStrike = String(r.dStrikePrice || r.pStrikePrice || '');
    return (
      sym.startsWith(prefix) &&
      opt === optionType &&
      rowStrike === strikeStr
    );
  });

  if (!matches.length) return null;
  const now = Date.now();
  return (
    matches
      .map((r) => ({ row: r, exp: parseExpiryMs(r) }))
      .filter((x) => x.exp >= now - 86400000)
      .sort((a, b) => a.exp - b.exp)[0]?.row || matches[0]
  );
}

export async function resolveStraddleLegs(symbol, strike) {
  const sym = symbol.toUpperCase();
  const segment = SEGMENT[sym];
  const prefix = INDEX_PREFIX[sym];
  if (!segment) throw new Error(`Unsupported symbol for Kotak: ${sym}`);

  const rows = await getRows(segment);
  const ce = pickStrikeRow(rows, prefix, strike, 'CE');
  const pe = pickStrikeRow(rows, prefix, strike, 'PE');

  if (!ce || !pe) {
    throw new Error(`Could not resolve CE/PE for ${sym} strike ${strike}`);
  }

  return {
    exchangeSegment: segment,
    lotSize: Number(ce.lLotSize || pe.lLotSize || 1),
    ce: {
      tradingSymbol: ce.pTrdSymbol,
      scripToken: ce.pSymbol,
      row: ce,
    },
    pe: {
      tradingSymbol: pe.pTrdSymbol,
      scripToken: pe.pSymbol,
      row: pe,
    },
  };
}
