import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchDayData,
  fetchDates,
  fetchHealth,
  triggerFetch,
} from '../api';
import CollapsibleSection from '../components/CollapsibleSection';
import Filters from '../components/Filters';
import DayStats from '../components/DayStats';
import StraddleChart from '../components/StraddleChart';
import './TrackerPage.css';

const SYMBOLS = ['NIFTY', 'SENSEX'];

function todayIST() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
  }).format(new Date());
}

export default function TrackerPage() {
  const [symbol, setSymbol] = useState('NIFTY');
  const [date, setDate] = useState(todayIST());
  const [dates, setDates] = useState([]);
  const [anchor, setAnchor] = useState(null);
  const [readings, setReadings] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [marketOpen, setMarketOpen] = useState(false);
  const [timeFrom, setTimeFrom] = useState('');
  const [timeTo, setTimeTo] = useState('');
  const [fetching, setFetching] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const health = await fetchHealth();
      setMarketOpen(health.marketOpen);
      const data = await fetchDayData(symbol, date);
      setAnchor(data.anchor || null);
      setReadings(data.readings || []);
      setStats(data.stats || null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [symbol, date]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { dates: d } = await fetchDates(symbol);
      if (cancelled) return;
      setDates(d);
      setDate((current) => {
        if (d.includes(current)) return current;
        return d.length ? d[0] : current;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  useEffect(() => {
    loadData();
    const id = setInterval(loadData, 60_000);
    return () => clearInterval(id);
  }, [loadData]);

  const filtered = useMemo(() => {
    return readings.filter((r) => {
      const t = r.time?.slice(0, 5) ?? r.time;
      if (timeFrom && t < timeFrom) return false;
      if (timeTo && t > timeTo) return false;
      return true;
    });
  }, [readings, timeFrom, timeTo]);

  const filteredStats = useMemo(() => {
    const lotSize = symbol === 'NIFTY' ? 65 : symbol === 'SENSEX' ? 20 : 1;

    const entryReading = readings.find(
      (r) => r.time && r.time >= '09:20:00'
    );
    const entryPremium = entryReading ? entryReading.straddlePremium : null;

    // 9:20 - 3:00 range
    const range300 = readings.filter(
      (r) => r.time && r.time >= '09:20:00' && r.time <= '15:00:00'
    );
    const premiums300 = range300.map((r) => r.straddlePremium);
    const high300 = premiums300.length ? Math.max(...premiums300) : null;
    const low300 = premiums300.length ? Math.min(...premiums300) : null;

    // 9:20 - 3:25 range
    const range325 = readings.filter(
      (r) => r.time && r.time >= '09:20:00' && r.time <= '15:25:00'
    );
    const premiums325 = range325.map((r) => r.straddlePremium);
    const high325 = premiums325.length ? Math.max(...premiums325) : null;
    const low325 = premiums325.length ? Math.min(...premiums325) : null;

    const entryAmount = entryPremium != null ? entryPremium * lotSize : null;

    const maxLoss300 = (high300 != null && entryPremium != null)
      ? Math.max(0, high300 - entryPremium) * lotSize
      : null;
    const maxGain300 = (low300 != null && entryPremium != null)
      ? Math.max(0, entryPremium - low300) * lotSize
      : null;

    const maxLoss325 = (high325 != null && entryPremium != null)
      ? Math.max(0, high325 - entryPremium) * lotSize
      : null;
    const maxGain325 = (low325 != null && entryPremium != null)
      ? Math.max(0, entryPremium - low325) * lotSize
      : null;

    if (!filtered.length) {
      return {
        ...stats,
        entryPremium,
        lotSize,
        entryAmount,
        high300,
        low300,
        maxLoss300,
        maxGain300,
        high325,
        low325,
        maxLoss325,
        maxGain325,
      };
    }
    const premiums = filtered.map((r) => r.straddlePremium);
    return {
      ...stats,
      premiumHigh: Math.max(...premiums),
      premiumLow: Math.min(...premiums),
      count: filtered.length,
      entryPremium,
      lotSize,
      entryAmount,
      high300,
      low300,
      maxLoss300,
      maxGain300,
      high325,
      low325,
      maxLoss325,
      maxGain325,
    };
  }, [filtered, readings, stats, symbol]);

  const handleManualFetch = async () => {
    setFetching(true);
    setError(null);
    try {
      const result = await triggerFetch({ symbols: [symbol], forceAnchor: true });
      const row = result.results?.find((r) => r.symbol === symbol);
      if (row?.skipped) {
        setError(row.reason || 'Fetch skipped');
      } else if (row?.error) {
        setError(row.error);
      } else if (row?.success === false) {
        setError(row.error || 'Fetch failed');
      }
      await loadData();
    } catch (e) {
      setError(e.message);
    } finally {
      setFetching(false);
    }
  };

  const anchorStrike = anchor?.strike ?? stats?.anchorStrike;
  const anchorSpot = anchor?.spot ?? stats?.anchorSpot;

  const isExpiryDay = useMemo(() => {
    if (!date) return false;
    const [yr, mo, dy] = date.split('-').map(Number);
    const d = new Date(yr, mo - 1, dy);
    const dayOfWeek = d.getDay();
    if (symbol === 'NIFTY' && dayOfWeek === 2) return true;
    if (symbol === 'SENSEX' && dayOfWeek === 4) return true;
    return false;
  }, [date, symbol]);

  return (
    <div className="tracker-page">
      <header className="header tracker-header">
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            Straddle Tracker
            {isExpiryDay && (
              <span className="badge expiry-badge" style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)', color: 'var(--red)', border: '1px solid rgba(239, 68, 68, 0.3)', fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: '6px', fontWeight: '600', animation: 'pulse 2s infinite', display: 'inline-flex', alignItems: 'center' }}>
                ⚡ {symbol} Expiry Day
              </span>
            )}
          </h1>
          <p className="subtitle">
            9:15 spot sets the strike — minute-by-minute straddle premium at that
            strike
          </p>
        </div>
        <div className="header-actions">
          <span className={`badge ${marketOpen ? 'open' : 'closed'}`}>
            {marketOpen ? 'Market open' : 'Market closed'}
          </span>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleManualFetch}
            disabled={fetching}
          >
            {fetching ? 'Fetching…' : 'Fetch now'}
          </button>
        </div>
      </header>

      <CollapsibleSection title="Filters" defaultOpen subtitle={`${symbol} · ${date}`}>
        <Filters
          symbols={SYMBOLS}
          symbol={symbol}
          onSymbolChange={setSymbol}
          date={date}
          onDateChange={setDate}
          dates={dates}
          timeFrom={timeFrom}
          timeTo={timeTo}
          onTimeFromChange={setTimeFrom}
          onTimeToChange={setTimeTo}
        />
      </CollapsibleSection>

      {error && <div className="error-banner">{error}</div>}

      <CollapsibleSection
        title="Day statistics"
        defaultOpen
        badge={filteredStats?.count ? `${filteredStats.count} readings` : undefined}
      >
        <DayStats
          stats={filteredStats}
          symbol={symbol}
          date={date}
          anchor={anchor}
        />

        {symbol === 'SENSEX' && !anchor && date === todayIST() && (
          <p className="warn-banner tracker-warn">
            SENSEX needs Kotak login (TOTP + MPIN on the Kotak page). BSE data is
            blocked — use Fetch now during market hours to set today&apos;s anchor
            from current quotes.
          </p>
        )}
      </CollapsibleSection>

      <CollapsibleSection
        title="Straddle chart"
        defaultOpen
        badge={filtered.length ? `${filtered.length} points` : undefined}
      >
        {loading ? (
          <div className="loading">Loading data…</div>
        ) : filtered.length === 0 ? (
          <div className="empty">
            <p>
              No readings for {symbol} on {date}.
            </p>
            <p className="hint">
              Anchor is set at 9:15 IST (or on first successful fetch after 9:20).
              Then straddle premium is recorded every minute until 15:30. Click
              Fetch now to capture from current market data.
            </p>
          </div>
        ) : (
          <StraddleChart
            data={filtered}
            symbol={symbol}
            anchorStrike={anchorStrike}
            anchorSpot={anchorSpot}
          />
        )}
      </CollapsibleSection>
    </div>
  );
}
