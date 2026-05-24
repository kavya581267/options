import {
  computeAtr,
  computeAtrSeries,
  computeEma,
  computeEmaSeries,
  computeRsi,
  computeSma,
  pctReturn,
  volatility,
} from './technical.js';
import { barsToSeries } from './bhavStore.js';
import { passesFinalFilter as applyBreakoutFilters } from './filterConfig.js';

const CONSOL_DAYS = 15;
const BREAKOUT_LOOKBACK = 20;

export function analyzeMarket(niftyBars) {
  if (!niftyBars?.length || niftyBars.length < 50) {
    return { bullish: false, reason: 'Insufficient Nifty history', return1m: null, return3m: null };
  }
  const { closes } = barsToSeries(niftyBars);
  const ema20 = computeEma(closes, 20);
  const ema50 = computeEma(closes, 50);
  const close = closes.at(-1);
  const bullish = close > ema20 && close > ema50 && ema20 > ema50;
  return {
    bullish,
    close,
    ema20,
    ema50,
    return1m: pctReturn(closes, 21),
    return3m: pctReturn(closes, 63),
  };
}

export function computeSectorReturns(symbolBars, sectorMap, lookback = 21) {
  const sectorCloses = new Map();

  for (const [symbol, bars] of symbolBars.entries()) {
    if (bars.length <= lookback) continue;
    const sector = sectorMap.get(symbol) || 'Unknown';
    if (sector === 'Unknown') continue;
    const ret = pctReturn(bars.map((b) => b.close), lookback);
    if (ret == null) continue;
    if (!sectorCloses.has(sector)) sectorCloses.set(sector, []);
    sectorCloses.get(sector).push(ret);
  }

  const sectorReturn = new Map();
  for (const [sector, rets] of sectorCloses.entries()) {
    sectorReturn.set(sector, rets.reduce((s, v) => s + v, 0) / rets.length);
  }
  return sectorReturn;
}

export function detectConsolidation(bars, days = CONSOL_DAYS) {
  if (bars.length < days + 5) return { base_score: 0, consolidated: false };

  const window = bars.slice(-days);
  const closes = window.map((b) => b.close);
  const highs = window.map((b) => b.high);
  const lows = window.map((b) => b.low);

  const rangePct =
    ((Math.max(...highs) - Math.min(...lows)) / Math.min(...lows)) * 100;
  const vol = volatility(closes, Math.min(15, closes.length - 1)) || 999;
  const atrSeries = computeAtrSeries(
    bars.map((b) => b.high),
    bars.map((b) => b.low),
    bars.map((b) => b.close),
    14
  );
  const atrNow = atrSeries.at(-1);
  const atrStart = atrSeries.at(-days);
  const atrContract = atrStart && atrNow ? atrNow < atrStart * 0.85 : false;

  let score = 0;
  if (rangePct < 8) score += 40;
  else if (rangePct < 12) score += 25;
  else if (rangePct < 15) score += 10;

  if (vol < 25) score += 30;
  else if (vol < 35) score += 15;

  if (atrContract) score += 30;

  return {
    base_score: Math.min(100, score),
    consolidated: score >= 50,
    range_pct: Number(rangePct.toFixed(2)),
    volatility: vol ? Number(vol.toFixed(2)) : null,
  };
}

export function detectVolumeDryUp(volumes) {
  if (volumes.length < 25) return { dry_up: false, ratio: null };
  const avg20 = computeSma(volumes.slice(0, -1), 20);
  const avg5 = computeSma(volumes.slice(-5), 5);
  if (!avg20 || !avg5) return { dry_up: false, ratio: null };
  const ratio = avg5 / avg20;
  return { dry_up: ratio < 0.6, ratio: Number(ratio.toFixed(2)) };
}

