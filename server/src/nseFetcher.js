import path from 'path';
import { fileURLToPath } from 'url';
import { NSE } from 'nse-bse-api';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const downloadsDir = path.join(__dirname, '..', 'downloads');

let nseClient = null;

function getClient() {
  if (!nseClient) {
    nseClient = new NSE(downloadsDir, { server: false, timeout: 25000 });
  }
  return nseClient;
}

async function loadOptionChain(symbol) {
  const nse = getClient();
  const chain = await nse.options.getOptionChain(symbol.toUpperCase());
  const records = chain?.records;
  if (!records?.data?.length) {
    throw new Error(`No option chain data for ${symbol} on NSE`);
  }
  return records;
}

function findAtmStrike(records, spot) {
  const data = records?.data || [];
  if (!data.length) return null;

  let best = data[0];
  let bestDiff = Math.abs((best.strikePrice || 0) - spot);

  for (const row of data) {
    const diff = Math.abs((row.strikePrice || 0) - spot);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = row;
    }
  }
  return best;
}

function findStrikeRow(records, strike) {
  const data = records?.data || [];
  return (
    data.find((r) => r.strikePrice === strike) ??
    data.find((r) => Math.abs((r.strikePrice || 0) - strike) < 0.01) ??
    null
  );
}

function optionPremium(leg) {
  if (!leg) return 0;
  return leg.lastPrice ?? leg.closePrice ?? leg.askPrice ?? 0;
}

function buildResult(symbol, spot, strike, row, source = 'NSE') {
  const cePremium = optionPremium(row.CE);
  const pePremium = optionPremium(row.PE);

  return {
    symbol: symbol.toUpperCase(),
    spot: Number(spot),
    strike,
    cePremium: Number(cePremium),
    pePremium: Number(pePremium),
    straddlePremium: Number(cePremium) + Number(pePremium),
    source,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * 9:15 anchor: spot at open + ATM strike from that spot.
 */
export async function fetchNseAnchor(symbol) {
  const records = await loadOptionChain(symbol);
  const spot = records.underlyingValue ?? records.underlying ?? 0;
  const atmRow = findAtmStrike(records, spot);

  if (!atmRow) {
    throw new Error(`No ATM strike found for ${symbol}`);
  }

  return buildResult(symbol, spot, atmRow.strikePrice, atmRow);
}

/**
 * Straddle premium at the fixed 9:15 strike (same strike all day).
 */
export async function fetchNseStraddleAtStrike(symbol, strike) {
  const records = await loadOptionChain(symbol);
  const spot = records.underlyingValue ?? records.underlying ?? 0;
  const row = findStrikeRow(records, strike);

  if (!row) {
    throw new Error(`Strike ${strike} not found in ${symbol} option chain`);
  }

  return buildResult(symbol, spot, strike, row);
}
