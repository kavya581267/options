import { config } from './config.js';
import {
  formatISTTime,
  getISTDateString,
  isWeekday,
  isWithinMarketHours,
} from './marketHours.js';
import { getSchedule, loadSchedule } from './trading/fyersScheduleStorage.js';
import { runFyersScheduledEntry } from './trading/fyersScheduledEntry.js';
import { listOpenTrades } from './trading/fyersTradeStorage.js';
import { monitorOpenTrade } from './trading/fyersStraddleExecutor.js';
import { isLoggedIn } from './fyers/client.js';

let entryRunning = false;
let monitorRunning = false;

function parseEntryTime(entryTime) {
  const [h, m] = entryTime.split(':').map(Number);
  return { hours: h, minutes: m };
}

function istMinutesNow() {
  const formatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: config.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(new Date()).map((p) => [p.type, p.value])
  );
  return parseInt(parts.hour, 10) * 60 + parseInt(parts.minute, 10);
}

function isInEntryWindow(entryTime, graceMinutes = 5) {
  const t = parseEntryTime(entryTime);
  const start = t.hours * 60 + t.minutes;
  const now = istMinutesNow();
  return now >= start && now < start + graceMinutes;
}

async function checkScheduledEntry() {
  if (entryRunning) return;

  const sched = getSchedule();
  if (!sched.enabled || !isWeekday() || !isWithinMarketHours()) return;

  const today = getISTDateString();
  if (sched.lastExecutedDate === today) return;

  if (!isInEntryWindow(sched.entryTime)) return;

  entryRunning = true;
  try {
    console.log(`[fyers-scheduler] ${formatISTTime()} — scheduled entry ${sched.entryTime}`);
    const result = await runFyersScheduledEntry();
    console.log(`[fyers-scheduler] entry result:`, JSON.stringify(result));
  } catch (err) {
    console.error(`[fyers-scheduler] scheduled entry failed:`, err.message);
  } finally {
    entryRunning = false;
  }
}

async function monitorOpenTrades() {
  if (monitorRunning || !isLoggedIn()) return;
  monitorRunning = true;
  try {
    const open = await listOpenTrades();
    for (const { symbol } of open) {
      try {
        const r = await monitorOpenTrade(symbol);
        if (r.hit && r.exited) {
          console.log(
            `[fyers-scheduler] ${symbol} exited (${r.hit}) @ ${r.currentPremium}`
          );
        }
      } catch (err) {
        console.error(`[fyers-scheduler] monitor ${symbol}:`, err.message);
      }
    }
  } finally {
    monitorRunning = false;
  }
}

export async function startFyersScheduler() {
  await loadSchedule();
  const sched = getSchedule();

  setInterval(checkScheduledEntry, 15_000);

  function scheduleMonitorLoop() {
    const s = getSchedule();
    const ms = (s.monitorIntervalSec || 30) * 1000;
    setTimeout(async () => {
      await monitorOpenTrades();
      scheduleMonitorLoop();
    }, ms);
  }

  console.log(
    `[fyers-scheduler] Scheduled entry ${sched.enabled ? sched.entryTime : 'off'} | ` +
      `monitor every ${sched.monitorIntervalSec || 30}s | auto-enter ${sched.autoEnter}`
  );

  checkScheduledEntry();
  scheduleMonitorLoop();
}
