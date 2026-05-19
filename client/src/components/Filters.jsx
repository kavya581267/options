import './Filters.css';

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

      <div className="filter-group">
        <label htmlFor="date">Date</label>
        <input
          id="date"
          type="date"
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
          list="available-dates"
        />
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
