/** SL / target on total straddle premium */
export function computeExitLevels(entryPremium, side, cfg) {
  const slOffset = levelOffset(entryPremium, cfg.slType, cfg.slValue);
  const targetOffset = levelOffset(entryPremium, cfg.targetType, cfg.targetValue);
  const isShort = side === 'SELL';

  return {
    entryPremium,
    stopLoss: isShort ? entryPremium + slOffset : entryPremium - slOffset,
    target: isShort ? entryPremium - targetOffset : entryPremium + targetOffset,
  };
}

function levelOffset(premium, type, value) {
  if (type === 'fixed') return Number(value) || 0;
  return (premium * (Number(value) || 0)) / 100;
}

export function checkExit(currentPremium, levels, side) {
  const isShort = side === 'SELL';
  if (isShort) {
    if (currentPremium >= levels.stopLoss) return 'stop_loss';
    if (currentPremium <= levels.target) return 'target';
  } else {
    if (currentPremium <= levels.stopLoss) return 'stop_loss';
    if (currentPremium >= levels.target) return 'target';
  }
  return null;
}
