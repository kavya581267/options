import { getUniverse } from './universe.js';
import { saveScanResult, todayDateStr } from './screenerStorage.js';
import { config } from '../config.js';
import {
  buildBhavcopyHistoryCache,
  getSeries,
} from './bhavcopyHistory.js';
import { normalizeQuery, queryId } from './query.js';
import {
  buildQueryLabel,
  getIndicator,
  requiredHistoryDays,
  resultColumnsForQuery,
} from './indicators/registry.js';

let runState = {
  running: false,
  phase: null,
  queryId: null,
  queryLabel: null,
  universe: null,
  date: null,
  total: 0,
  processed: 0,
  matched: 0,
  currentSymbol: null,
  cacheProgress: null,
  errors: [],
  startedAt: null,
  finishedAt: null,
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function flattenIndicators(indicatorResults) {
  const flat = {};
  for (const [id, result] of Object.entries(indicatorResults)) {
    flat[id] = result;
  }
  return flat;
}

function getNestedValue(obj, keyPath) {
  const parts = keyPath.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return null;
    cur = cur[p];
  }
  return cur;
}

async function analyzeStock(stock, query) {
  const historyDays = requiredHistoryDays(query);
  const series = await getSeries(stock.symbol, stock.exchanges, historyDays);

  if (!series.closes.length) {
    return { matched: false, reason: 'No price history' };
  }

  const ctx = {
    closes: series.closes,
    volumes: series.volumes,
    stock,
    dataSource: series.exchange ? `Bhavcopy ${series.exchange}` : null,
  };

  const indicatorResults = {};
  const logic = query.logic || 'AND';
  let matched = logic === 'AND';
  let hasResult = false;

  for (const item of query.indicators) {
    const def = getIndicator(item.id);
    const result = def.evaluate(ctx, item.params);
    indicatorResults[item.id] = result;
    hasResult = true;

    if (logic === 'AND') {
      matched = matched && Boolean(result.matched);
    } else {
      matched = matched || Boolean(result.matched);
    }
  }

  if (!hasResult) matched = false;

  const close = series.closes[series.closes.length - 1];

  return {
    matched,
    symbol: stock.symbol,
    name: stock.name,
    exchange: stock.exchanges?.join(', ') || stock.exchange,
    exchanges: stock.exchanges || [stock.exchange],
    close,
    dataSource: ctx.dataSource,
    isin: stock.isin ?? null,
    bseScripCode: stock.bseScripCode ?? null,
    indicators: flattenIndicators(indicatorResults),
  };
}

export function getRunStatus() {
  return { ...runState };
}

export async function runScreener({
  query: rawQuery,
  date = todayDateStr(),
  force = false,
} = {}) {
  if (runState.running) {
    throw new Error('A scan is already running');
  }

  const query = normalizeQuery(rawQuery);
  const id = queryId(query);
  const queryLabel = buildQueryLabel(query);
  const stocks = await getUniverse(query.universe);
  const historyDays = requiredHistoryDays(query);

  runState = {
    running: true,
    phase: 'cache',
    queryId: id,
    queryLabel,
    universe: query.universe,
    date,
    total: stocks.length,
    processed: 0,
    matched: 0,
    currentSymbol: null,
    cacheProgress: null,
    errors: [],
    startedAt: new Date().toISOString(),
    finishedAt: null,
  };

  const results = [];

  try {
    await buildBhavcopyHistoryCache({
      days: historyDays,
      onProgress: (p) => {
        runState.cacheProgress = p;
      },
    });

    runState.phase = 'scan';

    for (const stock of stocks) {
      runState.currentSymbol = stock.symbol;
      try {
        const row = await analyzeStock(stock, query);
        runState.processed += 1;
        if (row.matched) {
          runState.matched += 1;
          results.push(row);
        }
      } catch (err) {
        runState.processed += 1;
        runState.errors.push({ symbol: stock.symbol, error: err.message });
      }

      const delayMs = config.screener?.requestDelayMs ?? 50;
      if (delayMs > 0) await sleep(delayMs);
    }

    results.sort((a, b) => a.symbol.localeCompare(b.symbol));

    const payload = {
      queryId: id,
      query,
      queryLabel,
      logic: query.logic,
      universe: query.universe,
      date,
      startedAt: runState.startedAt,
      completedAt: new Date().toISOString(),
      totalScanned: stocks.length,
      matchedCount: results.length,
      errorCount: runState.errors.length,
      columns: resultColumnsForQuery(query),
      stocks: results,
      errors: runState.errors.slice(0, 100),
      force,
    };

    await saveScanResult(payload);
    runState.finishedAt = payload.completedAt;
    return payload;
  } finally {
    runState.running = false;
    runState.currentSymbol = null;
    runState.phase = null;
  }
}

export async function startScreenerAsync(options = {}) {
  if (runState.running) {
    throw new Error('A scan is already running');
  }

  const promise = runScreener(options);
  return { started: true, status: getRunStatus(), promise };
}

export { getNestedValue };
