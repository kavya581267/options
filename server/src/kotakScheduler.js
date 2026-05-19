import { config } from './config.js';
import {
  formatISTTime,
  getISTDateString,
  isWeekday,
  isWithinMarketHours,
} from './marketHours.js';
import { getSchedule, loadSchedule } from './trading/scheduleStorage.js';
import { runScheduledEntry } from './trading/scheduledEntry.js';
import { listOpenTrades } from './trading/tradeStorage.js';
import { monitorOpenTrade } from './trading/straddleExecutor.js';
import { isLoggedIn } from './kotak/client.js';

let entryCheckedMinute = null;
let monitorRunning = false;

function parseEntryTime(entryTime) {
  const [h, m] = entryTime.split(':').map(Number);
  return { hours: h, minutes: m };
}

function isEntryMinute(entryTime) {
  const formatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: config.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(new Date()).map((p) => [p.type, p.value])
  );
  const hour = parseInt(parts.hour, 10);
  const minute = parseInt(parts.minute, 10);
  const t = parseEntryTime(entryTime);
  return hour === t.hours && minute === t.minutes;
}

async function checkScheduledEntry() {
  const sched = getSchedule();
  if (!sched.enabled || !isWeekday() || !isWithinMarketHours()) return;

  const today = getISTDateString();
  if (sched.lastExecutedDate === today) return;

  const minuteKey = `${today}-${sched.entryTime}`;
  if (!isEntryMinute(sched.entryTime)) {
    entryCheckedMinute = null;
    return;
  }
  if (entryCheckedMinute === minuteKey) return;
  entryCheckedMinute = minuteKey;

  try {
    console.log(`[kotak-scheduler] ${formatISTTime()} — scheduled entry ${sched.entryTime}`);
    const result = await runScheduledEntry();
    console.log(`[kotak-scheduler] entry result:`, JSON.stringify(result));
  } catch (err) {
    console.error(`[kotak-scheduler] scheduled entry failed:`, err.message);
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
            `[kotak-scheduler] ${symbol} exited (${r.hit}) @ ${r.currentPremium}`
          );
        }
      } catch (err) {
        console.error(`[kotak-scheduler] monitor ${symbol}:`, err.message);
      }
    }
  } finally {
    monitorRunning = false;
  }
}

export async function startKotakScheduler() {
  await loadSchedule();
  const sched = getSchedule();

  // Entry check every 15s during market hours (fires once in the target minute)
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
    `[kotak-scheduler] Scheduled entry ${sched.enabled ? sched.entryTime : 'off'} | ` +
      `monitor every ${sched.monitorIntervalSec || 30}s | auto-enter ${sched.autoEnter}`
  );

  checkScheduledEntry();
  scheduleMonitorLoop();
}
