import { BSE } from 'nse-bse-api';

const SENSEX_SCRIPCODE = process.env.SENSEX_SCRIPCODE || '1';
const BSE_API = 'https://api.bseindia.com/BseIndiaAPI/api';
const DERIV_REFERER =
  'https://www.bseindia.com/stock-share-price/future-options/derivatives/1/';

let bseClient = null;

function getBseClient() {
  if (!bseClient) {
    bseClient = new BSE({ timeout: 25000 });
  }
  return bseClient;
}

async function loadBseOptionRows() {
  const bse = getBseClient();
  const response = await bse.session.get(`${BSE_API}/DerivOptionChain/w`, {
    params: { scripcode: SENSEX_SCRIPCODE, Expiry: '' },
    headers: { Referer: DERIV_REFERER },
    validateStatus: () => true,
  });

  if (typeof response.data === 'string') {
    if (response.data.includes('<!DOCTYPE') || response.data.includes('<html')) {
      throw new Error(
        'BSE option chain blocked by BSE website (HTML response). Use Kotak login for SENSEX trading.'
      );
    }
    throw new Error('BSE option chain returned unexpected text response');
  }

  const payload = typeof response.data === 'object' ? response.data : null;
  const rows = payload?.Table ?? payload?.table ?? payload?.data;

  if (!Array.isArray(rows) || !rows.length) {
    throw new Error(
      'BSE option chain empty — use Kotak login for SENSEX, or try again during market hours (9:15–15:30 IST).'
    );
  }
  return rows;
}

async function getSensexSpot() {
  const bse = getBseClient();
  const quote = await bse.quote(SENSEX_SCRIPCODE);
  const spot = quote.LTP;
  if (!spot || !Number.isFinite(spot)) {
    throw new Error('Could not read SENSEX spot from BSE');
  }
  return Number(spot);
}

function strikeFromRow(row) {
  return Number(
    row.Strike_Price ?? row.StrikePrice ?? row.strikePrice ?? row.STRIKE ?? 0
  );
}

function findAtmFromBseRows(rows, spot) {
  if (!rows?.length) return null;

  let best = rows[0];
  let bestDiff = Infinity;

  for (const row of rows) {
    const strike = strikeFromRow(row);
    const diff = Math.abs(strike - spot);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = row;
    }
  }
  return { row: best, strike: strikeFromRow(best) };
}

function findBseStrikeRow(rows, strike) {
  return (
    rows.find((r) => strikeFromRow(r) === strike) ??
    rows.find((r) => Math.abs(strikeFromRow(r) - strike) < 0.01) ??
    null
  );
}

function premiumsFromBseRow(row) {
  const ce =
    row.C_LTP ?? row.C_Last ?? row.Call_LTP ?? row.ce?.lastPrice ?? row.CE?.lastPrice ?? 0;
  const pe =
    row.P_LTP ?? row.P_Last ?? row.Put_LTP ?? row.pe?.lastPrice ?? row.PE?.lastPrice ?? 0;
  return { cePremium: Number(ce), pePremium: Number(pe) };
}

function buildSensexResult(spot, strike, row) {
  const { cePremium, pePremium } = premiumsFromBseRow(row);
  return {
    symbol: 'SENSEX',
    spot: Number(spot),
    strike,
    cePremium,
    pePremium,
    straddlePremium: cePremium + pePremium,
    source: 'BSE',
    fetchedAt: new Date().toISOString(),
  };
}

export async function fetchSensexAnchor() {
  const spot = await getSensexSpot();
  const rows = await loadBseOptionRows();
  const { row, strike } = findAtmFromBseRows(rows, spot);

  if (!row) {
    throw new Error('No ATM strike in BSE option chain');
  }

  return buildSensexResult(spot, strike, row);
}

export async function fetchSensexStraddleAtStrike(strike) {
  const spot = await getSensexSpot();
  const rows = await loadBseOptionRows();
  const row = findBseStrikeRow(rows, strike);

  if (!row) {
    throw new Error(`Strike ${strike} not found in SENSEX option chain`);
  }

  return buildSensexResult(spot, strike, row);
}
