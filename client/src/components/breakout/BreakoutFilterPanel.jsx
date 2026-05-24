import './BreakoutFilterPanel.css';

function toggleSector(list, sector) {
  return list.includes(sector) ? list.filter((s) => s !== sector) : [...list, sector];
}

export default function BreakoutFilterPanel({
  filters,
  onChange,
  catalog,
  sectors,
  disabled = false,
}) {
  const defs = catalog?.length ? catalog : [];

  const setFilter = (key, value) => {
    onChange({ ...filters, [key]: value });
  };

  const groups = [
    { id: 'market', label: 'Market & sector' },
    { id: 'trend', label: 'Trend' },
    { id: 'breakout', label: 'Breakout' },
    { id: 'volume', label: 'Volume' },
    { id: 'delivery', label: 'Delivery' },
    { id: 'base', label: 'Base' },
    { id: 'momentum', label: 'Momentum' },
  ];

  return (
    <div className="breakout-filters">
      {groups.map((group) => {
        const items = defs.filter((d) => d.group === group.id);
        if (!items.length) return null;
        return (
          <fieldset key={group.id} className="breakout-filter-group" disabled={disabled}>
            <legend>{group.label}</legend>
            <div className="breakout-filter-checks">
              {items.map((def) => (
                <label key={def.key} className="breakout-filter-check" title={def.description}>
                  <input
                    type="checkbox"
                    checked={Boolean(filters[def.key])}
                    onChange={(e) => setFilter(def.key, e.target.checked)}
                  />
                  <span>{def.label}</span>
                  {def.hasThreshold && filters[def.key] && (
                    <input
                      type="number"
                      className="breakout-filter-threshold"
                      value={filters[def.thresholdKey] ?? def.thresholdDefault}
                      min={0}
                      max={def.thresholdKey === 'delivery_pct_min' ? 100 : 100}
                      onChange={(e) =>
                        setFilter(def.thresholdKey, Number(e.target.value))
                      }
                    />
                  )}
                </label>
              ))}
            </div>
          </fieldset>
        );
      })}

      <fieldset className="breakout-filter-group" disabled={disabled}>
        <legend>Sector include (empty = all)</legend>
        <div className="breakout-sector-chips">
          {sectors.map((sector) => (
            <button
              key={`inc-${sector}`}
              type="button"
              className={`sector-chip ${filters.sectors_include?.includes(sector) ? 'active include' : ''}`}
              onClick={() =>
                setFilter('sectors_include', toggleSector(filters.sectors_include || [], sector))
              }
            >
              {sector}
            </button>
          ))}
          {!sectors.length && <span className="hint">Load sector.csv on server</span>}
        </div>
      </fieldset>

      <fieldset className="breakout-filter-group" disabled={disabled}>
        <legend>Sector exclude</legend>
        <div className="breakout-sector-chips">
          {sectors.map((sector) => (
            <button
              key={`exc-${sector}`}
              type="button"
              className={`sector-chip ${filters.sectors_exclude?.includes(sector) ? 'active exclude' : ''}`}
              onClick={() =>
                setFilter('sectors_exclude', toggleSector(filters.sectors_exclude || [], sector))
              }
            >
              {sector}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="breakout-filter-actions">
        <button
          type="button"
          className="btn-secondary"
          disabled={disabled}
          onClick={() =>
            onChange({
              require_market_bullish: false,
              require_sector_strong: false,
              require_above_ema50: true,
              require_above_ema200: false,
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
            })
          }
        >
          Relaxed preset
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={disabled}
          onClick={() =>
            onChange({
              require_market_bullish: true,
              require_sector_strong: true,
              require_above_ema50: true,
              require_above_ema200: true,
              require_breakout: true,
              require_volume_dry_up: true,
              require_delivery_min: true,
              delivery_pct_min: 45,
              require_consolidation: true,
              base_score_min: 50,
              require_atr_expansion: true,
              require_rs_rising: false,
              sectors_include: [],
              sectors_exclude: [],
            })
          }
        >
          Strict preset
        </button>
      </div>
    </div>
  );
}
