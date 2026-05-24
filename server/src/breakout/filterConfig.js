export const DEFAULT_BREAKOUT_FILTERS = {
  require_market_bullish: true,
  require_sector_strong: true,
  require_above_ema50: true,
  require_above_ema200: true,
  require_breakout: true,
  require_volume_dry_up: false,
  require_delivery_min: false,
  delivery_pct_min: 45,
  require_consolidation: false,
  base_score_min: 50,
  require_atr_expansion: false,
  require_rs_rising: false,
  sectors_include: [],
  sectors_exclude: [],
};

export const FILTER_CATALOG = [
  {
    key: 'require_market_bullish',
    label: 'Market bullish',
    description: 'Nifty above EMA20 & EMA50, EMA20 > EMA50',
    group: 'market',
  },
  {
    key: 'require_sector_strong',
    label: 'Sector strength',
    description: 'Sector 1M return beats Nifty',
    group: 'sector',
  },
  {
    key: 'require_above_ema50',
    label: 'Above EMA 50',
    description: 'Close above 50-day EMA',
    group: 'trend',
  },
  {
    key: 'require_above_ema200',
    label: 'Above EMA 200',
    description: 'Close above 200-day EMA (SMA50 proxy if <200 days)',
    group: 'trend',
  },
  {
    key: 'require_breakout',
    label: 'Breakout detected',
    description: 'Close > 20-day high and volume ≥ 2× avg',
    group: 'breakout',
  },
  {
    key: 'require_volume_dry_up',
    label: 'Volume dry-up',
    description: '5-day avg volume < 60% of 20-day avg (during base)',
    group: 'volume',
  },
  {
    key: 'require_delivery_min',
    label: 'Min delivery %',
    description: 'Delivery percentage above threshold',
    group: 'delivery',
    hasThreshold: true,
    thresholdKey: 'delivery_pct_min',
    thresholdDefault: 45,
  },
  {
    key: 'require_consolidation',
    label: 'Consolidation base',
    description: '15-day tight base (min base score)',
    group: 'base',
    hasThreshold: true,
    thresholdKey: 'base_score_min',
    thresholdDefault: 50,
  },
  {
    key: 'require_atr_expansion',
    label: 'ATR expansion',
    description: 'ATR14 above 20-day ATR average',
    group: 'momentum',
  },
  {
    key: 'require_rs_rising',
    label: 'RS rising',
    description: 'Relative strength vs Nifty improving',
    group: 'momentum',
  },
];

export function normalizeFilters(raw = {}) {
  const f = { ...DEFAULT_BREAKOUT_FILTERS };
  for (const def of FILTER_CATALOG) {
    if (typeof raw[def.key] === 'boolean') f[def.key] = raw[def.key];
    if (def.hasThreshold && def.thresholdKey && raw[def.thresholdKey] != null) {
      f[def.thresholdKey] = Number(raw[def.thresholdKey]);
    }
  }
  if (Array.isArray(raw.sectors_include)) {
    f.sectors_include = raw.sectors_include.map((s) => String(s).trim()).filter(Boolean);
  }
  if (Array.isArray(raw.sectors_exclude)) {
    f.sectors_exclude = raw.sectors_exclude.map((s) => String(s).trim()).filter(Boolean);
  }
  return f;
}

export function passesFinalFilter(row, market, filters) {
  const f = normalizeFilters(filters);

  if (f.require_market_bullish && !market?.bullish) return false;
  if (f.require_sector_strong && !row.sector_strong) return false;
  if (f.require_above_ema50 && !row.above_ema50) return false;
  if (f.require_above_ema200 && !row.above_ema200) return false;
  if (f.require_breakout && !row.breakout_flag) return false;
  if (f.require_volume_dry_up && !row.volume_dry_up) return false;
  if (f.require_delivery_min && !(row.delivery_pct >= f.delivery_pct_min)) return false;
  if (f.require_consolidation && !(row.base_score >= f.base_score_min)) return false;
  if (f.require_atr_expansion && !row.atr_expansion) return false;
  if (f.require_rs_rising && !row.rs_rising) return false;

  if (f.sectors_include.length > 0 && !f.sectors_include.includes(row.sector)) return false;
  if (f.sectors_exclude.length > 0 && f.sectors_exclude.includes(row.sector)) return false;

  return true;
}

export function activeFilterLabels(filters) {
  const f = normalizeFilters(filters);
  const labels = [];
  for (const def of FILTER_CATALOG) {
    if (f[def.key]) {
      if (def.hasThreshold && def.thresholdKey) {
        labels.push(`${def.label} (≥${f[def.thresholdKey]})`);
      } else {
        labels.push(def.label);
      }
    }
  }
  if (f.sectors_include.length) labels.push(`Sectors: ${f.sectors_include.join(', ')}`);
  if (f.sectors_exclude.length) labels.push(`Exclude: ${f.sectors_exclude.join(', ')}`);
  return labels;
}
