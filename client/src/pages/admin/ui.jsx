import Icon from '../../components/Icon.jsx';

/**
 * Shared presentational primitives for the admin surfaces.
 *
 * `Stat` and `Kpi` were previously redefined, identically, in Admin.jsx,
 * AdminPlatform.jsx and DemoAdmin.jsx. One definition means a tweak to the card
 * lands everywhere instead of in one of three places.
 */

/**
 * Compact label/value pair for dense metric rows.
 *
 * `variant="text"` shrinks the value: the default 2.4rem display face is sized
 * for numbers, and a string like "production · v22.0.0" wraps into a mess at it.
 */
export function Stat({ label, value, variant }) {
  return (
    <div className={`admin-stat${variant === 'text' ? ' admin-stat--text' : ''}`}>
      <div className="admin-stat__value">{value}</div>
      <div className="admin-stat__label">{label}</div>
    </div>
  );
}

/** Headline metric card. `tone` ∈ violet | green | amber | rose. */
export function Kpi({ tone = 'violet', icon, value, label, hint }) {
  return (
    <div className={`kpi kpi--${tone}`}>
      <span className="kpi__icon"><Icon name={icon} /></span>
      <div className="kpi__value">{value}</div>
      <div className="kpi__label">{label}</div>
      {hint && <div className="kpi__hint">{hint}</div>}
    </div>
  );
}
