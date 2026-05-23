import { defaultParamsForIndicator } from '../../api/screener';
import './IndicatorBuilder.css';

function ParamField({ field, value, onChange, disabled }) {
  if (field.type === 'select') {
    return (
      <label className="indicator-param">
        <span>{field.label}</span>
        <select
          value={value ?? field.default}
          disabled={disabled}
          onChange={(e) => onChange(field.key, e.target.value)}
        >
          {(field.options || []).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <label className="indicator-param">
      <span>{field.label}</span>
      <input
        type="number"
        value={value ?? field.default}
        min={field.min}
        max={field.max}
        step={field.step ?? 1}
        disabled={disabled}
        onChange={(e) => onChange(field.key, Number(e.target.value))}
      />
    </label>
  );
}

export default function IndicatorBuilder({
  catalog,
  query,
  onChange,
  disabled = false,
}) {
  const usedIds = new Set((query.indicators || []).map((i) => i.id));
  const available = catalog.filter((i) => !usedIds.has(i.id));

  const updateIndicator = (index, key, value) => {
    const next = {
      ...query,
      indicators: query.indicators.map((item, i) =>
        i === index
          ? { ...item, params: { ...item.params, [key]: value } }
          : item
      ),
    };
    onChange(next);
  };

  const removeIndicator = (index) => {
    onChange({
      ...query,
      indicators: query.indicators.filter((_, i) => i !== index),
    });
  };

  const addIndicator = (id) => {
    const def = catalog.find((i) => i.id === id);
    if (!def) return;
    onChange({
      ...query,
      indicators: [
        ...query.indicators,
        { id, params: defaultParamsForIndicator(def) },
      ],
    });
  };

  return (
    <div className="indicator-builder">
      <div className="indicator-builder-head">
        <div>
          <h3>Screen rules</h3>
          <p className="hint">Combine indicators — stock must pass every rule (AND) or any rule (OR).</p>
        </div>
        <label className="logic-toggle">
          <span>Logic</span>
          <select
            value={query.logic || 'AND'}
            disabled={disabled}
            onChange={(e) => onChange({ ...query, logic: e.target.value })}
          >
            <option value="AND">AND (all must match)</option>
            <option value="OR">OR (any can match)</option>
          </select>
        </label>
      </div>

      <div className="indicator-list">
        {(query.indicators || []).map((item, index) => {
          const def = catalog.find((i) => i.id === item.id);
          if (!def) return null;

          return (
            <div key={`${item.id}-${index}`} className="indicator-card">
              {index > 0 && (
                <div className="indicator-logic-badge">{query.logic || 'AND'}</div>
              )}
              <div className="indicator-card-head">
                <div>
                  <strong>{def.label}</strong>
                  <p>{def.description}</p>
                </div>
                <button
                  type="button"
                  className="btn-text-danger"
                  disabled={disabled || query.indicators.length <= 1}
                  onClick={() => removeIndicator(index)}
                >
                  Remove
                </button>
              </div>
              <div className="indicator-params">
                {def.params.map((field) => (
                  <ParamField
                    key={field.key}
                    field={field}
                    value={item.params?.[field.key]}
                    disabled={disabled}
                    onChange={(key, value) => updateIndicator(index, key, value)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {available.length > 0 && (
        <div className="indicator-add">
          <label>
            <span>Add indicator</span>
            <select
              defaultValue=""
              disabled={disabled}
              onChange={(e) => {
                if (e.target.value) {
                  addIndicator(e.target.value);
                  e.target.value = '';
                }
              }}
            >
              <option value="">Choose indicator…</option>
              {available.map((ind) => (
                <option key={ind.id} value={ind.id}>
                  {ind.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </div>
  );
}
