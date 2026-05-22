import { Router } from 'express';
import { config } from '../config.js';
import {
  clearSession,
  isLoggedIn,
  loadSession,
  getAuthUrl,
  exchangeAuthCode,
} from '../fyers/client.js';
import { readTrade, listOpenTrades } from '../trading/fyersTradeStorage.js';
import { hasSavedFyersConfigFile, updateFyersTradingConfig } from '../trading/fyersTradingConfig.js';
import { getOpenTradeLive } from '../trading/fyersLiveStatus.js';
import {
  getSchedule,
  loadSchedule,
  updateSchedule,
  clearScheduleExecution,
} from '../trading/fyersScheduleStorage.js';
import { runFyersScheduledEntry } from '../trading/fyersScheduledEntry.js';
import {
  isWeekday,
  isWithinMarketHours,
  getISTDateString,
} from '../marketHours.js';
import {
  enterStraddle,
  exitStraddle,
  monitorOpenTrade,
} from '../trading/fyersStraddleExecutor.js';
import { computeExitLevels } from '../trading/slTarget.js';
import { fetchStraddleQuote } from '../fyers/quotes.js';
import { getAnchor } from '../storage.js';

const router = Router();

router.get('/schedule', async (_req, res) => {
  await loadSchedule();
  const schedule = getSchedule();
  res.json({
    schedule,
    executedToday: schedule.lastExecutedDate === getISTDateString(),
    lastError: schedule.lastError ?? null,
    lastErrorAt: schedule.lastErrorAt ?? null,
    marketOpen: isWithinMarketHours(),
    weekday: isWeekday(),
    loggedIn: isLoggedIn(),
  });
});

router.put('/schedule', async (req, res) => {
  try {
    const schedule = await updateSchedule(req.body);
    res.json({ success: true, schedule });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/schedule/reset-today', async (_req, res) => {
  try {
    const schedule = await clearScheduleExecution();
    res.json({ success: true, schedule, executedToday: false });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/schedule/run-now', async (req, res) => {
  try {
    const result = await runFyersScheduledEntry({ force: req.body?.force === true });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/config', async (_req, res) => {
  res.json({
    trading: { ...config.fyersTrading },
    configSource: (await hasSavedFyersConfigFile()) ? 'file' : 'env',
    fyersConfigured: Boolean(config.fyers.appId && config.fyers.secretKey),
    loggedIn: isLoggedIn(),
  });
});

router.put('/config', async (req, res) => {
  try {
    const trading = await updateFyersTradingConfig(req.body);
    res.json({ success: true, trading });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/session', async (_req, res) => {
  await loadSession();
  res.json({ loggedIn: isLoggedIn() });
});

router.get('/auth-url', (_req, res) => {
  try {
    const url = getAuthUrl();
    res.json({ url });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/login/auth-code', async (req, res) => {
  try {
    const data = await exchangeAuthCode(req.body.authCode);
    res.json({ success: true, ...data });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/logout', async (_req, res) => {
  await clearSession();
  res.json({ success: true });
});

router.get('/trades/open', async (_req, res) => {
  const open = await listOpenTrades();
  res.json({ open });
});

router.get('/live/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const trade = await readTrade(symbol);
    if (!trade || trade.status !== 'open') {
      return res.json({ open: false, symbol });
    }
    const live = await getOpenTradeLive(trade, symbol);
    res.json({ open: true, ...live });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/trade/:symbol', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  const trade = await readTrade(symbol);
  res.json({ symbol, trade });
});

router.get('/anchor/:symbol', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  const anchor = await getAnchor(symbol);
  res.json({ symbol, date: getISTDateString(), anchor });
});

router.get('/quotes/straddle', async (req, res) => {
  try {
    const symbol = (req.query.symbol || config.fyersTrading.symbol).toUpperCase();
    const strike = Number(req.query.strike);
    if (!strike || Number.isNaN(strike)) {
      return res.status(400).json({ error: 'strike query required' });
    }
    const quote = await fetchStraddleQuote(symbol, strike);
    res.json(quote);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/levels/preview', (req, res) => {
  const premium = parseFloat(req.query.premium);
  if (!premium || Number.isNaN(premium)) {
    return res.status(400).json({ error: 'premium query required' });
  }
  const levels = computeExitLevels(
    premium,
    config.fyersTrading.side,
    config.fyersTrading
  );
  res.json({ side: config.fyersTrading.side, levels, config: config.fyersTrading });
});

router.post('/enter', async (req, res) => {
  try {
    const symbol = (req.body.symbol || config.fyersTrading.symbol).toUpperCase();
    const result = await enterStraddle({
      symbol,
      strike: req.body.strike ? Number(req.body.strike) : undefined,
      entryPremium: req.body.entryPremium
        ? Number(req.body.entryPremium)
        : undefined,
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/exit', async (req, res) => {
  try {
    const symbol = (req.body.symbol || config.fyersTrading.symbol).toUpperCase();
    const result = await exitStraddle(symbol, req.body.reason || 'manual');
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/monitor', async (req, res) => {
  try {
    const symbol = (req.body.symbol || config.fyersTrading.symbol).toUpperCase();
    const result = await monitorOpenTrade(
      symbol,
      req.body.currentPremium != null
        ? Number(req.body.currentPremium)
        : undefined
    );
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
