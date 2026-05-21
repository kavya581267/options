import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchDayData,
  fetchDates,
  fetchHealth,
  triggerFetch,
} from '../api';
import Filters from '../components/Filters';
import DayStats from '../components/DayStats';
import StraddleChart from '../components/StraddleChart';

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
    if (!filtered.length) return stats;
    const premiums = filtered.map((r) => r.straddlePremium);
    return {
      ...stats,
      premiumHigh: Math.max(...premiums),
      premiumLow: Math.min(...premiums),
      count: filtered.length,
    };
  }, [filtered, stats]);

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

  return (
    <>
      <header className="header">
        <div>
          <h1>Straddle Tracker</h1>
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

      {error && <div className="error-banner">{error}</div>}

      <DayStats
        stats={filteredStats}
        symbol={symbol}
        date={date}
        anchor={anchor}
      />

      {symbol === 'SENSEX' && !anchor && date === todayIST() && (
        <p className="warn-banner">
          SENSEX needs Kotak login (TOTP + MPIN on the Kotak page). BSE data is
          blocked — use Fetch now during market hours to set today&apos;s anchor
          from current quotes.
        </p>
      )}

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
    </>
  );
}
