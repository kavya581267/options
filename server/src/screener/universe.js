import { loadLatestUniverseFromBhavcopy } from './bhavcopyHistory.js';

let cachedUniverses = null;
let cachedAt = 0;
const CACHE_MS = 30 * 60 * 1000;

async function loadUniverses() {
  const now = Date.now();
  if (cachedUniverses && now - cachedAt < CACHE_MS) {
    return cachedUniverses;
  }

  cachedUniverses = await loadLatestUniverseFromBhavcopy();
  cachedAt = now;
  return cachedUniverses;
}

export async function getUniverse(universeId = 'all') {
  const universes = await loadUniverses();
  if (universeId === 'nse_equity') return universes.nse_equity;
  if (universeId === 'bse_equity') return universes.bse_equity;
  return universes.all;
}

export async function listUniverseOptions() {
  const universes = await loadUniverses();
  return [
    {
      id: 'all',
      label: 'All equities (NSE + BSE)',
      count: universes.all.length,
    },
    {
      id: 'nse_equity',
      label: 'NSE equities',
      count: universes.nse_equity.length,
    },
    {
      id: 'bse_equity',
      label: 'BSE equities',
      count: universes.bse_equity.length,
    },
  ];
}

export async function findStock(symbol) {
  const universes = await loadUniverses();
  const sym = symbol.toUpperCase();
  return universes.all.find((s) => s.symbol === sym) || null;
}

export function clearUniverseCache() {
  cachedUniverses = null;
  cachedAt = 0;
}
