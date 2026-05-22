import { computeScheduleSummary } from '../../trading/scheduleStatus';
import './ScheduleStatusBanner.css';

export default function ScheduleStatusBanner({
  schedule,
  scheduleStatus,
  activeStrategyName,
  hasUnsavedSchedule,
  brokerName,
  onOpenSchedule,
  onResetToday,
  busy,
}) {
  const summary = computeScheduleSummary({
    schedule,
    scheduleStatus: scheduleStatus
      ? { ...scheduleStatus, brokerName }
      : null,
    activeStrategyName,
    hasUnsavedSchedule,
  });

  return (
    <section className={`schedule-status-banner state-${summary.state}`}>
      <div className="schedule-status-banner-main">
        <div className="schedule-status-banner-icon" aria-hidden>
          {summary.state === 'off' && '○'}
          {summary.state === 'upcoming' && '◷'}
          {summary.state === 'armed' && '◷'}
          {summary.state === 'running' && '●'}
          {summary.state === 'done' && '✓'}
          {summary.state === 'weekend' && '◷'}
          {summary.state === 'missed' && '!'}
          {summary.state === 'error' && '✕'}
          {summary.state === 'unsaved' && '…'}
        </div>
        <div className="schedule-status-banner-text">
          <h3 className="schedule-status-headline">{summary.headline}</h3>
          <p className="schedule-status-detail">{summary.detail}</p>
          <p className="schedule-status-meta">
            Scheduler uses active strategy: <strong>{summary.activeStrategyName}</strong>
            {summary.enabled && (
              <>
                {' '}
                · {summary.symbol} · {summary.entryTime} IST
                {summary.autoEnter ? ' · auto-enter' : ' · quotes only'}
              </>
            )}
          </p>
        </div>
      </div>
      <div className="schedule-status-banner-side">
        <div className="schedule-pills">
          {summary.pills.map((p) => (
            <span key={p.label} className={`schedule-pill tone-${p.tone}`}>
              {p.label}
            </span>
          ))}
        </div>
        <div className="schedule-status-actions">
          <button type="button" className="btn-link-schedule" disabled={busy} onClick={onOpenSchedule}>
            {summary.enabled ? 'Edit schedule' : 'Set up schedule'}
          </button>
          {summary.state === 'done' && onResetToday && (
            <button
              type="button"
              className="btn-link-schedule"
              disabled={busy}
              onClick={onResetToday}
            >
              Reset today
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
