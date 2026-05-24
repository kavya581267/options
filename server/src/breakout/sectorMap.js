import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import { config } from '../config.js';

const DEFAULT_SECTOR = 'Unknown';
const INDEX_BASE = 'https://nsearchives.nseindia.com/content/indices/';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Sector-specific NSE indices — applied first (more specific than broad lists). */
const SECTOR_INDEX_FILES = [
  { file: 'ind_niftybanklist.csv', sector: 'Banking' },
  { file: 'ind_niftyitlist.csv', sector: 'IT' },
  { file: 'ind_niftypharmalist.csv', sector: 'Pharma' },
  { file: 'ind_niftyautolist.csv', sector: 'Auto' },
  { file: 'ind_niftyfmcglist.csv', sector: 'FMCG' },
  { file: 'ind_niftymetallist.csv', sector: 'Metals' },
  { file: 'ind_niftyenergylist.csv', sector: 'Energy' },
  { file: 'ind_niftyrealtylist.csv', sector: 'Realty' },
  { file: 'ind_niftyfinancelist.csv', sector: 'Finance' },
  { file: 'ind_niftyhealthcarelist.csv', sector: 'Healthcare' },
  { file: 'ind_niftyconsumerdurableslist.csv', sector: 'Consumer Durables' },
  { file: 'ind_niftyoilgaslist.csv', sector: 'Oil & Gas' },
  { file: 'ind_niftypsubanklist.csv', sector: 'PSU Banking' },
];

/** Broad index lists — use the Industry column when symbol is not yet mapped. */
const INDUSTRY_INDEX_FILES = [
  'ind_nifty500list.csv',
  'ind_niftymidcap150list.csv',
  'ind_niftysmallcap250list.csv',
];

let cachedMap = null;
let cachedAt = 0;

function sectorFilePath() {
  return path.join(config.dataDir, 'screener', 'sector.csv');
}

function sectorCachePath() {
  return path.join(config.dataDir, 'screener', 'sector_cache.json');
}

function parseCsvLine(line) {
  const parts = [];
  let current = '';
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  parts.push(current.trim());
  return parts;
}

async function loadManualSectorCsv(map) {
  try {
    const raw = await fs.readFile(sectorFilePath(), 'utf-8');
    const lines = raw.trim().split(/\r?\n/).slice(1);
    for (const line of lines) {
      if (!line.trim()) continue;
      const [symbol, sector] = parseCsvLine(line);
      if (symbol) map.set(symbol.toUpperCase(), sector || DEFAULT_SECTOR);
    }
  } catch {
    /* optional file */
  }
}

async function fetchIndexCsv(fileName) {
  const url = `${INDEX_BASE}${fileName}`;
  const response = await axios.get(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    timeout: 20000,
  });
  return String(response.data);
}

function applySectorIndexCsv(map, raw, sector) {
  const lines = raw.trim().split(/\r?\n/).slice(1);
  for (const line of lines) {
    if (!line.trim()) continue;
    const cols = parseCsvLine(line);
    const symbol = (cols[2] || '').toUpperCase();
    if (!symbol || map.has(symbol)) continue;
    map.set(symbol, sector);
  }
}

function applyIndustryIndexCsv(map, raw) {
  const lines = raw.trim().split(/\r?\n/).slice(1);
  for (const line of lines) {
    if (!line.trim()) continue;
    const cols = parseCsvLine(line);
    const industry = (cols[1] || '').trim();
    const symbol = (cols[2] || '').toUpperCase();
    if (!symbol || !industry || map.has(symbol)) continue;
    map.set(symbol, industry);
  }
}

async function buildIndexSectorMap() {
  const map = new Map();

  for (const { file, sector } of SECTOR_INDEX_FILES) {
    try {
      const raw = await fetchIndexCsv(file);
      applySectorIndexCsv(map, raw, sector);
    } catch {
      /* skip unavailable index file */
    }
  }

  for (const file of INDUSTRY_INDEX_FILES) {
    try {
      const raw = await fetchIndexCsv(file);
      applyIndustryIndexCsv(map, raw);
    } catch {
      /* skip unavailable index file */
    }
  }

  return map;
}

async function readSectorCache() {
  try {
    const raw = await fs.readFile(sectorCachePath(), 'utf-8');
    const payload = JSON.parse(raw);
    if (!payload?.symbols || Date.now() - (payload.updatedAt || 0) > CACHE_TTL_MS) {
      return null;
    }
    return new Map(Object.entries(payload.symbols));
  } catch {
    return null;
  }
}

async function writeSectorCache(map) {
  const payload = {
    updatedAt: Date.now(),
    symbolCount: map.size,
    symbols: Object.fromEntries(map),
  };
  await fs.mkdir(path.dirname(sectorCachePath()), { recursive: true });
  await fs.writeFile(sectorCachePath(), JSON.stringify(payload), 'utf-8');
}

export async function loadSectorMap(force = false) {
  const now = Date.now();
  if (!force && cachedMap && now - cachedAt < 60_000) return cachedMap;

  const map = new Map();
  await loadManualSectorCsv(map);

  let indexMap = force ? null : await readSectorCache();
  if (!indexMap) {
    indexMap = await buildIndexSectorMap();
    await writeSectorCache(indexMap);
  }

  for (const [symbol, sector] of indexMap) {
    if (!map.has(symbol)) map.set(symbol, sector);
  }

  cachedMap = map;
  cachedAt = now;
  return map;
}

export function getSector(map, symbol) {
  return map.get(symbol?.toUpperCase()) || DEFAULT_SECTOR;
}

export async function listSectors() {
  const map = await loadSectorMap();
  const sectors = [...new Set(map.values())].filter((s) => s !== DEFAULT_SECTOR).sort();
  return sectors;
}
