import { useCallback, useEffect, useMemo, useState, Fragment } from 'react';
import CollapsibleSection from '../components/CollapsibleSection';
import BreakoutFilterPanel from '../components/breakout/BreakoutFilterPanel';
import {
  DEFAULT_BREAKOUT_FILTERS,
  fetchBreakoutFilters,
  fetchBreakoutSectors,
  fetchBreakoutDates,
  fetchBreakoutResults,
  fetchBreakoutStatus,
  getBreakoutCell,
  runBreakoutScan,
} from '../api/breakoutScreener';
import './BreakoutScreenerPage.css';

const PAGE_SIZE_OPTIONS = [25, 50, 100];

const FALLBACK_COLUMNS = [
  { key: 'symbol', label: 'Symbol' },
  { key: 'sector', label: 'Sector' },
  { key: 'close', label: 'Close', numeric: true },
  { key: 'market_cap_cr', label: 'Mkt Cap (Cr)', numeric: true },
  { key: 'final_score', label: 'Score', numeric: true },
  { key: 'breakout_flag', label: 'Breakout' },
  { key: 'relative_strength', label: 'Rel Strength', numeric: true },
  { key: 'delivery_pct', label: 'Delivery %', numeric: true },
  { key: 'rsi14', label: 'RSI 14', numeric: true },
];

function formatMarketCapCr(cr) {
  if (cr == null || Number.isNaN(cr)) return '—';
  if (cr >= 100000) return `${(cr / 100000).toFixed(2)}L Cr`;
  if (cr >= 100) return `${(cr / 100).toFixed(2)}K Cr`;
  return `${Number(cr).toLocaleString('en-IN', { maximumFractionDigits: 0 })} Cr`;
}

function formatCell(row, col) {
  const value = getBreakoutCell(row, col.key);
  if (col.key === 'breakout_flag') return row.breakout_flag ? '✓' : '—';
  if (col.key === 'market_cap_cr') return formatMarketCapCr(value);
  if (col.numeric) return formatNum(value);
  return value ?? '—';
}

function todayIST() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

