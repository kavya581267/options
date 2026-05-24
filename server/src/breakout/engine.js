import { loadSectorMap, getSector } from './sectorMap.js';
import { loadBhavStore, getStore, clearBhavStore, listSymbols } from './bhavStore.js';
import { loadSharesMap, getMarketCapCr } from '../screener/sharesOutstanding.js';
import {
  analyzeMarket,
  analyzeStock,
  computeCompositeScore,
  computeSectorReturns,
  passesFinalFilter,
} from './analyzer.js';
import { percentileRank } from './technical.js';
import {
  normalizeFilters,
  DEFAULT_BREAKOUT_FILTERS,
  activeFilterLabels,
} from './filterConfig.js';
import { saveBreakoutResult, todayDateStr, OUTPUT_COLUMNS, breakoutQueryId } from './storage.js';

let runState = {
  running: false,
  phase: null,
  date: null,
  total: 0,
  processed: 0,
  matched: 0,
  startedAt: null,
  finishedAt: null,
  lastError: null,
  cacheProgress: null,
  liveSnapshot: null,
  filters: null,
};

export function getBreakoutRunStatus() {
  return { ...runState };
}

export async function runBreakoutScreener({
  date = todayDateStr(),
  force = false,
  filters: rawFilters = null,
} = {}) {
  if (runState.running) throw new Error('Breakout scan already running');

  const filters = normalizeFilters(rawFilters || DEFAULT_BREAKOUT_FILTERS);

  runState = {
    running: true,
    phase: 'cache',
    date,
    total: 0,
    processed: 0,
    matched: 0,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    lastError: null,
    cacheProgress: null,
    liveSnapshot: null,
    filters,
  };

  try {
    await loadBhavStore({
      days: 70,
      onProgress: (p) => {
        runState.cacheProgress = p;
      },
    });

    const store = getStore();
    if (!store?.symbolBars?.size) {
      throw new Error(
        'No bhav data loaded. Add CSV files to server/data/screener/bhav/ or run equity screener cache first.'
      );
    }

    runState.phase = 'scan';
    const sectorMap = await loadSectorMap();
    const sharesMap = await loadSharesMap(store.asOfDate);
    const niftyBars = store.niftyBars;
    const market = analyzeMarket(niftyBars);

    const sectorReturns = computeSectorReturns(store.symbolBars, sectorMap, 21);
    const symbols = listSymbols({ minDays: 50, eqOnly: true });
    runState.total = symbols.length;

    const candidates = [];
    const scored = [];

    for (const { symbol } of symbols) {
      runState.processed += 1;
      runState.currentSymbol = symbol;
      const bars = store.symbolBars.get(symbol);
      const sector = getSector(sectorMap, symbol);
      const sectorRet = sectorReturns.get(sector) ?? 0;

      const analysis = analyzeStock(bars, niftyBars, sectorRet, market.return1m);
      if (!analysis.eligible) continue;

      const scores = computeCompositeScore(analysis, market.bullish);
      const row = {
        symbol,
        sector,
        date,
        market_cap_cr: getMarketCapCr(sharesMap, symbol, analysis.close),
        ema50: analysis.ema50 != null ? Number(analysis.ema50.toFixed(2)) : null,
        ema200: analysis.ema200 != null ? Number(analysis.ema200.toFixed(2)) : null,
        breakout_flag: analysis.breakout_flag,
        ...analysis,
        ...scores,
      };

      scored.push(row);

      if (passesFinalFilter(row, market, filters)) {
        candidates.push(row);
        runState.matched += 1;
      }

      if (runState.processed % 100 === 0) {
        await new Promise((r) => setImmediate(r));
      }
    }

    const rsValues = candidates.map((c) => c.relative_strength).filter((v) => v != null);
    for (const row of candidates) {
      row.rank_percentile =
        row.relative_strength != null
          ? Number(percentileRank(row.relative_strength, rsValues).toFixed(1))
          : null;
    }

    candidates.sort((a, b) => b.final_score - a.final_score);

    let message = null;
    if (candidates.length === 0 && filters.require_market_bullish && !market.bullish) {
      message =
        'Market is not bullish. Disable "Market bullish" filter to scan stocks anyway, or wait for market trend to improve.';
    } else if (candidates.length === 0) {
      message = 'No stocks matched your active filters. Try disabling some criteria.';
    }

    const payload = buildPayload({
      date,
      market,
      stocks: candidates,
      status: 'complete',
      message,
      source: store.source,
      startedAt: runState.startedAt,
      totalScanned: symbols.length,
      processed: runState.processed,
      filters,
      scoredCount: scored.length,
    });

    await saveBreakoutResult(payload);
    runState.liveSnapshot = payload;
    runState.finishedAt = payload.completedAt;
    runState.status = 'complete';
    return payload;
  } catch (err) {
    runState.lastError = err.message;
    runState.status = 'failed';
    throw err;
  } finally {
    runState.running = false;
    runState.phase = null;
    runState.currentSymbol = null;
    clearBhavStore();
  }
}

function buildPayload({
  date,
  market,
  stocks,
  status,
  message,
  source,
  startedAt,
  totalScanned,
  processed,
  filters,
  scoredCount,
}) {
  return {
    queryId: breakoutQueryId(),
    queryLabel: 'Swing Breakout Screener',
    date,
    status,
    message: message || null,
    startedAt,
    completedAt: status === 'complete' ? new Date().toISOString() : null,
    dataSource: source,
    market,
    totalScanned: totalScanned ?? 0,
    processedCount: processed ?? 0,
    scoredCount: scoredCount ?? 0,
    matchedCount: stocks.length,
    columns: OUTPUT_COLUMNS,
    stocks,
    filters,
    activeFilters: activeFilterLabels(filters),
  };
}

export async function startBreakoutScreenerAsync(options = {}) {
  if (runState.running) throw new Error('Breakout scan already running');
  const promise = runBreakoutScreener(options);
  return { started: true, status: getBreakoutRunStatus(), promise };
}

export { DEFAULT_BREAKOUT_FILTERS, normalizeFilters };
