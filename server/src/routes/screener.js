import { Router } from 'express';
import { listUniverseOptions } from '../screener/universe.js';
import { getRunStatus, startScreenerAsync } from '../screener/engine.js';
import {
  readScanResult,
  listScanDates,
  listSavedQueries,
} from '../screener/screenerStorage.js';
import { fetchStockDetails } from '../screener/stockDetails.js';
import { getISTDateString } from '../marketHours.js';
import { listIndicators } from '../screener/indicators/registry.js';
import { normalizeQuery, queryId, defaultQuery } from '../screener/query.js';
import { listPresets, savePreset, deletePreset } from '../screener/presets.js';

const router = Router();

router.get('/indicators', (_req, res) => {
  res.json({ indicators: listIndicators(), logicOptions: ['AND', 'OR'] });
});

/** @deprecated use /indicators */
router.get('/rules', (_req, res) => {
  res.json({
    rules: listIndicators().map((i) => ({
      id: i.id,
      label: i.label,
      description: i.description,
    })),
  });
});

router.get('/presets', async (_req, res) => {
  try {
    const presets = await listPresets();
    res.json({ presets });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/presets', async (req, res) => {
  try {
    const preset = await savePreset({
      name: req.body?.name,
      query: req.body?.query,
    });
    res.json({ preset });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/presets/:id', async (req, res) => {
  try {
    await deletePreset(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/universes', async (_req, res) => {
  try {
    const universes = await listUniverseOptions();
    res.json({ universes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/queries', async (_req, res) => {
  try {
    const queries = await listSavedQueries();
    res.json({ queries });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/dates', async (req, res) => {
  try {
    const q = req.query.query ? normalizeQuery(req.query.query) : defaultQuery();
    if (req.query.queryId) {
      const dates = await listScanDates(String(req.query.queryId));
      return res.json({ queryId: req.query.queryId, dates });
    }
    const id = queryId(q);
    const dates = await listScanDates(id);
    res.json({ queryId: id, dates });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/dates', async (req, res) => {
  try {
    const q = normalizeQuery(req.body?.query || defaultQuery());
    const id = queryId(q);
    const dates = await listScanDates(id);
    res.json({ queryId: id, dates });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/results', async (req, res) => {
  try {
    const date = req.query.date || getISTDateString();
    let id = req.query.queryId;

    if (!id) {
      const q = req.query.query
        ? normalizeQuery(JSON.parse(req.query.query))
        : defaultQuery();
      id = queryId(q);
    }

    const result = await readScanResult(String(id), date);
    if (!result) {
      return res.status(404).json({ error: `No scan results for ${date}` });
    }
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/results', async (req, res) => {
  try {
    const date = req.body?.date || getISTDateString();
    const q = normalizeQuery(req.body?.query || defaultQuery());
    const id = queryId(q);
    const result = await readScanResult(id, date);
    if (!result) {
      return res.status(404).json({ error: `No scan results for ${date}` });
    }
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/status', (_req, res) => {
  res.json(getRunStatus());
});

router.post('/run', async (req, res) => {
  try {
    const query = normalizeQuery(req.body?.query || defaultQuery());
    const date = req.body?.date || getISTDateString();
    const force = req.body?.force === true;

    const { promise } = await startScreenerAsync({ query, date, force });

    promise
      .then((result) => {
        console.log(
          `[screener] Completed ${result.queryLabel}: ${result.matchedCount}/${result.totalScanned} matched`
        );
      })
      .catch((err) => {
        console.error('[screener] Run failed:', err.message);
      });

    res.json({ ok: true, message: 'Scan started', status: getRunStatus(), queryId: queryId(query) });
  } catch (err) {
    res.status(409).json({ error: err.message });
  }
});

router.get('/stock/:symbol', async (req, res) => {
  try {
    const queryIdParam = req.query.queryId || null;
    const details = await fetchStockDetails(req.params.symbol, queryIdParam);
    res.json(details);
  } catch (err) {
    res.status(err.message.includes('not found') ? 404 : 500).json({
      error: err.message,
    });
  }
});

export default router;
