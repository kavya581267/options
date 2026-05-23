/**
 * Exponential moving average from daily closes (oldest → newest).
 */
export function computeEma(closes, period) {
  if (!closes?.length || closes.length < period) return null;

  let ema = closes.slice(0, period).reduce((sum, v) => sum + v, 0) / period;
  const k = 2 / (period + 1);

  for (let i = period; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
  }

  return ema;
}

/** EMA computed on closes[0..endIndex] inclusive. */
export function computeEmaThrough(closes, period, endIndex) {
  if (!closes?.length || endIndex < period - 1) return null;
  const slice = closes.slice(0, endIndex + 1);
  return computeEma(slice, period);
}

export function computeSma(values, period) {
  if (!values?.length || values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((sum, v) => sum + v, 0) / period;
}

/** Wilder-style RSI from closes (oldest → newest). */
export function computeRsi(closes, period = 14) {
  if (!closes?.length || closes.length < period + 1) return null;

  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change >= 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }

  avgGain /= period;
  avgLoss /= period;

  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function compareValues(value, operator, target) {
  switch (operator) {
    case '>=':
      return value >= target;
    case '<=':
      return value <= target;
    case '>':
      return value > target;
    case '<':
      return value < target;
    case '==':
      return value === target;
    default:
      return false;
  }
}

export function extractClosesFromNseHistory(rows) {
  if (!Array.isArray(rows)) return [];

  return rows
    .map((row) => {
      const close = row.chClosingPrice ?? row.CH_CLOSING_PRICE ?? row.close;
      const ts = row.mtimestamp ?? row.CH_TIMESTAMP ?? row.date;
      return close != null ? { close: Number(close), ts } : null;
    })
    .filter(Boolean)
    .sort((a, b) => new Date(a.ts) - new Date(b.ts))
    .map((r) => r.close);
}

export function extractClosesFromFyersCandles(candles) {
  if (!Array.isArray(candles)) return [];
  return candles
    .slice()
    .sort((a, b) => a[0] - b[0])
    .map((c) => Number(c[4]));
}
