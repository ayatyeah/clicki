/**
 * A business account's contact — a phone number or a Telegram handle.
 *
 * `normalizeContact` mirrors server/src/validate.js so a typo gets an inline
 * message instead of a round-trip; the server copy is the authority and re-checks
 * every write. Keep the two in sync when the rules change.
 *
 * Dependency-free on purpose, like ./safeHref.js — the portal pages must not pull
 * in utils.js (clsx + tailwind-merge) just to format a phone number.
 */
export function normalizeContact(raw) {
  const value = typeof raw === 'string' ? raw.trim().slice(0, 500) : '';
  if (!value) return null;
  const tg = value.match(/^(?:(?:https?:\/\/)?(?:www\.)?t\.me\/|@)([a-zA-Z][a-zA-Z0-9_]{4,31})$/);
  if (tg) return `@${tg[1]}`;
  if (/^\+?[\d\s\-()]+$/.test(value)) {
    const digits = value.replace(/[^\d]/g, '');
    if (digits.length >= 7 && digits.length <= 15) return (value.startsWith('+') ? '+' : '') + digits;
  }
  return null;
}

/**
 * Where "write to them" actually goes: a `tel:` dialer for a phone, Telegram for
 * a handle. Returns undefined for anything unrecognised so the caller renders
 * plain text rather than a dead link — same contract as safeHref().
 */
export function contactHref(contact) {
  const value = normalizeContact(contact);
  if (!value) return undefined;
  return value.startsWith('@') ? `https://t.me/${value.slice(1)}` : `tel:${value}`;
}
