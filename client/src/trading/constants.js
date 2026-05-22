export const DEFAULT_TRADING = {
  symbol: 'NIFTY',
  side: 'SELL',
  lots: 1,
  product: 'MIS',
  useBracketOrder: false,
  slType: 'percent',
  slValue: 20,
  targetType: 'percent',
  targetValue: 30,
};

export const DEFAULT_SCHEDULE = {
  enabled: false,
  entryTime: '09:15',
  symbol: 'NIFTY',
  autoEnter: true,
  monitorIntervalSec: 30,
  saveToTracker: true,
};

export const SYMBOLS = ['NIFTY', 'SENSEX'];

export function newStrategyDraft(overrides = {}) {
  return {
    name: 'New strategy',
    description: '',
    trading: { ...DEFAULT_TRADING },
    schedule: { ...DEFAULT_SCHEDULE },
    ...overrides,
  };
}

export function strategyToDraft(strategy) {
  if (!strategy) return newStrategyDraft();
  return {
    name: strategy.name,
    description: strategy.description || '',
    trading: { ...DEFAULT_TRADING, ...strategy.trading },
    schedule: { ...DEFAULT_SCHEDULE, ...strategy.schedule },
  };
}
