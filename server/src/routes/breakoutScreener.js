import { Router } from 'express';
import { getISTDateString } from '../marketHours.js';
import {
  getBreakoutRunStatus,
  startBreakoutScreenerAsync,
  DEFAULT_BREAKOUT_FILTERS,
} from '../breakout/engine.js';
import {
  readBreakoutResult,
  listBreakoutDates,
  breakoutQueryId,
  OUTPUT_COLUMNS,
} from '../breakout/storage.js';
import { FILTER_CATALOG } from '../breakout/filterConfig.js';
import { listSectors } from '../breakout/sectorMap.js';

const router = Router();

router.get('/columns', (_req, res) => {
  res.json({ columns: OUTPUT_COLUMNS, queryId: breakoutQueryId() });
});

router.get('/filters', (_req, res) => {
  res.json({
    defaults: DEFAULT_BREAKOUT_FILTERS,
    catalog: FILTER_CATALOG,
  });
});

router.get('/sectors', async (_req, res) => {
  try {
    const sectors = await listSectors();
    res.json({ sectors });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/dates', async (_req, res) => {
  try {
    const dates = await listBreakoutDates();
    res.json({ queryId: breakoutQueryId(), dates });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/results', async (req, res) => {
  try {
    const date = req.query.date || getISTDateString();
    const result = await readBreakoutResult(date);
    if (!result) {
      return res.status(404).json({ error: `No breakout results for ${date}` });
    }
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/status', (_req, res) => {
  res.json(getBreakoutRunStatus());
});

router.post('/run', async (req, res) => {
  try {
    const date = req.body?.date || getISTDateString();
    const filters = req.body?.filters ?? null;
    const { promise } = await startBreakoutScreenerAsync({
      date,
      force: req.body?.force === true,
      filters,
    });

    promise
      .then((result) => {
        console.log(`[breakout] Done: ${result.matchedCount} candidates (${date})`);
      })
      .catch((err) => {
        console.error('[breakout] Failed:', err.message);
      });

    res.json({
      ok: true,
      message: 'Breakout scan started',
      status: getBreakoutRunStatus(),
      queryId: breakoutQueryId(),
    });
  } catch (err) {
    res.status(409).json({ error: err.message });
  }
});

export default router;