function formatNum(n, digits = 2) {
  if (n == null || Number.isNaN(n)) return '—';
  if (typeof n === 'boolean') return n ? 'Yes' : 'No';
  return Number(n).toLocaleString('en-IN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export default function BreakoutScreenerPage() {
  const [date, setDate] = useState(todayIST());
  const [dates, setDates] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [sortKey, setSortKey] = useState('final_score');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [selected, setSelected] = useState(null);
  const [filters, setFilters] = useState(DEFAULT_BREAKOUT_FILTERS);
  const [filterCatalog, setFilterCatalog] = useState([]);
  const [sectors, setSectors] = useState([]);

  const columns = meta?.columns?.length ? meta.columns : FALLBACK_COLUMNS;

  const refreshDates = useCallback(async () => {
    try {
      const { dates: d } = await fetchBreakoutDates();
      setDates(d);
      setDate((cur) => (d.includes(cur) ? cur : d[0] || cur));
    } catch {
      setDates([]);
    }
  }, []);

  const loadResults = useCallback(async (activeDate, { silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const data = await fetchBreakoutResults(activeDate);
      setStocks(data.stocks || []);
      setMeta(data);
      if (data.filters) setFilters(data.filters);
      if (data.message) setError(data.message);
    } catch (e) {
      if (!silent) {
        setStocks([]);
        setMeta(null);
        if (!e.message.includes('No breakout results')) setError(e.message);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [{ catalog, defaults }, { sectors: s }] = await Promise.all([
          fetchBreakoutFilters(),
          fetchBreakoutSectors(),
        ]);
        setFilterCatalog(catalog);
        setFilters(defaults);
        setSectors(s);
      } catch {
        /* optional */
      }
      refreshDates();
    })();
  }, [refreshDates]);

  useEffect(() => {
    if (!scanning) loadResults(date);
  }, [date, loadResults, scanning]);

  useEffect(() => {
    if (!scanning) return undefined;
    const scanDate = todayIST();
    const poll = async () => {
      try {
        const s = await fetchBreakoutStatus();
        setStatus(s);
        if (s.liveSnapshot) {
          setStocks(s.liveSnapshot.stocks || []);
          setMeta(s.liveSnapshot);
          setDate(scanDate);
        }
        if (!s.running) {
          setScanning(false);
          await refreshDates();
          await loadResults(scanDate);
        }
      } catch {
        /* ignore */
      }
    };
    poll();
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, [scanning, refreshDates, loadResults]);

  const sorted = useMemo(() => {
    const rows = [...stocks];
    rows.sort((a, b) => {
      const av = getBreakoutCell(a, sortKey);
      const bv = getBreakoutCell(b, sortKey);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      if (typeof av === 'boolean') {
        return sortDir === 'asc' ? Number(av) - Number(bv) : Number(bv) - Number(av);
      }
      const cmp = String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [stocks, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedRows = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const rangeStart = sorted.length ? (currentPage - 1) * pageSize + 1 : 0;
  const rangeEnd = Math.min(currentPage * pageSize, sorted.length);

  useEffect(() => setPage(1), [date, sortKey, sortDir, pageSize]);
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const handleRun = async () => {
    setScanning(true);
    setError(null);
    setStocks([]);
    setMeta(null);
    setPage(1);
    const scanDate = todayIST();
    setDate(scanDate);
    try {
      await runBreakoutScan({ date: scanDate, force: true, filters });
      setStatus({ running: true, phase: 'cache' });
    } catch (e) {
      setScanning(false);
      setError(e.message);
    }
  };

  const progressPct =
    status?.phase === 'cache' && status?.cacheProgress?.total > 0
      ? Math.round((status.cacheProgress.done / status.cacheProgress.total) * 100)
      : status?.total > 0
        ? Math.round((status.processed / status.total) * 100)
        : 0;

  return (
    <div className="breakout-page">
      <header className="header breakout-header">
        <div>
          <h1>Breakout Screener</h1>
          <p className="subtitle">
            Production swing breakout scan — market trend, sector RS, consolidation, volume & delivery
          </p>
        </div>
        <div className="header-actions">
          <button type="button" className="btn-secondary" onClick={handleRun} disabled={scanning}>
            {scanning ? 'Scanning…' : 'Run breakout scan'}
          </button>
        </div>
      </header>

      <CollapsibleSection title="How it works" defaultOpen={false}>
        <ul className="breakout-rules">
          <li>Market: Nifty above EMA20 & EMA50, EMA20 &gt; EMA50</li>
          <li>Sector relative strength vs Nifty (1-month)</li>
          <li>Stock above EMA50 &amp; EMA200 (SMA50 proxy if &lt;200 days data)</li>
          <li>15-day consolidation base + volume dry-up</li>
          <li>Breakout: close &gt; 20-day high + volume ≥ 2× avg</li>
          <li>Composite score: Trend 20 + RS 20 + Volume 20 + Base 15 + Delivery 10 + ATR 10 + Breakout 5</li>
        </ul>
        <p className="hint">
          Drop consolidated bhav CSV into <code>server/data/screener/bhav/</code> (columns: date,
          symbol, open, high, low, close, volume, delivery_qty, delivery_pct, trades). Edit{' '}
          <code>server/data/screener/sector.csv</code> for sector mapping.
        </p>
      </CollapsibleSection>

      <CollapsibleSection title="Screen filters" defaultOpen subtitle="Toggle criteria — scan re-runs with your selection">
        <BreakoutFilterPanel
          filters={filters}
          onChange={setFilters}
          catalog={filterCatalog}
          sectors={sectors}
          disabled={scanning}
        />
        {meta?.activeFilters?.length > 0 && (
          <p className="active-filters-banner">
            <strong>Last scan:</strong> {meta.activeFilters.join(' · ')}
          </p>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Scan settings" defaultOpen>
        <div className="breakout-controls">
          <label>
            Date
            <select value={date} onChange={(e) => setDate(e.target.value)}>
              {dates.length === 0 && <option value={date}>{date}</option>}
              {dates.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </label>
          {meta && (
            <div className="breakout-meta">
              <span>{meta.matchedCount ?? 0} candidates</span>
              <span>{meta.processedCount ?? 0} / {meta.totalScanned ?? '—'} scanned</span>
              <span>Source: {meta.dataSource || '—'}</span>
              {meta.market && (
                <span className={meta.market.bullish ? 'live-badge' : 'failed-badge'}>
                  Market {meta.market.bullish ? 'Bullish' : 'Not bullish'}
                </span>
              )}
            </div>
          )}
        </div>
      </CollapsibleSection>

      {scanning && status?.running && (
        <CollapsibleSection title="Scan progress" defaultOpen badge={`${progressPct}%`}>
          <div className="breakout-progress">
            <div className="breakout-progress-bar">
              <div style={{ width: `${progressPct}%` }} />
            </div>
            <p>
              {status.phase === 'cache'
                ? `Loading bhav data — ${status.cacheProgress?.done ?? 0}/${status.cacheProgress?.total ?? '?'}`
                : `Analyzing ${status.currentSymbol || '…'} — ${status.processed}/${status.total} (${progressPct}%)`}
            </p>
          </div>
        </CollapsibleSection>
      )}

      <CollapsibleSection
        title="Results"
        defaultOpen
        badge={sorted.length ? `${sorted.length} stocks` : undefined}
      >
        {error && <div className="error-banner">{error}</div>}

        {loading && !scanning ? (
          <div className="loading">Loading results…</div>
        ) : sorted.length === 0 ? (
          <div className="empty">
            <p>No breakout candidates for {date}.</p>
            <p className="hint">Run a scan or check that market is bullish and bhav data is loaded.</p>
          </div>
        ) : (
          <>
            <div className="breakout-table-wrap">
              <table className="breakout-table">
                <thead>
                  <tr>
                    {columns.map((col) => (
                      <th key={col.key}>
                        <button
                          type="button"
                          onClick={() => {
                            if (sortKey === col.key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
                            else {
                              setSortKey(col.key);
                              setSortDir(col.numeric ? 'desc' : 'asc');
                            }
                          }}
                        >
                          {col.label}
                          {sortKey === col.key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.map((row) => (
                    <tr
                      key={row.symbol}
                      className={selected?.symbol === row.symbol ? 'selected' : ''}
                      onClick={() => setSelected(row)}
                    >
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={`${col.numeric ? 'mono' : ''} ${col.key === 'sector' ? 'sector-cell' : ''}`}
                        >
                          {formatCell(row, col)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="breakout-pagination">
              <span>Showing {rangeStart}–{rangeEnd} of {sorted.length}</span>
              <label>
                Rows
                <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
              <div className="breakout-pagination-nav">
                <button type="button" className="btn-secondary" disabled={currentPage <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
                <span>Page {currentPage} of {totalPages}</span>
                <button type="button" className="btn-secondary" disabled={currentPage >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
              </div>
            </div>
          </>
        )}
      </CollapsibleSection>

      {selected && (
        <div className="breakout-detail-overlay" onClick={() => setSelected(null)}>
          <div className="breakout-detail-panel" onClick={(e) => e.stopPropagation()}>
            <header className="breakout-detail-header">
              <div>
                <h2>{selected.symbol}</h2>
                <p>{selected.sector} · Score {formatNum(selected.final_score)} · MCap {formatMarketCapCr(selected.market_cap_cr)}</p>
              </div>
              <button type="button" className="btn-secondary" onClick={() => setSelected(null)}>Close</button>
            </header>
            <dl className="breakout-detail-grid">
              {Object.entries(selected)
                .filter(([k]) => !['eligible', 'reason'].includes(k))
                .map(([k, v]) => (
                  <Fragment key={k}>
                    <dt>{k}</dt>
                    <dd className="mono">
                      {k === 'market_cap_cr'
                        ? formatMarketCapCr(v)
                        : typeof v === 'boolean'
                        ? v
                          ? 'Yes'
                          : 'No'
                        : typeof v === 'number'
                          ? formatNum(v)
                          : String(v ?? '—')}
                    </dd>
                  </Fragment>
                ))}
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
