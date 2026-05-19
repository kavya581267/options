import cron from 'node-cron';
import { config } from './config.js';
import { collectAll } from './collector.js';
import { isWithinMarketHours, formatISTTime } from './marketHours.js';

let isRunning = false;

async function tick() {
  if (isRunning) {
    console.log(`[scheduler] ${formatISTTime()} — previous tick still running, skip`);
    return;
  }

  if (!isWithinMarketHours()) return;

  isRunning = true;
  try {
    console.log(`[scheduler] ${formatISTTime()} — collecting data...`);
    const result = await collectAll();
    if (!result.skipped) {
      console.log(`[scheduler] done:`, JSON.stringify(result.results));
    }
  } finally {
    isRunning = false;
  }
}

export function startScheduler() {
  // Every minute, Mon–Fri (market hours checked inside tick)
  cron.schedule(
    '* * * * 1-5',
    tick,
    { timezone: config.timezone }
  );

  console.log(
    `[scheduler] Started — ${config.symbols.join(', ')} | anchor ${config.marketStart}, ` +
      `then every minute until ${config.marketEnd} (${config.timezone})`
  );

  // Run once on startup if within market hours
  tick();
}
