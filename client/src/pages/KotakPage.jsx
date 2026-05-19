import { useCallback, useEffect, useState } from 'react';
import {
  fetchTradeStatus,
  fetchTrackerAnchor,
  fetchTradingConfig,
  fetchTradingSession,
  kotakLoginMpin,
  kotakLoginTotp,
  kotakLogout,
  previewLevels,
  tradingEnter,
  tradingExit,
  tradingMonitor,
  fetchStraddleQuote,
  saveTradingConfig,
  fetchOpenTrades,
  fetchLiveTrade,
  fetchSchedule,
  saveSchedule,
  runScheduleNow,
} from '../api/trading';
import KotakConfigForm from '../components/KotakConfigForm';
import SavedConfigPanel from '../components/SavedConfigPanel';
import LiveQuotePanel from '../components/LiveQuotePanel';
import SchedulePanel from '../components/SchedulePanel';

const DEFAULT_TRADING = {
  symbol: 'NIFTY',
  side: 'SELL',
  lots: 1,
  product: 'MIS',
  useBracketOrder: false,
  slType: 'percent',
  slValue: 20,
  targetType: 'percent',
  targetValue: 30,
};

import './KotakPage.css';

const SYMBOLS = ['NIFTY', 'SENSEX'];

export default function KotakPage() {
  const [cfg, setCfg] = useState(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [trade, setTrade] = useState(null);
  const [levels, setLevels] = useState(null);
  const [symbol, setSymbol] = useState('NIFTY');
  const [strike, setStrike] = useState('');
  const [entryPremium, setEntryPremium] = useState('');
  const [totp, setTotp] = useState('');
  const [mpin, setMpin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [monitorMsg, setMonitorMsg] = useState(null);
  const [liveQuote, setLiveQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [tradingForm, setTradingForm] = useState(DEFAULT_TRADING);
  const [configSaved, setConfigSaved] = useState(false);
  const [schedule, setSchedule] = useState(null);
  const [scheduleStatus, setScheduleStatus] = useState(null);
  const [scheduleForm, setScheduleForm] = useState({
    enabled: false,
    entryTime: '09:15',
    symbol: 'NIFTY',
    autoEnter: true,
    monitorIntervalSec: 30,
    saveToTracker: true,
  });
  const [scheduleSaved, setScheduleSaved] = useState(false);
  const [liveTrade, setLiveTrade] = useState(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);

  const refreshLive = useCallback(async () => {
    setLiveLoading(true);
    try {
      const { open } = await fetchOpenTrades();
      if (!open.length) {
        setLiveTrade(null);
        setLiveError(null);
        return;
      }
      const { symbol: sym, trade: t } = open[0];
      setTrade(t);
      setSymbol(sym);
      setStrike(String(t.strike));
      setEntryPremium(String(t.entryPremium ?? ''));
      const live = await fetchLiveTrade(sym);
      setLiveTrade(live);
      setLiveError(null);
      if (live.open && live.quote) setLiveQuote(live.quote);
    } catch (e) {
      setLiveError(e.message);
    } finally {
      setLiveLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    const [c, s, sch] = await Promise.all([
      fetchTradingConfig(),
      fetchTradingSession(),
      fetchSchedule(),
    ]);
    setCfg(c);
    setTradingForm({ ...DEFAULT_TRADING, ...c.trading });
    setSchedule(sch.schedule);
    setScheduleStatus(sch);
    setScheduleForm((f) => ({ ...f, ...sch.schedule }));
    setLoggedIn(s.loggedIn);
    if (s.loggedIn) {
      await refreshLive();
    } else {
      const t = await fetchTradeStatus(symbol);
      setTrade(t.trade);
      setLiveTrade(null);
    }
  }, [symbol, refreshLive]);

  useEffect(() => {
    setLoadFailed(false);
    refresh()
      .catch((e) => {
        setError(e.message);
        setLoadFailed(true);
      });
  }, [refresh]);

  useEffect(() => {
    const p = entryPremium ? parseFloat(entryPremium) : trade?.entryPremium;
    if (!p || Number.isNaN(p)) {
      setLevels(null);
      return;
    }
    previewLevels(p).then((r) => setLevels(r.levels)).catch(() => {});
  }, [entryPremium, trade]);

  const run = async (fn) => {
    setBusy(true);
    setError(null);
    setMonitorMsg(null);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const refreshQuote = useCallback(async () => {
    if (!loggedIn || !strike) return;
    setQuoteLoading(true);
    try {
      const q = await fetchStraddleQuote(symbol, Number(strike));
      setLiveQuote(q);
      setEntryPremium(String(q.straddlePremium.toFixed(2)));
    } catch (e) {
      setLiveQuote(null);
      setError(e.message);
    } finally {
      setQuoteLoading(false);
    }
  }, [loggedIn, symbol, strike]);

  useEffect(() => {
    if (!loggedIn || !strike) return;
    if (trade?.status === 'open') return;
    refreshQuote();
    const id = setInterval(refreshQuote, 30_000);
    return () => clearInterval(id);
  }, [loggedIn, symbol, strike, refreshQuote, trade?.status]);

  useEffect(() => {
    if (!loggedIn || trade?.status !== 'open') return;
    const id = setInterval(refreshLive, 15_000);
    return () => clearInterval(id);
  }, [loggedIn, trade?.status, refreshLive]);

  const loadTrackerAnchor = async () => {
    setBusy(true);
    setError(null);
    try {
      const { anchor } = await fetchTrackerAnchor(symbol);
      if (!anchor) {
        setError('No 9:15 anchor for today in tracker. Capture data first.');
        return;
      }
      setStrike(String(anchor.strike));
      setEntryPremium(String(anchor.straddlePremium ?? ''));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!cfg) {
    return (
      <div className="kotak-page loading">
        {loadFailed ? (
          <>
            <p className="error-banner">
              Kotak API unavailable. Restart the server and confirm the terminal
              shows: Kotak trading API: /api/trading
            </p>
            {error && <p>{error}</p>}
          </>
        ) : (
          <p>Loading Kotak…</p>
        )}
      </div>
    );
  }

  const fmt = (n) => (n != null ? `₹${Number(n).toFixed(2)}` : '—');

  return (
    <div className="kotak-page">
      <header className="header">
        <div>
          <h1>Kotak Neo — Straddle</h1>
          <p className="subtitle">
            Login, enter straddle at strike, SL/target on total premium. Separate
            from the tracker — uses today&apos;s anchor optionally.
          </p>
        </div>
        <span className={`badge ${loggedIn ? 'open' : 'closed'}`}>
          {loggedIn ? 'Session active' : 'Not logged in'}
        </span>
      </header>

      <p className="kotak-hint">
        Docs:{' '}
        <a
          href="https://1q09.github.io/Kotak-neo-api-v2/?theme=light#login-with-totp"
          target="_blank"
          rel="noreferrer"
        >
          Kotak Neo API v2
        </a>
        . Set <code>KOTAK_*</code> in <code>server/.env</code>.
      </p>

      {!cfg.kotakConfigured && (
        <p className="warn-banner">Set KOTAK_ACCESS_TOKEN in server/.env</p>
      )}

      <section className="kotak-section">
        <h2 className="section-title">Session</h2>
        {!loggedIn ? (
          <div className="kotak-row">
            <input
              type="text"
              inputMode="numeric"
              placeholder="6-digit TOTP"
              value={totp}
              onChange={(e) => setTotp(e.target.value)}
              maxLength={6}
            />
            <button
              type="button"
              disabled={busy || totp.length < 6}
              onClick={() => run(() => kotakLoginTotp(totp))}
            >
              Login TOTP
            </button>
            <input
              type="password"
              inputMode="numeric"
              placeholder="MPIN"
              value={mpin}
              onChange={(e) => setMpin(e.target.value)}
              maxLength={6}
            />
            <button
              type="button"
              disabled={busy || mpin.length < 4}
              onClick={() => run(() => kotakLoginMpin(mpin))}
            >
              Validate MPIN
            </button>
          </div>
        ) : (
          <div className="kotak-row">
            <span className="ok">Kotak trade session ready</span>
            <button type="button" disabled={busy} onClick={() => run(kotakLogout)}>
              Logout
            </button>
          </div>
        )}
      </section>

      <LiveQuotePanel
        loggedIn={loggedIn}
        strike={strike}
        quote={liveTrade?.open ? liveTrade.quote : liveQuote}
        metrics={liveTrade?.open ? liveTrade.metrics : null}
        trade={trade?.status === 'open' ? trade : null}
        levels={trade?.status !== 'open' && levels ? levels : null}
        loading={quoteLoading || liveLoading}
        error={liveError || null}
        onRefresh={refreshQuote}
        refreshDisabled={busy || quoteLoading || liveLoading || !loggedIn || !strike}
      />

      <SavedConfigPanel
        trading={cfg.trading}
        configSource={cfg.configSource}
      />

      <KotakConfigForm
        tradingForm={tradingForm}
        setTradingForm={setTradingForm}
        busy={busy}
        configSaved={configSaved}
        onSave={() =>
          run(async () => {
            await saveTradingConfig(tradingForm);
            setConfigSaved(true);
            setTimeout(() => setConfigSaved(false), 2500);
          })
        }
      />

      <SchedulePanel
        schedule={schedule}
        scheduleStatus={scheduleStatus}
        scheduleForm={scheduleForm}
        setScheduleForm={setScheduleForm}
        busy={busy}
        saved={scheduleSaved}
        onSave={() =>
          run(async () => {
            await saveSchedule(scheduleForm);
            setScheduleSaved(true);
            setTimeout(() => setScheduleSaved(false), 2500);
          })
        }
        onRunNow={() =>
          run(async () => {
            await runScheduleNow(true);
          })
        }
      />

      <section className="kotak-section">
        <h2 className="section-title">Trade</h2>
        <div className="kotak-row">
          <label>
            Symbol
            <select value={symbol} onChange={(e) => setSymbol(e.target.value)}>
              {SYMBOLS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label>
            Strike
            <input
              type="number"
              value={strike}
              onChange={(e) => setStrike(e.target.value)}
              placeholder="e.g. 23500"
            />
          </label>
          <label>
            Entry premium
            <input
              type="number"
              step="0.05"
              value={entryPremium}
              onChange={(e) => setEntryPremium(e.target.value)}
              placeholder="Total CE+PE"
            />
          </label>
          <button type="button" disabled={busy} onClick={loadTrackerAnchor}>
            Use tracker 9:15 anchor
          </button>
        </div>

        <div className="kotak-row actions">
          <button
            type="button"
            disabled={busy || !loggedIn || trade?.status === 'open'}
            onClick={() =>
              run(() =>
                tradingEnter(
                  symbol,
                  strike ? Number(strike) : undefined,
                  entryPremium ? Number(entryPremium) : undefined
                )
              )
            }
          >
            Enter straddle
          </button>
          <button
            type="button"
            disabled={busy || !loggedIn || trade?.status !== 'open'}
            onClick={() => run(() => tradingExit(symbol))}
          >
            Exit straddle
          </button>
          <button
            type="button"
            disabled={busy || trade?.status !== 'open'}
            onClick={() =>
              run(async () => {
                const r = await tradingMonitor(
                  symbol,
                  liveTrade?.metrics?.currentPremium ?? liveQuote?.straddlePremium
                );
                if (r.hit) setMonitorMsg(`Exited: ${r.hit} @ ${fmt(r.currentPremium)}`);
                else setMonitorMsg(`Premium ${fmt(r.currentPremium)} — no exit`);
              })
            }
          >
            Check SL / target
          </button>
        </div>

        {monitorMsg && <p className="monitor-msg">{monitorMsg}</p>}
      </section>

      {error && <p className="error-banner">{error}</p>}
    </div>
  );
}
