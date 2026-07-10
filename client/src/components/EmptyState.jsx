/**
 * Consistent empty state: an icon, a line of text, and an optional action —
 * instead of the bare grey "Пока ничего нет" strings scattered around the
 * cabinets. Keeps empty screens feeling intentional rather than broken.
 */
export default function EmptyState({ icon = '📭', title, hint, action }) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon" aria-hidden="true">{icon}</div>
      {title && <p className="empty-state__title">{title}</p>}
      {hint && <p className="empty-state__hint">{hint}</p>}
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  );
}
