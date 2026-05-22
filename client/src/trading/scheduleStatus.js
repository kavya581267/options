/** @returns {number} minutes since midnight IST */
export function istMinutesNow() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value])
  );
  return parseInt(parts.hour, 10) * 60 + parseInt(parts.minute, 10);
}

function parseEntryMinutes(entryTime) {
  const [h, m] = String(entryTime || '09:15').split(':').map(Number);
  return h * 60 + m;
}

function istWeekdayLabel() {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
  }).format(new Date());
}

/**
 * @param {object} opts
 * @param {object} opts.schedule - saved schedule (active strategy / server)
 * @param {object} [opts.scheduleStatus] - from GET /schedule
 * @param {string} [opts.activeStrategyName]
 * @param {boolean} [opts.hasUnsavedSchedule]
 */
export function computeScheduleSummary({
  schedule,
  scheduleStatus,
  activeStrategyName,
  hasUnsavedSchedule,
}) {
  const enabled = Boolean(schedule?.enabled);
  const entryTime = schedule?.entryTime || '09:15';
  const symbol = schedule?.symbol || 'NIFTY';
  const autoEnter = Boolean(schedule?.autoEnter);
  const saveToTracker = Boolean(schedule?.saveToTracker);
  const executedToday = Boolean(scheduleStatus?.executedToday);
  const weekday = scheduleStatus?.weekday !== false;
  const marketOpen = Boolean(scheduleStatus?.marketOpen);
  const loggedIn = Boolean(scheduleStatus?.loggedIn);
  const lastError = scheduleStatus?.lastError;
  const snap = schedule?.lastSnapshot || scheduleStatus?.schedule?.lastSnapshot;

  const nowMin = istMinutesNow();
  const entryMin = parseEntryMinutes(entryTime);
  const inWindow = nowMin >= entryMin && nowMin < entryMin + 5;
  const beforeEntry = nowMin < entryMin;

  const base = {
    enabled,
    entryTime,
    symbol,
    autoEnter,
    saveToTracker,
    activeStrategyName: activeStrategyName || 'Active strategy',
    hasUnsavedSchedule,
  };

  if (!enabled) {
    return {
      ...base,
      state: 'off',
      headline: 'No scheduled entry',
      detail: `“${base.activeStrategyName}” has scheduling turned off. Open the Schedule tab and enable it.`,
      pills: [{ label: 'Off', tone: 'muted' }],
    };
  }

  if (hasUnsavedSchedule) {
    return {
      ...base,
      state: 'unsaved',
      headline: 'Schedule not saved',
      detail: 'You changed schedule settings but have not saved. The server still uses the last saved schedule.',
      pills: [{ label: 'Unsaved changes', tone: 'warn' }],
    };
  }

  if (lastError && !executedToday) {
    return {
      ...base,
      state: 'error',
      headline: `Scheduled entry failed today (${entryTime} IST)`,
      detail: lastError,
      pills: [
        { label: 'Failed', tone: 'error' },
        { label: symbol, tone: 'neutral' },
      ],
    };
  }

  if (executedToday) {
    const snapLine = snap
      ? `Captured ${symbol} strike ${snap.strike}, straddle ₹${Number(snap.straddlePremium).toFixed(2)} at ${snap.time || '—'} IST.`
      : `Completed for ${symbol} today.`;
    return {
      ...base,
      state: 'done',
      headline: 'Scheduled entry ran today',
      detail: snapLine,
      pills: [
        { label: 'Done today', tone: 'ok' },
        { label: symbol, tone: 'neutral' },
        ...(autoEnter ? [{ label: 'Auto-enter', tone: 'neutral' }] : [{ label: 'Quotes only', tone: 'neutral' }]),
      ],
    };
  }

  if (!weekday) {
    return {
      ...base,
      state: 'weekend',
      headline: `Scheduled for weekdays at ${entryTime} IST`,
      detail: `Today is ${istWeekdayLabel()} — no run today. Next run on the next trading day (${symbol}${autoEnter ? ', auto-enter orders' : ', capture quotes only'}).`,
      pills: [
        { label: 'Armed', tone: 'armed' },
        { label: `${entryTime} IST`, tone: 'neutral' },
        { label: symbol, tone: 'neutral' },
      ],
    };
  }

  const actionBits = [
    autoEnter ? 'place straddle orders' : 'capture quotes only',
    saveToTracker ? 'save tracker anchor' : null,
  ].filter(Boolean);

  if (inWindow) {
    return {
      ...base,
      state: 'running',
      headline: `Scheduled entry window open now (${entryTime} IST)`,
      detail: `Server will ${actionBits.join(' and ')} for ${symbol}.${!loggedIn && autoEnter ? ` Log in to ${scheduleStatus?.brokerName || 'broker'} for auto-enter.` : ''}`,
      pills: [
        { label: 'Running now', tone: 'running' },
        { label: symbol, tone: 'neutral' },
        ...(!loggedIn && autoEnter ? [{ label: 'Not logged in', tone: 'warn' }] : []),
      ],
    };
  }

  if (beforeEntry) {
    const loginNote =
      !loggedIn && autoEnter
        ? ' Log in before entry time for auto-enter.'
        : '';
    return {
      ...base,
      state: 'upcoming',
      headline: `Scheduled today at ${entryTime} IST`,
      detail: `${symbol} · will ${actionBits.join(' and ')}.${loginNote}${!marketOpen ? ' Market not open yet.' : ''}`,
      pills: [
        { label: 'Scheduled today', tone: 'armed' },
        { label: entryTime, tone: 'neutral' },
        { label: symbol, tone: 'neutral' },
        ...(!loggedIn && autoEnter ? [{ label: 'Login needed', tone: 'warn' }] : []),
      ],
    };
  }

  return {
    ...base,
    state: 'missed',
    headline: `Today's ${entryTime} IST window passed — not executed`,
    detail: `Schedule is on but nothing ran successfully today. Use “Run now” on the Schedule tab or reset and retry.`,
    pills: [
      { label: 'Missed today', tone: 'warn' },
      { label: symbol, tone: 'neutral' },
    ],
  };
}
