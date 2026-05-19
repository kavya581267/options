import { Router } from 'express';
import { config } from '../config.js';
import {
  clearSession,
  isLoggedIn,
  loadSession,
  loginTotp,
  validateMpin,
} from '../kotak/client.js';
import { readTrade } from '../trading/tradeStorage.js';
import {
  enterStraddle,
  exitStraddle,
  monitorOpenTrade,
} from '../trading/straddleExecutor.js';
import { computeExitLevels } from '../trading/slTarget.js';
import { fetchStraddleQuote } from '../kotak/quotes.js';
import { getAnchor } from '../storage.js';
import { getISTDateString } from '../marketHours.js';

const router = Router();

router.get('/config', (_req, res) => {
  res.json({
    trading: config.trading,
    kotakConfigured: Boolean(config.kotak.accessToken),
    loggedIn: isLoggedIn(),
  });
});

router.get('/session', async (_req, res) => {
  await loadSession();
  res.json({ loggedIn: isLoggedIn() });
});

router.post('/login/totp', async (req, res) => {
  try {
    const { totp, mobileNumber, ucc } = req.body;
    const data = await loginTotp(totp, mobileNumber, ucc);
    res.json({ success: true, ...data });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/login/mpin', async (req, res) => {
  try {
    const data = await validateMpin(req.body.mpin);
    res.json({ success: true, ...data });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/logout', async (_req, res) => {
  await clearSession();
  res.json({ success: true });
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
    const symbol = (req.query.symbol || config.trading.symbol).toUpperCase();
    const strike = Number(req.query.strike);
    if (!strike || Number.isNaN(strike)) {
      return res.status(400).json({ error: 'strike query required' });
    }
    if (!['NIFTY', 'SENSEX'].includes(symbol)) {
      return res.status(400).json({ error: 'Only NIFTY and SENSEX supported' });
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
    config.trading.side,
    config.trading
  );
  res.json({ side: config.trading.side, levels, config: config.trading });
});

router.post('/enter', async (req, res) => {
  try {
    const symbol = (req.body.symbol || config.trading.symbol).toUpperCase();
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
    const symbol = (req.body.symbol || config.trading.symbol).toUpperCase();
    const result = await exitStraddle(symbol, req.body.reason || 'manual');
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/monitor', async (req, res) => {
  try {
    const symbol = (req.body.symbol || config.trading.symbol).toUpperCase();
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
