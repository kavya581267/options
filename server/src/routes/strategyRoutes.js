/** @param {import('express').Router} router */
export function attachStrategyCrud(router, strategies) {
  router.get('/strategies', async (_req, res) => {
    try {
      await strategies.loadStrategies();
      res.json(strategies.listStrategies());
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/strategies', async (req, res) => {
    try {
      const strategy = await strategies.createStrategy(req.body);
      res.json({ success: true, strategy, ...strategies.listStrategies() });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.put('/strategies/:id', async (req, res) => {
    try {
      const strategy = await strategies.updateStrategy(req.params.id, req.body);
      res.json({ success: true, strategy, ...strategies.listStrategies() });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.delete('/strategies/:id', async (req, res) => {
    try {
      const data = await strategies.deleteStrategy(req.params.id);
      res.json({ success: true, ...data });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/strategies/:id/activate', async (req, res) => {
    try {
      const activeStrategy = await strategies.activateStrategy(req.params.id);
      res.json({ success: true, activeStrategy, ...strategies.listStrategies() });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });
}
