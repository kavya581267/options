import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { loadTradingConfig } from './trading/tradingConfig.js';
import { loadFyersTradingConfig } from './trading/fyersTradingConfig.js';
import { kotakStrategies } from './trading/kotakStrategies.js';
import { fyersStrategies } from './trading/fyersStrategies.js';
import { startScheduler } from './scheduler.js';
import { startKotakScheduler } from './kotakScheduler.js';
import { startFyersScheduler } from './fyersScheduler.js';
import { startScreenerScheduler } from './screenerScheduler.js';
import apiRouter from './routes/api.js';

await loadTradingConfig();
await loadFyersTradingConfig();
await kotakStrategies.loadStrategies();
await fyersStrategies.loadStrategies();

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api', apiRouter);

try {
  const { default: tradingRouter } = await import('./routes/trading.js');
  app.use('/api/trading', tradingRouter);
  console.log('Kotak trading API: /api/trading');
} catch (err) {
  console.warn('[kotak] routes not loaded:', err.message);
}

try {
  const { default: fyersRouter } = await import('./routes/fyersTrading.js');
  app.use('/api/fyers', fyersRouter);
  console.log('Fyers trading API: /api/fyers');
} catch (err) {
  console.warn('[fyers] routes not loaded:', err.message);
}

try {
  const { default: screenerRouter } = await import('./routes/screener.js');
  app.use('/api/screener', screenerRouter);
  console.log('Stock screener API: /api/screener');
} catch (err) {
  console.warn('[screener] routes not loaded:', err.message);
}

const server = app.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port}`);
  console.log(`Data directory: ${config.dataDir}`);
  console.log(`Tracking: ${config.symbols.join(', ')}`);
  startScheduler();
  startKotakScheduler().catch((err) => {
    console.warn('[kotak-scheduler] failed to start:', err.message);
  });
  startFyersScheduler().catch((err) => {
    console.warn('[fyers-scheduler] failed to start:', err.message);
  });
  startScreenerScheduler();
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `Port ${config.port} is already in use. Stop the other process:\n` +
        `  lsof -ti :${config.port} | xargs kill -9`
    );
    process.exit(1);
  }
  throw err;
});
