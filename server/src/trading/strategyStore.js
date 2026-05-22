import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { config } from '../config.js';

const DEFAULT_SCHEDULE = {
  enabled: false,
  entryTime: '09:15',
  symbol: 'NIFTY',
  autoEnter: true,
  monitorIntervalSec: 30,
  saveToTracker: true,
};

function newId() {
  return crypto.randomBytes(6).toString('hex');
}

function scheduleFromStrategy(s) {
  return {
    enabled: Boolean(s.enabled),
    entryTime: String(s.entryTime || '09:15'),
    symbol: String(s.symbol || 'NIFTY').toUpperCase(),
    autoEnter: Boolean(s.autoEnter ?? true),
    monitorIntervalSec: Math.min(
      60,
      Math.max(15, parseInt(s.monitorIntervalSec ?? 30, 10))
    ),
    saveToTracker: Boolean(s.saveToTracker ?? true),
  };
}

/**
 * @param {object} opts
 * @param {'kotak'|'fyers'} opts.broker
 * @param {'trading'|'fyersTrading'} opts.configKey
 * @param {string} opts.legacyConfigFile
 * @param {() => object} opts.normalizeTrading
 * @param {() => object} opts.getSchedule
 * @param {(u: object) => Promise<object>} opts.updateSchedule
 * @param {() => Promise<object>} opts.loadSchedule
 */
