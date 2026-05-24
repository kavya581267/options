import { getUniverse } from './universe.js';
import { saveScanResult, todayDateStr } from './screenerStorage.js';
import {
  getSeries,
  warmDayCache,
  clearDayCache,
} from './bhavcopyHistory.js';
import { loadSharesMap, getMarketCapCr } from './sharesOutstanding.js';
import { normalizeQuery, queryId } from './query.js';
import {
  buildQueryLabel,
  getIndicator,
  requiredHistoryDays,
  resultColumnsForQuery,
} from './indicators/registry.js';

const UPDATE_EVERY_N_MATCHES = 20;
const YIELD_EVERY_N_STOCKS = 50;

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
  status: null,
  lastError: null,
  liveSnapshot: null,
};

function flattenIndicators(indicatorResults) {
  const flat = {};
  for (const [id, result] of Object.entries(indicatorResults)) {
    flat[id] = result;
  }
  return flat;
}

function buildPayload({
  id,
  query,
  queryLabel,
  date,
  results,
  status,
  startedAt,
  totalScanned,
  processed,
  errors,
  force,
  lastError,
}) {
  return {
    queryId: id,
    query,
    queryLabel,
    logic: query.logic,
    universe: query.universe,
    date,
    status,
    startedAt,
    completedAt: status === 'complete' ? new Date().toISOString() : null,
    totalScanned,
    processedCount: processed,
    matchedCount: results.length,
    errorCount: errors.length,
    columns: resultColumnsForQuery(query),
    stocks: [...results],
    errors: errors.slice(0, 100),
    force,
    lastError: lastError || null,
  };
}

async function analyzeStock(stock, query, sharesMap) {
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
    market_cap_cr: getMarketCapCr(sharesMap, stock.symbol, close),
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
    status: 'running',
    lastError: null,
    liveSnapshot: null,
  };

  const results = [];
  let matchesSinceUpdate = 0;

  const makePayload = (status, lastError = null) =>
    buildPayload({
      id,
      query,
      queryLabel,
      date,
      results,
      status,
      startedAt: runState.startedAt,
      totalScanned: stocks.length,
      processed: runState.processed,
      errors: runState.errors,
      force,
      lastError,
    });

  const updateLive = (status, lastError = null) => {
    runState.liveSnapshot = makePayload(status, lastError);
    return runState.liveSnapshot;
  };

  const publishLive = async (status, lastError = null, force = false) => {
    if (!force && matchesSinceUpdate < UPDATE_EVERY_N_MATCHES) return;

    updateLive(status, lastError);
    await saveScanResult(runState.liveSnapshot);
    matchesSinceUpdate = 0;
  };

  try {
    await warmDayCache(historyDays, {
      onProgress: (p) => {
        runState.cacheProgress = p;
      },
    });

    runState.phase = 'scan';
    const sharesMap = await loadSharesMap(date);
    await publishLive('running', null, true);

    for (const stock of stocks) {
      runState.currentSymbol = stock.symbol;
      try {
        const row = await analyzeStock(stock, query, sharesMap);
        runState.processed += 1;
        if (row.matched) {
          runState.matched += 1;
          results.push(row);
          matchesSinceUpdate += 1;
          await publishLive('running');
        }
        if (runState.processed % YIELD_EVERY_N_STOCKS === 0) {
          await new Promise((resolve) => setImmediate(resolve));
        }
      } catch (err) {
        runState.processed += 1;
        runState.errors.push({ symbol: stock.symbol, error: err.message });
      }
    }

    if (matchesSinceUpdate > 0) {
      await publishLive('running', null, true);
    }

    results.sort((a, b) => a.symbol.localeCompare(b.symbol));
    const payload = updateLive('complete');
    await saveScanResult(payload);
    runState.finishedAt = payload.completedAt;
    runState.status = 'complete';
    return payload;
  } catch (err) {
    runState.lastError = err.message;
    runState.status = 'failed';
    results.sort((a, b) => a.symbol.localeCompare(b.symbol));
    const payload = updateLive('failed', err.message);
    await saveScanResult(payload);
    throw err;
  } finally {
    runState.running = false;
    runState.currentSymbol = null;
    runState.phase = null;
    clearDayCache();
  }
}

export async function startScreenerAsync(options = {}) {
  if (runState.running) {
    throw new Error('A scan is already running');
  }

  const promise = runScreener(options);
  return { started: true, status: getRunStatus(), promise };
}

export function getNestedValue(obj, keyPath) {
  const parts = keyPath.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return null;
    cur = cur[p];
  }
  return cur;
}
