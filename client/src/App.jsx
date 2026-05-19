import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchDayData,
  fetchDates,
  fetchHealth,
  triggerFetch,
} from './api';
import Filters from './components/Filters';
import DayStats from './components/DayStats';
import StraddleChart from './components/StraddleChart';
import './App.css';

const SYMBOLS = ['NIFTY', 'SENSEX'];

function todayIST() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
  }).format(new Date());
}

export default function App() {
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

  // Only reset date when symbol changes — not when user picks a new date
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
    try {
      await triggerFetch();
      await loadData();
    } catch (e) {
      setError(e.message);
    } finally {
      setFetching(false);
    }
  };

  const anchorStrike = anchor?.strike ?? stats?.anchorStrike;

  return (
    <div className="app">
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

      {loading ? (
        <div className="loading">Loading data…</div>
      ) : filtered.length === 0 ? (
        <div className="empty">
          <p>No readings for {symbol} on {date}.</p>
          <p className="hint">
            Server captures spot + strike at 9:15 IST, then straddle premium
            every minute until 15:30.
          </p>
        </div>
      ) : (
        <StraddleChart
          data={filtered}
          symbol={symbol}
          anchorStrike={anchorStrike}
        />
      )}
    </div>
  );
}
