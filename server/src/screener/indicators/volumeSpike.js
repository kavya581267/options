export const volumeSpike = {
  id: 'volume_spike',
  label: 'Volume spike',
  description: "Today's volume vs average of prior trading days.",
  params: [
    {
      key: 'lookback',
      label: 'Avg volume lookback (days)',
      type: 'number',
      default: 20,
      min: 5,
      max: 60,
      step: 1,
    },
    {
      key: 'multiplier',
      label: 'Min spike multiplier',
      type: 'number',
      default: 2,
      min: 1.1,
      max: 10,
      step: 0.1,
    },
  ],
  minHistoryDays(params) {
    return (params.lookback || 20) + 2;
  },
  evaluate(ctx, params) {
    const lookback = Number(params.lookback) || 20;
    const multiplier = Number(params.multiplier) || 2;
    const volumes = ctx.volumes || [];

    if (volumes.length < lookback + 1) {
      return { matched: false, reason: `Need ${lookback + 1} days of volume` };
    }

    const todayVol = volumes[volumes.length - 1];
    const prior = volumes.slice(-(lookback + 1), -1);
    const avgVol = prior.reduce((sum, v) => sum + v, 0) / prior.length;

    if (!avgVol || avgVol <= 0) {
      return { matched: false, reason: 'Average volume is zero' };
    }

    const volRatio = todayVol / avgVol;
    const matched = volRatio >= multiplier;

    return {
      matched,
      volume: todayVol,
      avgVolume: Math.round(avgVol),
      volRatio: Number(volRatio.toFixed(2)),
      lookback,
      multiplier,
    };
  },
  columns(params) {
    const lb = params?.lookback || 20;
    return [
      { key: `volume_spike.volRatio`, label: `Vol × avg (${lb}d)`, metric: 'volRatio', numeric: true },
      { key: `volume_spike.volume`, label: 'Volume', metric: 'volume', numeric: true },
    ];
  },
};
