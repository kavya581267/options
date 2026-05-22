import {
  getSchedule,
  loadSchedule,
  updateSchedule,
} from './fyersScheduleStorage.js';
import { normalizeTrading } from './fyersTradingConfig.js';
import { createStrategyStore } from './strategyStore.js';

export const fyersStrategies = createStrategyStore({
  broker: 'fyers',
  configKey: 'fyersTrading',
  legacyConfigFile: 'fyers-trading-config.json',
  normalizeTrading,
  getSchedule,
  updateSchedule,
  loadSchedule,
});
