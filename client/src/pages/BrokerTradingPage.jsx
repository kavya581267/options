import { useCallback, useEffect, useRef, useState } from 'react';
import CollapsibleSection from '../components/CollapsibleSection';
import StrategySidebar from '../components/trading/StrategySidebar';
import TradingConfigFields from '../components/trading/TradingConfigFields';
import LiveQuotePanel from '../components/LiveQuotePanel';
import SchedulePanel from '../components/SchedulePanel';
import ScheduleStatusBanner from '../components/trading/ScheduleStatusBanner';
import {
  DEFAULT_TRADING,
  DEFAULT_SCHEDULE,
  SYMBOLS,
  newStrategyDraft,
  strategyToDraft,
} from '../trading/constants';
import './TradingPage.css';

export default function BrokerTradingPage({
  brokerId,
  brokerName,
  api,
  strategyApi,
  renderSession,
  subtitle,
  docsLink,
  docsLabel,
  envHint,
  configuredWarn,
  unavailableMsg,
  onReady,
}) {
  const [cfg, setCfg] = useState(null);
  const [strategies, setStrategies] = useState([]);
  const [activeStrategyId, setActiveStrategyId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(newStrategyDraft());
  const [tab, setTab] = useState('trade');
  const [loggedIn, setLoggedIn] = useState(false);
  const [trade, setTrade] = useState(null);
  const [levels, setLevels] = useState(null);
  const [strike, setStrike] = useState('');
  const [entryPremium, setEntryPremium] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [savedMsg, setSavedMsg] = useState(null);
  const [monitorMsg, setMonitorMsg] = useState(null);
  const [liveQuote, setLiveQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [schedule, setSchedule] = useState(null);
  const [scheduleStatus, setScheduleStatus] = useState(null);
  const [scheduleForm, setScheduleForm] = useState({ ...DEFAULT_SCHEDULE });
  const [scheduleSaved, setScheduleSaved] = useState(false);
  const [liveTrade, setLiveTrade] = useState(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const readyCalled = useRef(false);

  const symbol = draft.trading.symbol;
  const isActive = selectedId === activeStrategyId;
  const tradeSymbol =
    isActive || !cfg
      ? symbol
      : cfg.activeStrategy?.trading?.symbol || symbol;

  const selectStrategy = useCallback((id, list, activeId) => {
    const s = list.find((x) => x.id === id);
    setSelectedId(id);
    setDraft(strategyToDraft(s));
    if (s?.schedule) {
      setScheduleForm((f) => ({ ...f, ...s.schedule }));
    }
    if (s?.trading?.symbol) {
      /* strike stays manual */
    }
  }, []);

  const refreshLive = useCallback(async () => {
    setLiveLoading(true);
    try {
      const { open } = await api.fetchOpenTrades();
      if (!open.length) {
        setLiveTrade(null);
        setLiveError(null);
        return;
      }
      const { symbol: sym, trade: t } = open[0];
      setTrade(t);
      setStrike(String(t.strike));
      setEntryPremium(String(t.entryPremium ?? ''));
      const live = await api.fetchLiveTrade(sym);
      setLiveTrade(live);
      setLiveError(null);
      if (live.open && live.quote) setLiveQuote(live.quote);
    } catch (e) {
      setLiveError(e.message);
    } finally {
      setLiveLoading(false);
    }
  }, [api]);

  const refresh = useCallback(async () => {
    const [c, s, sch] = await Promise.all([
      api.fetchConfig(),
      api.fetchSession(),
      api.fetchSchedule(),
    ]);
    setCfg(c);
    setStrategies(c.strategies || []);
    setActiveStrategyId(c.activeStrategyId);
    const sid = selectedId || c.activeStrategyId;
    if (sid && c.strategies?.length) {
      selectStrategy(sid, c.strategies, c.activeStrategyId);
    } else if (c.activeStrategy) {
      selectStrategy(c.activeStrategy.id, c.strategies, c.activeStrategyId);
    }
    setSchedule(sch.schedule);
    setScheduleStatus(sch);
    if (isActive || sid === c.activeStrategyId) {
      setScheduleForm((f) => ({ ...f, ...sch.schedule }));
    }
    setLoggedIn(s.loggedIn);
    if (s.loggedIn) {
      await refreshLive();
    } else {
      const sym = c.activeStrategy?.trading?.symbol || symbol;
      const t = await api.fetchTradeStatus(sym);
      setTrade(t.trade);
      setLiveTrade(null);
    }
  }, [api, refreshLive, selectStrategy, selectedId, isActive, symbol]);

  useEffect(() => {
    setLoadFailed(false);
    refresh().catch((e) => {
      setError(e.message);
      setLoadFailed(true);
    });
  }, []);

  useEffect(() => {
    if (cfg && onReady && !readyCalled.current) {
      readyCalled.current = true;
      onReady(run);
    }
  }, [cfg, onReady]);

  useEffect(() => {
    const p = entryPremium ? parseFloat(entryPremium) : trade?.entryPremium;
    if (!p || Number.isNaN(p)) {
      setLevels(null);
      return;
    }
    api.previewLevels(p).then((r) => setLevels(r.levels)).catch(() => {});
  }, [entryPremium, trade, api]);

  const run = async (fn) => {
    setBusy(true);
    setError(null);
    setMonitorMsg(null);
    setSavedMsg(null);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const saveStrategy = () =>
    run(async () => {
      if (!selectedId) return;
      await strategyApi.updateStrategy(selectedId, {
        name: draft.name,
        description: draft.description,
        trading: draft.trading,
        schedule: scheduleForm,
      });
      setSavedMsg('Strategy saved');
      setTimeout(() => setSavedMsg(null), 2500);
    });

  const activateStrategy = () =>
    run(async () => {
      await strategyApi.activateStrategy(selectedId);
      setSavedMsg('Strategy activated');
      setTimeout(() => setSavedMsg(null), 2500);
    });

  const createStrategy = () =>
    run(async () => {
      const { strategy } = await strategyApi.createStrategy(newStrategyDraft());
      setSelectedId(strategy.id);
      setDraft(strategyToDraft(strategy));
      setSavedMsg('Strategy created');
      setTimeout(() => setSavedMsg(null), 2500);
    });

  const deleteStrategy = () => {
    if (!selectedId || strategies.length <= 1) return;
    if (!window.confirm('Delete this strategy?')) return;
    run(async () => {
      await strategyApi.deleteStrategy(selectedId);
    });
  };

  const refreshQuote = useCallback(async () => {
    if (!loggedIn || !strike) return;
    setQuoteLoading(true);
    try {
      const q = await api.fetchStraddleQuote(tradeSymbol, Number(strike));
      setLiveQuote(q);
      setEntryPremium(String(q.straddlePremium.toFixed(2)));
    } catch (e) {
      setLiveQuote(null);
      setError(e.message);
    } finally {
      setQuoteLoading(false);
    }
  }, [loggedIn, tradeSymbol, strike, api]);

  useEffect(() => {
    if (!loggedIn || !strike || trade?.status === 'open') return;
    refreshQuote();
    const id = setInterval(refreshQuote, 30_000);
    return () => clearInterval(id);
  }, [loggedIn, tradeSymbol, strike, refreshQuote, trade?.status]);

  useEffect(() => {
    if (!loggedIn || trade?.status !== 'open') return;
    const id = setInterval(refreshLive, 15_000);
    return () => clearInterval(id);
  }, [loggedIn, trade?.status, refreshLive]);

  const loadTrackerAnchor = async () => {
    setBusy(true);
    setError(null);
    try {
      const { anchor } = await api.fetchTrackerAnchor(tradeSymbol);
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

  const fmt = (n) => (n != null ? `₹${Number(n).toFixed(2)}` : '—');

  if (!cfg) {
    return (
      <div className="kotak-page trading-page loading">
        {loadFailed ? (
          <>
            <p className="error-banner">{unavailableMsg}</p>
            {error && <p>{error}</p>}
          </>
        ) : (
          <p>Loading {brokerName}…</p>
        )}
      </div>
    );
  }

  const t = draft.trading;

  const savedSchedule = schedule || cfg?.activeStrategy?.schedule;
  const scheduleDirty =
    isActive &&
    savedSchedule &&
    ['enabled', 'entryTime', 'symbol', 'autoEnter', 'monitorIntervalSec', 'saveToTracker'].some(
      (k) => savedSchedule[k] !== scheduleForm[k]
    );

  const scheduleTabLabel = (() => {
    if (!schedule?.enabled) return 'Schedule';
    if (scheduleStatus?.executedToday) return 'Schedule ✓';
    return `Schedule · ${schedule.entryTime}`;
  })();

  return (
    <div className="kotak-page trading-page">
      <header className="header">
        <div>
          <h1>{brokerName}</h1>
          <p className="subtitle">{subtitle}</p>
        </div>
        <div className="header-badges">
          {schedule?.enabled ? (
            <span
              className={`badge schedule-badge ${
                scheduleStatus?.executedToday ? 'done' : 'armed'
              }`}
              title="Active strategy scheduled entry"
            >
              {scheduleStatus?.executedToday
                ? `Ran today ${schedule.entryTime}`
                : `Scheduled ${schedule.entryTime} IST`}
            </span>
          ) : (
            <span className="badge schedule-badge off">No schedule</span>
          )}
          <span className={`badge ${loggedIn ? 'open' : 'closed'}`}>
            {loggedIn ? 'Session active' : 'Not logged in'}
          </span>
        </div>
      </header>

      {docsLink && (
        <p className="kotak-hint">
          Docs:{' '}
          <a href={docsLink} target="_blank" rel="noreferrer">
            {docsLabel}
          </a>
          . {envHint}
        </p>
      )}

      {configuredWarn &&
        ((brokerId === 'kotak' && cfg.kotakConfigured === false) ||
          (brokerId === 'fyers' && cfg.fyersConfigured === false)) && (
          <p className="warn-banner">{configuredWarn}</p>
        )}

      <div className="trading-layout">
        <CollapsibleSection
          title="Strategies"
          defaultOpen
          className="trading-sidebar-section"
          badge={strategies.length ? `${strategies.length}` : undefined}
        >
          <StrategySidebar
            strategies={strategies}
            activeStrategyId={activeStrategyId}
            selectedId={selectedId}
            onSelect={(id) => selectStrategy(id, strategies, activeStrategyId)}
            onNew={createStrategy}
            busy={busy}
          />
        </CollapsibleSection>

        <div className="trading-main">
          <CollapsibleSection
            title="Login & session"
            defaultOpen={!loggedIn}
            badge={loggedIn ? 'Active' : 'Required'}
          >
            {renderSession?.({ loggedIn, busy, run })}
          </CollapsibleSection>

          <ScheduleStatusBanner
            schedule={schedule}
            scheduleStatus={scheduleStatus}
            activeStrategyName={cfg.activeStrategy?.name}
            hasUnsavedSchedule={scheduleDirty}
            brokerName={brokerName}
            onOpenSchedule={() => setTab('schedule')}
            onResetToday={
              scheduleStatus?.executedToday && api.resetScheduleToday
                ? () => run(() => api.resetScheduleToday())
                : null
            }
            busy={busy}
          />

          {!isActive && schedule?.enabled && (
            <p className="warn-banner">
              Viewing “{draft.name}” — the scheduler still uses active strategy “
              {cfg.activeStrategy?.name}” ({schedule.entryTime} IST, {schedule.symbol}
              ).
            </p>
          )}

          <CollapsibleSection title="Strategy" defaultOpen subtitle={draft.name}>
            <div className="strategy-header strategy-header-inset">
            <div className="strategy-header-top">
              <input
                className="strategy-name-input"
                value={draft.name}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, name: e.target.value }))
                }
                placeholder="Strategy name"
              />
              <div className="strategy-actions">
                {!isActive && (
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={busy}
                    onClick={activateStrategy}
                  >
                    Use this strategy
                  </button>
                )}
                <button type="button" disabled={busy} onClick={saveStrategy}>
                  Save strategy
                </button>
                {strategies.length > 1 && (
                  <button
                    type="button"
                    className="btn-danger"
                    disabled={busy}
                    onClick={deleteStrategy}
                  >
                    Delete
                  </button>
                )}
                {savedMsg && <span className="ok">{savedMsg}</span>}
              </div>
            </div>
            <textarea
              className="strategy-desc-input"
              value={draft.description}
              onChange={(e) =>
                setDraft((d) => ({ ...d, description: e.target.value }))
              }
              placeholder="Description — when to use this, index, risk notes…"
              rows={2}
            />
            <div className="strategy-summary">
              <span>
                {t.symbol} · {t.side} · {t.lots} lot{t.lots > 1 ? 's' : ''} ·{' '}
                {t.product}
              </span>
              <span>
                SL {t.slType === 'percent' ? `${t.slValue}%` : `₹${t.slValue}`} · Target{' '}
                {t.targetType === 'percent' ? `${t.targetValue}%` : `₹${t.targetValue}`}
              </span>
              {!isActive && (
                <span className="muted">Not active — scheduler uses the active strategy only</span>
              )}
            </div>
          </div>
          </CollapsibleSection>

          <nav className="tab-nav">
            {['trade', 'setup', 'schedule'].map((id) => (
              <button
                key={id}
                type="button"
                className={`tab-btn ${tab === id ? 'active' : ''} ${
                  id === 'schedule' && schedule?.enabled ? 'has-schedule' : ''
                }`}
                onClick={() => setTab(id)}
              >
                {id === 'trade'
                  ? 'Trade & live'
                  : id === 'setup'
                    ? 'Parameters'
                    : scheduleTabLabel}
              </button>
            ))}
          </nav>

          {tab === 'setup' && (
            <CollapsibleSection title="Trading parameters" defaultOpen>
              <p className="kotak-hint">
                Saved with this strategy. Activate the strategy to apply to orders and the
                scheduler.
              </p>
              <TradingConfigFields
                broker={brokerId}
                trading={draft.trading}
                onChange={(updater) =>
                  setDraft((d) => ({ ...d, trading: updater(d.trading) }))
                }
              />
              <div className="kotak-row" style={{ marginTop: '0.75rem' }}>
                <button type="button" disabled={busy} onClick={saveStrategy}>
                  Save parameters
                </button>
              </div>
            </CollapsibleSection>
          )}

          {tab === 'schedule' && (
            <CollapsibleSection title="Schedule" defaultOpen badge={schedule?.enabled ? schedule.entryTime : 'Off'}>
            <SchedulePanel
              brokerName={brokerName}
              activeStrategyName={cfg.activeStrategy?.name}
              schedule={schedule}
              scheduleStatus={scheduleStatus}
              scheduleForm={scheduleForm}
              setScheduleForm={setScheduleForm}
              busy={busy}
              saved={scheduleSaved}
              onSave={() =>
                run(async () => {
                  setDraft((d) => ({ ...d, schedule: scheduleForm }));
                  await strategyApi.updateStrategy(selectedId, {
                    name: draft.name,
                    description: draft.description,
                    trading: draft.trading,
                    schedule: scheduleForm,
                  });
                  if (isActive) {
                    await api.saveSchedule(scheduleForm);
                  }
                  setScheduleSaved(true);
                  setTimeout(() => setScheduleSaved(false), 2500);
                })
              }
              onRunNow={() => run(() => api.runScheduleNow(true))}
            />
            </CollapsibleSection>
          )}

          {tab === 'trade' && (
            <>
              <CollapsibleSection title="Live quote" defaultOpen badge={tradeSymbol}>
              <LiveQuotePanel
                brokerName={brokerName}
                loggedIn={loggedIn}
                strike={strike}
                quote={liveTrade?.open ? liveTrade.quote : liveQuote}
                metrics={liveTrade?.open ? liveTrade.metrics : null}
                trade={trade?.status === 'open' ? trade : null}
                levels={trade?.status !== 'open' && levels ? levels : null}
                loading={quoteLoading || liveLoading}
                error={liveError || null}
                onRefresh={refreshQuote}
                refreshDisabled={
                  busy || quoteLoading || liveLoading || !loggedIn || !strike
                }
              />
              </CollapsibleSection>

              <CollapsibleSection title="Execute trade" defaultOpen>
              <p className="kotak-hint">
                Uses active strategy config ({cfg.activeStrategy?.name || '—'}). Symbol:{' '}
                <strong>{isActive ? symbol : cfg.activeStrategy?.trading?.symbol}</strong>
                {!isActive && ' — activate this strategy to trade with its parameters.'}
              </p>
              <div className="kotak-row">
                  <label>
                    Symbol
                    <select
                      value={symbol}
                      disabled={!isActive}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          trading: { ...d.trading, symbol: e.target.value },
                        }))
                      }
                    >
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
                    />
                  </label>
                  <button type="button" disabled={busy} onClick={loadTrackerAnchor}>
                    Use tracker 9:15 anchor
                  </button>
                </div>
                <div className="kotak-row actions">
                  <button
                    type="button"
                    disabled={
                      busy || !loggedIn || trade?.status === 'open' || !isActive
                    }
                    onClick={() =>
                      run(() =>
                        api.enter(
                          tradeSymbol,
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
                    onClick={() => run(() => api.exit(tradeSymbol))}
                  >
                    Exit straddle
                  </button>
                  <button
                    type="button"
                    disabled={busy || trade?.status !== 'open'}
                    onClick={() =>
                      run(async () => {
                        const r = await api.monitor(
                          tradeSymbol,
                          liveTrade?.metrics?.currentPremium ??
                            liveQuote?.straddlePremium
                        );
                        if (r.hit) {
                          setMonitorMsg(`Exited: ${r.hit} @ ${fmt(r.currentPremium)}`);
                        } else {
                          setMonitorMsg(
                            `Premium ${fmt(r.currentPremium)} — no exit`
                          );
                        }
                      })
                    }
                  >
                    Check SL / target
                  </button>
                </div>
                {monitorMsg && <p className="monitor-msg">{monitorMsg}</p>}
              </CollapsibleSection>
            </>
          )}
        </div>
      </div>

      {error && <p className="error-banner">{error}</p>}
    </div>
  );
}
