import { config } from './config.js';

function parseTime(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return { hours: h, minutes: m };
}

function getISTParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: config.timezone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((p) => [p.type, p.value])
  );

  return {
    weekday: parts.weekday,
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parseInt(parts.hour, 10),
    minute: parseInt(parts.minute, 10),
  };
}

export function getISTDateString(date = new Date()) {
  const p = getISTParts(date);
  return `${p.year}-${p.month}-${p.day}`;
}

export function isWeekday(date = new Date()) {
  const p = getISTParts(date);
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  return weekdays.includes(p.weekday);
}

export function isWithinMarketHours(date = new Date()) {
  if (config.forceFetch) return true;
  if (!isWeekday(date)) return false;

  const p = getISTParts(date);
  const start = parseTime(config.marketStart);
  const end = parseTime(config.marketEnd);

  const currentMins = p.hour * 60 + p.minute;
  const startMins = start.hours * 60 + start.minutes;
  const endMins = end.hours * 60 + end.minutes;

  return currentMins >= startMins && currentMins <= endMins;
}

/** True during the 9:15 minute — when spot/strike anchor is captured */
export function isAnchorMinute(date = new Date()) {
  const p = getISTParts(date);
  const anchor = parseTime(config.marketStart);
  return p.hour === anchor.hours && p.minute === anchor.minutes;
}

/** Up to 5 minutes after 9:15 if the anchor tick was missed */
export function canCaptureLateAnchor(date = new Date()) {
  if (config.forceFetch) return true;
  const p = getISTParts(date);
  const anchor = parseTime(config.marketStart);
  const currentMins = p.hour * 60 + p.minute;
  const anchorMins = anchor.hours * 60 + anchor.minutes;
  return currentMins >= anchorMins && currentMins <= anchorMins + 5;
}

export function shouldCaptureAnchor(date = new Date()) {
  return isAnchorMinute(date) || canCaptureLateAnchor(date);
}

export function isBeforeMarketStart(date = new Date()) {
  if (config.forceFetch) return false;
  if (!isWeekday(date)) return true;
  const p = getISTParts(date);
  const start = parseTime(config.marketStart);
  const currentMins = p.hour * 60 + p.minute;
  const startMins = start.hours * 60 + start.minutes;
  return currentMins < startMins;
}

/** After 9:20 grace: set today's anchor from current quotes if 9:15 was missed */
export function canCaptureLateAnchorFromCurrent(date = new Date()) {
  if (config.forceFetch) return isWithinMarketHours(date);
  if (!isWithinMarketHours(date)) return false;
  const p = getISTParts(date);
  const anchor = parseTime(config.marketStart);
  const currentMins = p.hour * 60 + p.minute;
  const anchorMins = anchor.hours * 60 + anchor.minutes;
  return currentMins > anchorMins + 5;
}

export function canCaptureAnchorNow(date = new Date()) {
  return shouldCaptureAnchor(date) || canCaptureLateAnchorFromCurrent(date);
}

export function isTimeMinute(hhmm, date = new Date()) {
  const p = getISTParts(date);
  const t = parseTime(hhmm);
  return p.hour === t.hours && p.minute === t.minutes;
}

export function formatISTTime(date = new Date()) {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: config.timezone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}