export function detectBreakout(bars) {
  if (bars.length < BREAKOUT_LOOKBACK + 1) {
    return { breakout: false, breakout_flag: false };
  }

  const today = bars.at(-1);
  const prior = bars.slice(-(BREAKOUT_LOOKBACK + 1), -1);
  const highestHigh20 = Math.max(...prior.map((b) => b.high));
  const avgVol20 = prior.reduce((s, b) => s + b.volume, 0) / prior.length;
  const volRatio = avgVol20 > 0 ? today.volume / avgVol20 : 0;

  const priceBreak = today.close > highestHigh20;
  const volBreak = volRatio >= 2;

  return {
    breakout: priceBreak && volBreak,
    breakout_flag: priceBreak && volBreak,
    highest_high_20: highestHigh20,
    avg_volume_20: Math.round(avgVol20),
    vol_ratio: Number(volRatio.toFixed(2)),
    price_break: priceBreak,
    volume_break: volBreak,
  };
}

export function analyzeStock(bars, niftyBars, sectorReturn, niftyReturn1m) {
  if (!bars?.length || bars.length < 50) {
    return { eligible: false, reason: 'Insufficient history (min 50 days)' };
  }

  const hasNifty = niftyBars?.length >= 22;
  const niftyCloses = hasNifty ? niftyBars.map((b) => b.close) : [];
  const s = barsToSeries(bars);
  const { closes, highs, lows, volumes, deliveryPcts } = s;
  const close = closes.at(-1);

  const ema20 = computeEma(closes, 20);
  const ema50 = computeEma(closes, 50);
  let ema200;
  let ema200_proxy = false;
  if (closes.length >= 200) {
    ema200 = computeEma(closes, 200);
  } else if (closes.length >= 50) {
    ema200 = computeSma(closes, 50);
    ema200_proxy = true;
  } else {
    ema200 = null;
  }
  const rsi14 = computeRsi(closes, 14);
  const atr14 = computeAtr(highs, lows, closes, 14);
  const atrSeries = computeAtrSeries(highs, lows, closes, 14);
  const atrAvg20 = computeSma(atrSeries.filter(Boolean).slice(-20), 20);
  const avgVolume20 = computeSma(volumes.slice(0, -1), 20);
  const highestHigh20 = Math.max(...highs.slice(-21, -1));
  const lowestLow20 = Math.min(...lows.slice(-21, -1));

  const return1m = pctReturn(closes, 21);
  const return3m = pctReturn(closes, 63);
  const vol = volatility(closes, 20);

  const niftyReturn = hasNifty ? pctReturn(niftyCloses, 21) : null;
  const relativeStrength =
    niftyReturn != null && return1m != null && niftyReturn !== 0
      ? return1m / niftyReturn
      : return1m;

  const rsPrev =
    hasNifty && closes.length > 22 && niftyCloses.length > 22
      ? pctReturn(closes.slice(0, -5), 21) /
        (pctReturn(niftyCloses.slice(0, -5), 21) || 1)
      : null;
  const rsRising = rsPrev != null && relativeStrength > rsPrev;

  const consolidation = detectConsolidation(bars);
  const dryUp = detectVolumeDryUp(volumes);
  const breakout = detectBreakout(bars);

  const deliveryToday = deliveryPcts.at(-1) || 0;
  const deliveryAvg5 = computeSma(deliveryPcts.slice(-5), 5);
  const deliveryAvg20 = computeSma(deliveryPcts.slice(-20), 20);
  const deliveryTrendRising =
    deliveryAvg5 != null && deliveryAvg20 != null && deliveryAvg5 > deliveryAvg20;

  const atrExpansion = atr14 != null && atrAvg20 != null && atr14 > atrAvg20;

  const aboveEma50 = ema50 != null && close > ema50;
  const aboveEma200 = ema200 != null && close > ema200;

  const sectorRet = sectorReturn ?? 0;
  const sectorStrong =
    niftyReturn1m != null ? sectorRet > niftyReturn1m : sectorRet > 0;

  const breakoutAge = findBreakoutAge(bars);
  const stopLoss = atr14 ? close - 2 * atr14 : null;
  const target = atr14 ? close + 3 * atr14 : null;
  const riskReward =
    stopLoss && target && close > stopLoss
      ? (target - close) / (close - stopLoss)
      : null;

  const liquidityScore = scoreLiquidity(volumes, closes);

  return {
    eligible: true,
    close,
    ema20,
    ema50,
    ema200,
    ema200_proxy,
    rsi14: rsi14 != null ? Number(rsi14.toFixed(2)) : null,
    atr14: atr14 != null ? Number(atr14.toFixed(2)) : null,
    avg_volume_20: avgVolume20 != null ? Math.round(avgVolume20) : null,
    highest_high_20: highestHigh20,
    lowest_low_20: lowestLow20,
    volume: volumes.at(-1),
    delivery_pct: Number(deliveryToday.toFixed(2)),
    delivery_trend_rising: deliveryTrendRising,
    return_1m: return1m != null ? Number(return1m.toFixed(2)) : null,
    return_3m: return3m != null ? Number(return3m.toFixed(2)) : null,
    volatility: vol != null ? Number(vol.toFixed(2)) : null,
    relative_strength:
      relativeStrength != null ? Number(relativeStrength.toFixed(3)) : null,
    rs_rising: rsRising,
    base_score: consolidation.base_score,
    consolidated: consolidation.consolidated,
    volume_dry_up: dryUp.dry_up,
    volume_dry_ratio: dryUp.ratio,
    breakout_flag: breakout.breakout_flag,
    breakout: breakout.breakout,
    vol_ratio: breakout.vol_ratio,
    atr_expansion: atrExpansion,
    above_ema50: aboveEma50,
    above_ema200: aboveEma200,
    sector_strong: sectorStrong,
    sector_return_1m: sectorRet != null ? Number(sectorRet.toFixed(2)) : null,
    breakout_age: breakoutAge?.age ?? null,
    distance_from_breakout_pct: breakoutAge?.distancePct ?? null,
    stop_loss: stopLoss != null ? Number(stopLoss.toFixed(2)) : null,
    target: target != null ? Number(target.toFixed(2)) : null,
    risk_reward: riskReward != null ? Number(riskReward.toFixed(2)) : null,
    liquidity_score: liquidityScore,
    data_days: bars.length,
  };
}

