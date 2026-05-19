import { Router } from 'express';
import { config } from '../config.js';
import { collectAll } from '../collector.js';
import {
  readDayData,
  listAvailableDates,
  computeDayStats,
} from '../storage.js';
import { getISTDateString, isWithinMarketHours } from '../marketHours.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({
    ok: true,
    symbols: config.symbols,
    marketOpen: isWithinMarketHours(),
    anchorTime: config.marketStart,
    date: getISTDateString(),
  });
});

router.get('/symbols', (_req, res) => {
  res.json({ symbols: config.symbols });
});

router.get('/dates/:symbol', async (req, res) => {
  try {
    const dates = await listAvailableDates(req.params.symbol.toUpperCase());
    res.json({ symbol: req.params.symbol.toUpperCase(), dates });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/data/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const date = req.query.date || getISTDateString();
    const { anchor, readings } = await readDayData(symbol, date);
    const stats = computeDayStats(readings, anchor);
    res.json({ symbol, date, anchor, readings, stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/fetch', async (req, res) => {
  try {
    const symbols = req.body?.symbols
      ? req.body.symbols.map((s) => s.toUpperCase())
      : config.symbols;
    const result = await collectAll(symbols);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
