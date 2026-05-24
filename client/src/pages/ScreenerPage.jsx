import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_QUERY,
  buildQueryLabel,
  fetchIndicators,
  fetchPresets,
  fetchScreenerDates,
  fetchScreenerResults,
  fetchScreenerStatus,
  fetchScreenerUniverses,
  fetchStockDetails,
  getMetricValue,
  runScreenerScan,
  savePreset,
} from '../api/screener';
import IndicatorBuilder from '../components/screener/IndicatorBuilder';
import CollapsibleSection from '../components/CollapsibleSection';
import '../components/screener/IndicatorBuilder.css';
import './ScreenerPage.css';

function todayIST() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
  }).format(new Date());
}

function formatNum(n, digits = 2) {
  if (n == null || Number.isNaN(n)) return '—';
  return Number(n).toLocaleString('en-IN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatMarketCapCr(cr) {
  if (cr == null || Number.isNaN(cr)) return '—';
  if (cr >= 100000) return `${(cr / 100000).toFixed(2)}L Cr`;
  if (cr >= 100) return `${(cr / 100).toFixed(2)}K Cr`;
  return `${Number(cr).toLocaleString('en-IN', { maximumFractionDigits: 0 })} Cr`;
}

const BASE_COLUMNS = [
  { key: 'symbol', label: 'Symbol' },
  { key: 'name', label: 'Name' },
  { key: 'exchange', label: 'Exchange' },
  { key: 'close', label: 'Close', numeric: true },
  { key: 'market_cap_cr', label: 'Mkt Cap (Cr)', numeric: true },
];

const PAGE_SIZE_OPTIONS = [25, 50, 100];

export default function ScreenerPage() {
  const [catalog, setCatalog] = useState([]);
  const [presets, setPresets] = useState([]);
  const [universes, setUniverses] = useState([]);
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [queryId, setQueryId] = useState(null);
  const [dates, setDates] = useState([]);
  const [date, setDate] = useState(todayIST());
  const [stocks, setStocks] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [status, setStatus] = useState(null);
  const [sortKey, setSortKey] = useState('symbol');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [selected, setSelected] = useState(null);
  const [details, setDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [presetId, setPresetId] = useState('swing-trend-continuation');
  const [presetName, setPresetName] = useState('');
  const [savingPreset, setSavingPreset] = useState(false);

  const queryLabel = useMemo(
    () => buildQueryLabel(query, catalog),
    [query, catalog]
  );

  const columns = useMemo(() => {
    const dynamic = (meta?.columns || []).map((col) => ({
      key: col.key,
      label: col.label,
      numeric: col.numeric,
      metric: true,
    }));
    return [...BASE_COLUMNS, ...dynamic, { key: 'dataSource', label: 'Source' }];
  }, [meta]);

  const refreshDates = useCallback(async (activeQuery, activeQueryId) => {
    try {
      const { dates: d, queryId: id } = await fetchScreenerDates(activeQuery);
      setDates(d);
      setQueryId(activeQueryId || id);
      setDate((current) => (d.includes(current) ? current : d[0] || current));
      return { dates: d, queryId: activeQueryId || id };
    } catch {
      setDates([]);
      return { dates: [], queryId: activeQueryId };
    }
  }, []);

  const loadResults = useCallback(
    async (activeQuery, activeDate, activeQueryId, { silent = false } = {}) => {
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const data = await fetchScreenerResults({
          query: activeQuery,
          date: activeDate,
          queryId: activeQueryId,
        });
        setStocks(data.stocks || []);
        setMeta(data);
        setQueryId(data.queryId || activeQueryId);
        if (data.status === 'failed' && data.lastError) {
          setError(`Scan stopped early: ${data.lastError}. Showing ${data.matchedCount} matches saved so far.`);
        }
      } catch (e) {
        if (!silent) {
          setStocks([]);
          setMeta(null);
          if (!e.message.includes('No scan results')) {
            setError(e.message);
          }
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    (async () => {
      const [{ indicators }, { presets: p }, { universes: u }] = await Promise.all([
        fetchIndicators(),
        fetchPresets(),
        fetchScreenerUniverses(),
      ]);
      setCatalog(indicators);
      setPresets(p);
      setUniverses(u);
      const initial = p.find((x) => x.id === 'swing-trend-continuation') || p[0];
      if (initial) {
        setQuery(initial.query);
        setPresetId(initial.id);
        await refreshDates(initial.query, initial.queryId);
      }
    })();
  }, [refreshDates]);

  useEffect(() => {
    if (!query.indicators?.length) return;
    refreshDates(query, queryId);
  }, [query, refreshDates]);

  useEffect(() => {
    if (!query.indicators?.length || scanning) return;
    loadResults(query, date, queryId);
  }, [query, date, queryId, loadResults, scanning]);

  useEffect(() => {
    if (!scanning) return undefined;

    const scanDate = todayIST();

    const poll = async () => {
      try {
        const s = await fetchScreenerStatus();
        setStatus(s);
        const id = s.queryId || queryId;

        if (s.liveSnapshot) {
          setStocks(s.liveSnapshot.stocks || []);
          setMeta(s.liveSnapshot);
          setQueryId(id);
          setDate(scanDate);
          setDates((prev) => (prev.includes(scanDate) ? prev : [scanDate, ...prev]));
        }

        if (!s.running) {
          setScanning(false);
          await refreshDates(query, id);
          await loadResults(query, scanDate, id);
        }
      } catch {
        /* ignore poll errors */
      }
    };

    poll();
    const intervalId = setInterval(poll, 2000);
    return () => clearInterval(intervalId);
  }, [scanning, query, queryId, refreshDates, loadResults]);

  const getCellValue = (row, key) => {
    if (key.includes('.')) return getMetricValue(row, key);
    return row[key];
  };

  const formatCell = (row, col) => {
    const value = getCellValue(row, col.key);
    if (col.key === 'market_cap_cr') return formatMarketCapCr(value);
    if (col.numeric) {
      return `${formatNum(value)}${col.key.includes('pct') ? '%' : ''}`;
    }
    return value ?? '—';
  };

  const sorted = useMemo(() => {
    const rows = [...stocks];
    rows.sort((a, b) => {
      const av = getCellValue(a, sortKey);
      const bv = getCellValue(b, sortKey);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      const cmp = String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [stocks, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, currentPage, pageSize]);

  const rangeStart = sorted.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(currentPage * pageSize, sorted.length);

  useEffect(() => {
    setPage(1);
  }, [date, queryId, sortKey, sortDir, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'symbol' || key === 'name' ? 'asc' : 'desc');
    }
  };

  const handleRunScan = async () => {
    setScanning(true);
    setError(null);
    setStocks([]);
    setMeta(null);
    setPage(1);
    const scanDate = todayIST();
    setDate(scanDate);
    try {
      const res = await runScreenerScan({
        query: { ...query, universe: query.universe || 'all' },
        date: scanDate,
        force: true,
      });
      setQueryId(res.queryId);
      setStatus({ running: true, processed: 0, total: 0, phase: 'cache' });
    } catch (e) {
      setScanning(false);
      setError(e.message);
    }
  };

  const handlePresetChange = (id) => {
    const preset = presets.find((p) => p.id === id);
    if (!preset) return;
    setPresetId(id);
    setQuery(preset.query);
    setQueryId(preset.queryId);
  };

  const handleSavePreset = async () => {
    if (!presetName.trim()) return;
    setSavingPreset(true);
    setError(null);
    try {
      const { preset } = await savePreset({ name: presetName.trim(), query });
      setPresets((prev) => [...prev, preset]);
      setPresetId(preset.id);
      setPresetName('');
      setQueryId(preset.queryId);
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingPreset(false);
    }
  };

  const openDetails = async (row) => {
    setSelected(row);
    setDetails(null);
    setDetailsLoading(true);
    try {
      const d = await fetchStockDetails(row.symbol, queryId);
      setDetails(d);
    } catch (e) {
      setDetails({ error: e.message });
    } finally {
      setDetailsLoading(false);
    }
  };

  const activePreset = presets.find((p) => p.id === presetId);

  const swingPresets = presets.filter((p) => p.category === 'swing');
  const generalPresets = presets.filter((p) => p.category === 'general');
  const customPresets = presets.filter((p) => p.category === 'custom');

  const progressPct =
    status?.phase === 'cache' && status?.cacheProgress?.total > 0
      ? Math.round((status.cacheProgress.done / status.cacheProgress.total) * 100)
      : status?.total > 0
        ? Math.round((status.processed / status.total) * 100)
        : 0;

  return (
    <div className="screener-page">
      <header className="header screener-header">
        <div>
          <h1>Stock Screener</h1>
          <p className="subtitle">
            Pick a swing strategy, run the scan, and track matches daily
          </p>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={handleRunScan}
            disabled={scanning || !query.indicators?.length}
          >
            {scanning ? 'Scanning…' : 'Run scan today'}
          </button>
        </div>
      </header>

      <CollapsibleSection title="Strategy" defaultOpen>
        <div className="preset-row">
          <label>
            Strategy
            <select value={presetId} onChange={(e) => handlePresetChange(e.target.value)}>
              {swingPresets.length > 0 && (
                <optgroup label="Swing trading">
                  {swingPresets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {generalPresets.length > 0 && (
                <optgroup label="General">
                  {generalPresets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {customPresets.length > 0 && (
                <optgroup label="Your presets">
                  {customPresets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </label>
          <label>
            Save as preset
            <input
              type="text"
              placeholder="My screen name"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="btn-secondary"
            disabled={!presetName.trim() || savingPreset}
            onClick={handleSavePreset}
          >
            {savingPreset ? 'Saving…' : 'Save preset'}
          </button>
        </div>

        {activePreset?.description && (
          <div className="strategy-description">{activePreset.description}</div>
        )}

        <div className="query-label-banner">
          Active screen: <strong>{meta?.queryLabel || queryLabel}</strong>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Screen rules" subtitle="Indicators & logic" defaultOpen={false}>
        <IndicatorBuilder
          catalog={catalog}
          query={query}
          onChange={(next) => {
            setQuery({ ...next, universe: query.universe || 'all' });
            setPresetId('');
          }}
          disabled={scanning}
        />
      </CollapsibleSection>

      <CollapsibleSection title="Scan settings" defaultOpen>
        <div className="screener-controls screener-controls-inset">
          <label>
            Date
            <select value={date} onChange={(e) => setDate(e.target.value)}>
              {dates.length === 0 && <option value={date}>{date}</option>}
              {dates.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>

          <label>
            Universe
            <select
              value={query.universe || 'all'}
              onChange={(e) => setQuery({ ...query, universe: e.target.value })}
              disabled={scanning}
            >
              {universes.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label} ({u.count})
                </option>
              ))}
            </select>
          </label>

          {meta && (
            <div className="screener-meta">
              <span>{meta.matchedCount ?? stocks.length} matched</span>
              <span>
                {meta.processedCount ?? status?.processed ?? 0} /{' '}
                {meta.totalScanned ?? status?.total ?? '—'} scanned
              </span>
              {meta.status === 'running' && <span className="live-badge">Live</span>}
              {meta.status === 'failed' && <span className="failed-badge">Partial</span>}
              {meta.completedAt && meta.status === 'complete' && (
                <span>Completed {new Date(meta.completedAt).toLocaleString('en-IN')}</span>
              )}
            </div>
          )}
        </div>
      </CollapsibleSection>

      {scanning && status?.running && (
        <CollapsibleSection title="Scan progress" defaultOpen badge={`${progressPct}%`}>
          <div className="screener-progress screener-progress-inset">
            <div className="screener-progress-bar">
              <div style={{ width: `${progressPct}%` }} />
            </div>
            <p>
              {status.phase === 'cache'
                ? `Building price history cache — ${status.cacheProgress?.done ?? 0}/${status.cacheProgress?.total ?? '?'} files`
                : `Scanning ${status.currentSymbol || '…'} — ${status.processed}/${status.total} (${progressPct}%) · ${status.matched} matched`}
            </p>
            <p className="hint">{status.queryLabel || queryLabel}</p>
          </div>
        </CollapsibleSection>
      )}

      <CollapsibleSection
        title="Results"
        defaultOpen
        badge={sorted.length > 0 ? `${sorted.length} stocks` : undefined}
      >
      {error && <div className="error-banner">{error}</div>}

      {!loading && !scanning && !meta && (
        <div className="empty">
          <p>No scan results for this screen on {date}.</p>
          <p className="hint">
            Customize indicators above, then click Run scan today. Matches appear
            live as the scan runs and are saved to disk immediately.
          </p>
        </div>
      )}

      {scanning && stocks.length === 0 && !loading && (
        <div className="empty">
          <p>Scan running… matches will appear in the table as they are found.</p>
        </div>
      )}

      {loading && !scanning ? (
        <div className="loading">Loading results…</div>
      ) : sorted.length > 0 ? (
        <>
        <div className="screener-table-wrap">
          <table className="screener-table">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th key={col.key}>
                    <button type="button" onClick={() => handleSort(col.key)}>
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
                  onClick={() => openDetails(row)}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`${col.numeric ? 'mono' : ''} ${
                        col.key.includes('pct') || col.key.includes('volRatio')
                          ? 'positive'
                          : ''
                      }`}
                    >
                      {formatCell(row, col)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="screener-pagination">
          <span className="screener-pagination-range">
            Showing {rangeStart}–{rangeEnd} of {sorted.length}
          </span>

          <label className="screener-pagination-size">
            Rows
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>

          <div className="screener-pagination-nav">
            <button
              type="button"
              className="btn-secondary"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <span className="screener-pagination-page">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              className="btn-secondary"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
        </>
      ) : null}
      </CollapsibleSection>

      {selected && (
        <div className="screener-detail-overlay" onClick={() => { setSelected(null); setDetails(null); }}>
          <div className="screener-detail-panel" onClick={(e) => e.stopPropagation()}>
            <header className="screener-detail-header">
              <div>
                <h2>{selected.symbol}</h2>
                <p>{selected.name}</p>
              </div>
              <button type="button" className="btn-secondary" onClick={() => { setSelected(null); setDetails(null); }}>
                Close
              </button>
            </header>

            {detailsLoading && <div className="loading">Loading details…</div>}
            {details?.error && <div className="error-banner">{details.error}</div>}

            {details && !details.error && (
              <div className="screener-detail-body">
                {selected.indicators && (
                  <CollapsibleSection title="Screen metrics" defaultOpen className="screener-detail-section">
                    <dl className="detail-grid">
                      {Object.entries(selected.indicators).flatMap(([id, metrics]) =>
                        Object.entries(metrics)
                          .filter(([k]) => !['matched', 'reason'].includes(k))
                          .map(([k, v]) => (
                            <Fragment key={`${id}-${k}`}>
                              <dt>{`${id}.${k}`}</dt>
                              <dd className="mono">
                                {typeof v === 'number' ? formatNum(v) : String(v)}
                              </dd>
                            </Fragment>
                          ))
                      )}
                    </dl>
                  </CollapsibleSection>
                )}

                <CollapsibleSection title="Overview" defaultOpen className="screener-detail-section">
                  <dl className="detail-grid">
                    <dt>Exchanges</dt>
                    <dd>{details.exchanges?.join(', ')}</dd>
                    <dt>Market cap</dt>
                    <dd>{formatMarketCapCr(selected.market_cap_cr ?? details.marketCapCr)}</dd>
                    <dt>ISIN</dt>
                    <dd>{details.isin || '—'}</dd>
                    <dt>Industry</dt>
                    <dd>{details.industry || '—'}</dd>
                  </dl>
                </CollapsibleSection>

                {details.scanHistory?.length > 0 && (
                  <CollapsibleSection
                    title="Daily scan history"
                    defaultOpen={false}
                    className="screener-detail-section"
                  >
                    <table className="screener-mini-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Close</th>
                        </tr>
                      </thead>
                      <tbody>
                        {details.scanHistory.map((h) => (
                          <tr key={h.date}>
                            <td>{h.date}</td>
                            <td className="mono">{formatNum(h.close)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CollapsibleSection>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