export function createStrategyStore(opts) {
  const {
    broker,
    configKey,
    legacyConfigFile,
    normalizeTrading,
    getSchedule,
    updateSchedule,
    loadSchedule,
  } = opts;

  let store = { activeStrategyId: null, strategies: [] };

  function strategiesPath() {
    return path.join(config.dataDir, `${broker}-strategies.json`);
  }

  function legacyConfigPath() {
    return path.join(config.dataDir, legacyConfigFile);
  }

  function applyTradingToRuntime(trading) {
    Object.assign(config[configKey], trading);
  }

  function getActiveStrategy() {
    const id = store.activeStrategyId;
    return store.strategies.find((s) => s.id === id) || store.strategies[0] || null;
  }

  function normalizeStrategy(input, baseSchedule = DEFAULT_SCHEDULE) {
    const name = String(input.name || 'Untitled strategy').trim();
    if (!name) throw new Error('Strategy name is required');
    const description = String(input.description || '').trim();
    const trading = normalizeTrading(input.trading || input);
    const schedule = scheduleFromStrategy({
      ...baseSchedule,
      ...(input.schedule || {}),
      symbol: input.schedule?.symbol || trading.symbol,
    });

    return {
      id: input.id || newId(),
      name,
      description,
      trading,
      schedule,
      createdAt: input.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  async function persist() {
    await fs.mkdir(config.dataDir, { recursive: true });
    await fs.writeFile(strategiesPath(), JSON.stringify(store, null, 2), 'utf-8');
  }

  async function syncActiveToRuntime() {
    const active = getActiveStrategy();
    if (!active) return null;
    applyTradingToRuntime(active.trading);
    const current = getSchedule();
    await updateSchedule({
      ...active.schedule,
      lastExecutedDate: current.lastExecutedDate,
      lastSnapshot: current.lastSnapshot,
      lastError: current.lastError,
      lastErrorAt: current.lastErrorAt,
    });
    return active;
  }

  async function migrateFromLegacy() {
    let trading = { ...config[configKey] };
    let schedule = { ...DEFAULT_SCHEDULE };

    try {
      const raw = await fs.readFile(legacyConfigPath(), 'utf-8');
      trading = normalizeTrading(JSON.parse(raw));
    } catch {
      /* use env defaults */
    }

    await loadSchedule();
    const sched = getSchedule();
    schedule = scheduleFromStrategy(sched);

    const strategy = normalizeStrategy({
      id: 'default',
      name: 'Default straddle',
      description: 'Migrated from your previous saved config and schedule.',
      trading,
      schedule,
      createdAt: new Date().toISOString(),
    });

    store = {
      activeStrategyId: strategy.id,
      strategies: [strategy],
    };
    await persist();
    await syncActiveToRuntime();
    return store;
  }

  async function loadStrategies() {
    try {
      const raw = await fs.readFile(strategiesPath(), 'utf-8');
      const parsed = JSON.parse(raw);
      const strategies = (parsed.strategies || []).map((s) =>
        normalizeStrategy(s, DEFAULT_SCHEDULE)
      );
      store = {
        activeStrategyId: parsed.activeStrategyId || strategies[0]?.id || null,
        strategies,
      };
      if (!store.strategies.length) {
        return migrateFromLegacy();
      }
      if (
        store.activeStrategyId &&
        !store.strategies.some((s) => s.id === store.activeStrategyId)
      ) {
        store.activeStrategyId = store.strategies[0].id;
      }
      await syncActiveToRuntime();
      return store;
    } catch (err) {
      if (err.code === 'ENOENT') {
        return migrateFromLegacy();
      }
      throw err;
    }
  }

  function listStrategies() {
    return {
      activeStrategyId: store.activeStrategyId,
      strategies: store.strategies.map((s) => ({ ...s })),
      activeStrategy: getActiveStrategy(),
    };
  }

  async function createStrategy(payload) {
    const strategy = normalizeStrategy(payload);
    store.strategies.push(strategy);
    if (!store.activeStrategyId) {
      store.activeStrategyId = strategy.id;
    }
    await persist();
    if (store.activeStrategyId === strategy.id) {
      await syncActiveToRuntime();
    }
    return strategy;
  }

  async function updateStrategy(id, payload) {
    const idx = store.strategies.findIndex((s) => s.id === id);
    if (idx < 0) throw new Error('Strategy not found');
    const prev = store.strategies[idx];
    const next = normalizeStrategy(
      {
        ...prev,
        ...payload,
        id,
        trading: { ...prev.trading, ...(payload.trading || {}) },
        schedule: { ...prev.schedule, ...(payload.schedule || {}) },
        createdAt: prev.createdAt,
      },
      prev.schedule
    );
    store.strategies[idx] = next;
    await persist();
    if (store.activeStrategyId === id) {
      await syncActiveToRuntime();
    }
    return next;
  }

  async function deleteStrategy(id) {
    if (store.strategies.length <= 1) {
      throw new Error('Keep at least one strategy');
    }
    const idx = store.strategies.findIndex((s) => s.id === id);
    if (idx < 0) throw new Error('Strategy not found');
    store.strategies.splice(idx, 1);
    if (store.activeStrategyId === id) {
      store.activeStrategyId = store.strategies[0].id;
      await syncActiveToRuntime();
    }
    await persist();
    return listStrategies();
  }

  async function activateStrategy(id) {
    if (!store.strategies.some((s) => s.id === id)) {
      throw new Error('Strategy not found');
    }
    store.activeStrategyId = id;
    await persist();
    return syncActiveToRuntime();
  }

  async function updateActiveTrading(updates) {
    const active = getActiveStrategy();
    if (!active) throw new Error('No active strategy');
    return updateStrategy(active.id, {
      trading: { ...active.trading, ...updates },
    });
  }

  async function updateActiveSchedule(updates) {
    const active = getActiveStrategy();
    if (!active) throw new Error('No active strategy');
    return updateStrategy(active.id, {
      schedule: { ...active.schedule, ...updates },
    });
  }

  async function patchActiveScheduleFields(updates) {
    const active = getActiveStrategy();
    if (!active) return null;
    const idx = store.strategies.findIndex((s) => s.id === active.id);
    const nextSchedule = scheduleFromStrategy({
      ...active.schedule,
      ...updates,
    });
    store.strategies[idx] = {
      ...active,
      schedule: nextSchedule,
      updatedAt: new Date().toISOString(),
    };
    await persist();
    return nextSchedule;
  }

  return {
    loadStrategies,
    listStrategies,
    createStrategy,
    updateStrategy,
    deleteStrategy,
    activateStrategy,
    syncActiveToRuntime,
    updateActiveTrading,
    updateActiveSchedule,
    patchActiveScheduleFields,
    getActiveStrategy,
    strategiesPath,
  };
}
