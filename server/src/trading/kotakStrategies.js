import {
  getSchedule,
  loadSchedule,
  updateSchedule,
} from './scheduleStorage.js';
import { normalizeTrading } from './tradingConfig.js';
import { createStrategyStore } from './strategyStore.js';

export const kotakStrategies = createStrategyStore({
  broker: 'kotak',
  configKey: 'trading',
  legacyConfigFile: 'kotak-trading-config.json',
  normalizeTrading,
  getSchedule,
  updateSchedule,
  loadSchedule,
});