function findBreakoutAge(bars) {
  for (let age = 0; age < Math.min(10, bars.length - 21); age++) {
    const slice = bars.slice(0, bars.length - age);
    const b = detectBreakout(slice);
    if (b.breakout) {
      const level = b.highest_high_20;
      const close = slice.at(-1).close;
      const distancePct = level ? ((close - level) / level) * 100 : 0;
      return { age, distancePct: Number(distancePct.toFixed(2)) };
    }
  }
  return null;
}

function scoreLiquidity(volumes, closes) {
  const vol = volumes.at(-1) || 0;
  const close = closes.at(-1) || 0;
  const turnover = vol * close;
  if (turnover > 50_000_000) return 100;
  if (turnover > 10_000_000) return 75;
  if (turnover > 2_000_000) return 50;
  if (turnover > 500_000) return 25;
  return 10;
}

export function computeCompositeScore(row, marketBullish) {
  let trendScore = 0;
  if (row.above_ema50) trendScore += 10;
  if (row.above_ema200) trendScore += 10;
  if (marketBullish) trendScore += 5;

  let rsScore = 0;
  if (row.relative_strength != null && row.relative_strength > 1) rsScore += 10;
  if (row.relative_strength != null && row.relative_strength > 1.2) rsScore += 5;
  if (row.rs_rising) rsScore += 5;

  let volumeScore = 0;
  if (row.volume_dry_up) volumeScore += 10;
  if (row.vol_ratio >= 2) volumeScore += 10;

  const baseScore = (row.base_score / 100) * 15;

  let deliveryScore = 0;
  if (row.delivery_pct > 45) deliveryScore += 7;
  if (row.delivery_trend_rising) deliveryScore += 3;

  let atrScore = row.atr_expansion ? 10 : 0;
  let breakoutScore = row.breakout_flag ? 5 : 0;

  const final_score = Number(
    (
      trendScore +
      rsScore +
      volumeScore +
      baseScore +
      deliveryScore +
      atrScore +
      breakoutScore
    ).toFixed(2)
  );

  return {
    trend_score: trendScore,
    rs_score: rsScore,
    volume_score: volumeScore,
    base_score_component: Number(baseScore.toFixed(2)),
    delivery_score: deliveryScore,
    atr_score: atrScore,
    breakout_score: breakoutScore,
    final_score,
  };
}

export function passesFinalFilter(row, market, filters) {
  return applyBreakoutFilters(row, market, filters);
}
