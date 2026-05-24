export function computeEma(values, period) {
  if (!values?.length || values.length < period) return null;
  let ema = values.slice(0, period).reduce((s, v) => s + v, 0) / period;
  const k = 2 / (period + 1);
  for (let i = period; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
  }
  return ema;
}

export function computeEmaSeries(values, period) {
  if (!values?.length || values.length < period) return [];
  const out = new Array(values.length).fill(null);
  let ema = values.slice(0, period).reduce((s, v) => s + v, 0) / period;
  out[period - 1] = ema;
  const k = 2 / (period + 1);
  for (let i = period; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
    out[i] = ema;
  }
  return out;
}

export function computeSma(values, period) {
  if (!values?.length || values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((s, v) => s + v, 0) / period;
}

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
  return 100 - 100 / (1 + avgGain / avgLoss);
}

export function computeAtr(highs, lows, closes, period = 14) {
  if (!highs?.length || highs.length < period + 1) return null;
  const trs = [];
  for (let i = 1; i < highs.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    trs.push(tr);
  }
  if (trs.length < period) return null;
  let atr = trs.slice(0, period).reduce((s, v) => s + v, 0) / period;
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
  }
  return atr;
}

export function computeAtrSeries(highs, lows, closes, period = 14) {
  if (!highs?.length || highs.length < 2) return [];
  const trs = [highs[0] - lows[0]];
  for (let i = 1; i < highs.length; i++) {
    trs.push(
      Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      )
    );
  }
  const out = new Array(trs.length).fill(null);
  if (trs.length < period) return out;
  let atr = trs.slice(0, period).reduce((s, v) => s + v, 0) / period;
  out[period - 1] = atr;
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
    out[i] = atr;
  }
  return out;
}

export function pctReturn(closes, lookback) {
  if (!closes?.length || closes.length <= lookback) return null;
  const prev = closes[closes.length - 1 - lookback];
  const last = closes[closes.length - 1];
  if (!prev || prev <= 0) return null;
  return ((last - prev) / prev) * 100;
}

export function volatility(closes, period = 20) {
  if (!closes?.length || closes.length < period + 1) return null;
  const rets = [];
  for (let i = closes.length - period; i < closes.length; i++) {
    if (closes[i - 1] > 0) {
      rets.push((closes[i] - closes[i - 1]) / closes[i - 1]);
    }
  }
  if (rets.length < 2) return null;
  const mean = rets.reduce((s, v) => s + v, 0) / rets.length;
  const variance = rets.reduce((s, v) => s + (v - mean) ** 2, 0) / rets.length;
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}

export function percentileRank(value, values) {
  const valid = values.filter((v) => v != null && !Number.isNaN(v));
  if (!valid.length || value == null || Number.isNaN(value)) return null;
  const below = valid.filter((v) => v <= value).length;
  return (below / valid.length) * 100;
}
