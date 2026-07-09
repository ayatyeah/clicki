/**
 * PII masking for the public investor demo (/demo-admin).
 *
 * Those endpoints intentionally serve the REAL aggregate numbers with no auth,
 * but they previously also served raw leads — full name, phone and email of
 * everybody who ever filled in the form — to anyone who requested the URL.
 * Masking has to happen server-side: the demo page's own read-only guard is
 * client-side JS and does nothing for someone calling the endpoint with curl.
 */

/** "Иван Петров" -> "И*** П*****": keeps the shape of a name, identifies nobody. */
export function maskName(value) {
  const s = String(value ?? '').trim();
  if (!s) return '';
  return s
    .split(/\s+/)
    .map((word) => (word.length <= 1 ? word : `${word[0]}${'*'.repeat(Math.min(word.length - 1, 5))}`))
    .join(' ');
}

/** Masks phones, emails and @handles alike: enough shape to look real, not enough to reach anyone. */
export function maskContact(value) {
  const s = String(value ?? '').trim();
  if (!s) return '';
  const at = s.indexOf('@');
  if (at > 0) return `${s[0]}***${s.slice(at)}`; // e***@example.com
  const digits = s.replace(/\D/g, '');
  if (digits.length >= 5) return `${s.slice(0, 2)}•••••${s.slice(-2)}`;
  return `${s[0]}***`;
}

/**
 * Leads are stored as a label→value map built from the funnel schema
 * (server/src/validate.js), e.g. { "Имя": …, "Телефон": …, "Компания": … }.
 * Company / niche / comment are not personal identifiers and pass through, so
 * the demo still shows meaningful rows.
 */
export function maskLeadFields(fields) {
  return Object.fromEntries(
    Object.entries(fields || {}).map(([label, value]) => {
      if (/имя|name/i.test(label)) return [label, maskName(value)];
      if (/телефон|phone|email|почта|контакт|contact|telegram/i.test(label)) return [label, maskContact(value)];
      return [label, value];
    })
  );
}

/** A creator row as shown in demo tables: name + login masked, contact reduced. */
export function maskCreatorRow(row) {
  return { ...row, name: maskName(row.name), username: row.username ? maskName(row.username) : null };
}
