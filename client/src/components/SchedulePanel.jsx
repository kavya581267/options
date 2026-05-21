import './SchedulePanel.css';

export default function SchedulePanel({
  schedule,
  scheduleStatus,
  scheduleForm,
  setScheduleForm,
  busy,
  saved,
  onSave,
  onRunNow,
}) {
  const snap = schedule?.lastSnapshot;

  return (
    <section className="kotak-section schedule-panel">
      <h2 className="section-title">Scheduled entry (IST)</h2>
      <p className="kotak-hint">
        At your chosen time: fetch spot → ATM strike → straddle premium. Optionally
        place Kotak orders and monitor SL/target every{' '}
        {scheduleForm.monitorIntervalSec}s. Retries for 5 minutes if the first
        attempt fails.
      </p>

      {scheduleForm.symbol === 'SENSEX' && (
        <p className="warn-banner schedule-warn">
          SENSEX uses Kotak quotes only (BSE website API is blocked). Log in with
          TOTP + MPIN on this page before the scheduled time.
        </p>
      )}

      <label className="checkbox-label schedule-enable">
        <input
          type="checkbox"
          checked={scheduleForm.enabled}
          onChange={(e) =>
            setScheduleForm((f) => ({ ...f, enabled: e.target.checked }))
          }
        />
        Enable scheduled entry
      </label>

      <div className="config-form">
        <label>
          Entry time (IST)
          <input
            type="time"
            value={scheduleForm.entryTime}
            onChange={(e) =>
              setScheduleForm((f) => ({ ...f, entryTime: e.target.value }))
            }
          />
        </label>
        <label>
          Symbol
          <select
            value={scheduleForm.symbol}
            onChange={(e) =>
              setScheduleForm((f) => ({ ...f, symbol: e.target.value }))
            }
          >
            <option value="NIFTY">NIFTY</option>
            <option value="SENSEX">SENSEX</option>
          </select>
        </label>
        <label>
          Monitor interval (sec)
          <input
            type="number"
            min={15}
            max={60}
            value={scheduleForm.monitorIntervalSec}
            onChange={(e) =>
              setScheduleForm((f) => ({
                ...f,
                monitorIntervalSec: parseInt(e.target.value, 10) || 30,
              }))
            }
          />
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={scheduleForm.autoEnter}
            onChange={(e) =>
              setScheduleForm((f) => ({ ...f, autoEnter: e.target.checked }))
            }
          />
          Auto-enter straddle on Kotak (needs login)
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={scheduleForm.saveToTracker}
            onChange={(e) =>
              setScheduleForm((f) => ({ ...f, saveToTracker: e.target.checked }))
            }
          />
          Save as tracker 9:15 anchor for the day
        </label>
      </div>

      <div className="kotak-row">
        <button type="button" disabled={busy} onClick={onSave}>
          Save schedule
        </button>
        <button
          type="button"
          className="btn-secondary-schedule"
          disabled={busy}
          onClick={onRunNow}
        >
          Run now (test)
        </button>
        {saved && <span className="ok">Schedule saved</span>}
      </div>

      {scheduleStatus?.lastError && (
        <p className="error-banner schedule-error">
          Last run failed
          {scheduleStatus.lastErrorAt
            ? ` (${new Date(scheduleStatus.lastErrorAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST)`
            : ''}
          : {scheduleStatus.lastError}
          {scheduleStatus.loggedIn && !scheduleStatus.executedToday && (
            <> — Kotak is logged in now; use Run now to retry and clear this.</>
          )}
        </p>
      )}

      {scheduleStatus && (
        <div className="schedule-status">
          <span>
            {scheduleStatus.executedToday
              ? 'Executed today'
              : scheduleForm.enabled
                ? `Armed for ${scheduleForm.entryTime} IST`
                : 'Disabled'}
          </span>
          {scheduleStatus.loggedIn ? (
            <span className="ok">Kotak logged in</span>
          ) : (
            <span className="muted">Kotak not logged in</span>
          )}
          {scheduleStatus.marketOpen ? (
            <span className="ok">Market open</span>
          ) : (
            <span className="muted">Market closed</span>
          )}
        </div>
      )}

      {snap && (
        <div className="schedule-snapshot kotak-grid">
          <div className="kotak-card">
            <span className="label">Last run</span>
            <span>
              {snap.date} {snap.time}
            </span>
          </div>
          <div className="kotak-card">
            <span className="label">Spot</span>
            <span>{snap.spot}</span>
          </div>
          <div className="kotak-card">
            <span className="label">Strike</span>
            <span>{snap.strike}</span>
          </div>
          <div className="kotak-card highlight">
            <span className="label">Straddle</span>
            <span>₹{Number(snap.straddlePremium).toFixed(2)}</span>
          </div>
        </div>
      )}
    </section>
  );
}
