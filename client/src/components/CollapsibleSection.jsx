import { useState } from 'react';
import './CollapsibleSection.css';

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
      className={`collapsible-section ${open ? 'open' : 'collapsed'} ${className}`.trim()}
    >
      <button
        type="button"
        className="collapsible-section-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="collapsible-section-chevron" aria-hidden>
          {open ? '▼' : '▶'}
        </span>
        <span className="collapsible-section-title">{title}</span>
        {subtitle && <span className="collapsible-section-subtitle">{subtitle}</span>}
        {badge != null && badge !== '' && (
          <span className="collapsible-section-badge">{badge}</span>
        )}
      </button>
      {open && <div className="collapsible-section-body">{children}</div>}
    </section>
  );
}
