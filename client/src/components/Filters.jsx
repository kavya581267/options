import { useMemo } from 'react';
import './Filters.css';

function shiftDate(date, dates, direction) {
  const sorted = [...dates].sort();
  const idx = sorted.indexOf(date);
  if (idx === -1) return null;
  const nextIdx = idx + direction;
  if (nextIdx < 0 || nextIdx >= sorted.length) return null;
  return sorted[nextIdx];
}

export default function Filters({
  symbols,
  symbol,
  onSymbolChange,
  date,
  onDateChange,
  dates,
  timeFrom,
  timeTo,
  onTimeFromChange,
  onTimeToChange,
}) {
  const sortedDates = useMemo(() => [...dates].sort(), [dates]);
  const dateIndex = sortedDates.indexOf(date);
  const canGoOlder = dateIndex > 0;
  const canGoNewer =
    dateIndex >= 0 && dateIndex < sortedDates.length - 1;

  const goOlder = () => {
    const next = shiftDate(date, dates, -1);
    if (next) onDateChange(next);
  };

  const goNewer = () => {
    const next = shiftDate(date, dates, 1);
    if (next) onDateChange(next);
  };

  return (
    <div className="filters">
      <div className="filter-group">
        <label htmlFor="symbol">Index</label>
        <select
          id="symbol"
          value={symbol}
          onChange={(e) => onSymbolChange(e.target.value)}
        >
          {symbols.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-group date-filter">
        <label htmlFor="date">Date</label>
        <div className="date-nav">
          <button
            type="button"
            className="date-arrow"
            onClick={goOlder}
            disabled={!canGoOlder}
            aria-label="Previous day"
            title="Previous day"
          >
            ←
          </button>
          <input
            id="date"
            type="date"
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
            list="available-dates"
          />
          <button
            type="button"
            className="date-arrow"
            onClick={goNewer}
            disabled={!canGoNewer}
            aria-label="Next day"
            title="Next day"
          >
            →
          </button>
        </div>
        <datalist id="available-dates">
          {dates.map((d) => (
            <option key={d} value={d} />
          ))}
        </datalist>
      </div>

      <div className="filter-group">
        <label htmlFor="timeFrom">From</label>
        <input
          id="timeFrom"
          type="time"
          value={timeFrom}
          onChange={(e) => onTimeFromChange(e.target.value)}
          step="60"
        />
      </div>

      <div className="filter-group">
        <label htmlFor="timeTo">To</label>
        <input
          id="timeTo"
          type="time"
          value={timeTo}
          onChange={(e) => onTimeToChange(e.target.value)}
          step="60"
        />
      </div>
    </div>
  );
}
