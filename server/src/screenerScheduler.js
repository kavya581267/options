import cron from 'node-cron';
import { config } from './config.js';
import { getRunStatus, startScreenerAsync } from './screener/engine.js';
import { defaultQuery } from './screener/query.js';
import { isWeekday } from './marketHours.js';

export function startScreenerScheduler() {
  if (config.screener?.autoRun === false) {
    console.log('[screener-scheduler] Auto-run disabled');
    return;
  }

  const time = config.screener?.autoRunTime || '16:00';

  cron.schedule(
    `0 ${time.split(':')[1] || '0'} ${time.split(':')[0] || '16'} * * 1-5`,
    async () => {
      if (!isWeekday()) return;
      if (getRunStatus().running) {
        console.log('[screener-scheduler] Scan already running, skip');
        return;
      }

      console.log('[screener-scheduler] Starting daily scan...');
      try {
        const { promise } = await startScreenerAsync({
          query: defaultQuery(),
        });
        const result = await promise;
        console.log(
          `[screener-scheduler] Done: ${result.matchedCount}/${result.totalScanned} matched`
        );
      } catch (err) {
        console.error('[screener-scheduler] Failed:', err.message);
      }
    },
    { timezone: config.timezone }
  );

  console.log(
    `[screener-scheduler] Daily scan at ${time} IST (${config.timezone})`
  );
}
