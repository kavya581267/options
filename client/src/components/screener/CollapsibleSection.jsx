import { useState } from 'react';

export default function CollapsibleSection({
  title,
  subtitle,
  badge,
  defaultOpen = true,
  className = '',
  children,
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section
      className={`screener-section ${open ? 'open' : 'collapsed'} ${className}`.trim()}
    >
      <button
        type="button"
        className="screener-section-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="screener-section-chevron" aria-hidden>
          {open ? '▼' : '▶'}
        </span>
        <span className="screener-section-title">{title}</span>
        {subtitle && <span className="screener-section-subtitle">{subtitle}</span>}
        {badge != null && badge !== '' && (
          <span className="screener-section-badge">{badge}</span>
        )}
      </button>
      {open && <div className="screener-section-body">{children}</div>}
    </section>
  );
}
