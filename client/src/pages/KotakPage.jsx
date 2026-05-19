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
} from '../api/trading';
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

  const refresh = useCallback(async () => {
    const [c, s, t] = await Promise.all([
      fetchTradingConfig(),
      fetchTradingSession(),
      fetchTradeStatus(symbol),
    ]);
    setCfg(c);
    setLoggedIn(s.loggedIn);
    setTrade(t.trade);
  }, [symbol]);

  useEffect(() => {
    refresh().catch((e) => setError(e.message));
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
    return <div className="kotak-page loading">Loading Kotak…</div>;
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

      <section className="kotak-section">
        <h2 className="section-title">Config</h2>
        <div className="kotak-grid">
          <div className="kotak-card">
            <span className="label">Side</span>
            <span>{cfg.trading.side} straddle</span>
          </div>
          <div className="kotak-card">
            <span className="label">Lots</span>
            <span>{cfg.trading.lots}</span>
          </div>
          <div className="kotak-card">
            <span className="label">Product</span>
            <span>{cfg.trading.product}</span>
          </div>
          <div className="kotak-card">
            <span className="label">Stop loss</span>
            <span>
              {cfg.trading.slType === 'percent'
                ? `${cfg.trading.slValue}%`
                : `₹${cfg.trading.slValue}`}
            </span>
          </div>
          <div className="kotak-card">
            <span className="label">Target</span>
            <span>
              {cfg.trading.targetType === 'percent'
                ? `${cfg.trading.targetValue}%`
                : `₹${cfg.trading.targetValue}`}
            </span>
          </div>
        </div>
      </section>

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

        {levels && (
          <div className="levels-preview">
            <span>SL {fmt(levels.stopLoss)}</span>
            <span>Entry {fmt(levels.entryPremium)}</span>
            <span>Target {fmt(levels.target)}</span>
          </div>
        )}

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
                const r = await tradingMonitor(symbol);
                if (r.hit) setMonitorMsg(`Exited: ${r.hit} @ ${fmt(r.currentPremium)}`);
                else setMonitorMsg(`Premium ${fmt(r.currentPremium)} — no exit`);
              })
            }
          >
            Check SL / target
          </button>
        </div>

        {trade?.status === 'open' && (
          <div className="kotak-card open-trade">
            <p>
              Open {trade.side} @ strike {trade.strike}, entry{' '}
              {fmt(trade.entryPremium)}
            </p>
            <p className="mono">
              CE order {trade.orders?.ce} · PE order {trade.orders?.pe}
            </p>
          </div>
        )}
        {monitorMsg && <p className="monitor-msg">{monitorMsg}</p>}
      </section>

      {error && <p className="error-banner">{error}</p>}
    </div>
  );
}
