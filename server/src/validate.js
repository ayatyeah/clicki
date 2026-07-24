/** Lightweight, dependency-free validation + sanitisation for lead payloads. */

const MAX_LEN = 500;

function clean(value) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, MAX_LEN);
}

function isPhone(value) {
  // Accepts +, digits, spaces, dashes, parentheses — 7..20 chars of signal.
  const digits = value.replace(/[^\d]/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

/**
 * A business account's contact — the one way we can actually reach a brand:
 * a phone number or a Telegram handle. Returns the canonical form to store, or
 * null when the value is neither (the caller turns that into a 400).
 *
 * Telegram is stored as `@handle` no matter how it was typed (@handle, t.me/…,
 * https://t.me/…) so the admin table can build a link without re-parsing.
 * Phones keep their leading `+` when given but lose spacing — we never infer a
 * country code, because `8707…` and `+7707…` are both what someone meant to type.
 *
 * The client mirrors these rules in client/src/lib/contact.js for inline errors;
 * this copy is the authority.
 */
export function normalizeContact(raw) {
  const value = clean(raw);
  if (!value) return null;
  const tg = value.match(/^(?:(?:https?:\/\/)?(?:www\.)?t\.me\/|@)([a-zA-Z][a-zA-Z0-9_]{4,31})$/);
  if (tg) return `@${tg[1]}`;
  if (/^\+?[\d\s\-()]+$/.test(value) && isPhone(value)) {
    return (value.startsWith('+') ? '+' : '') + value.replace(/[^\d]/g, '');
  }
  return null;
}

/**
 * A Telegram handle on its own, however it was typed (@name, name, t.me/name,
 * https://t.me/name) — always stored as `@name` so the admin table can link it
 * without re-parsing. Returns null when the value isn't a handle at all.
 */
export function normalizeTelegram(raw) {
  const value = clean(raw);
  if (!value) return null;
  const m = value.match(/^(?:(?:https?:\/\/)?(?:www\.)?t\.me\/|@)?([a-zA-Z][a-zA-Z0-9_]{4,31})$/);
  return m ? `@${m[1]}` : null;
}

const CLIENT_FIELDS = {
  name: { label: 'Имя', required: true },
  company: { label: 'Компания', required: false },
  phone: { label: 'Телефон', required: true },
  telegram: { label: 'Telegram', required: false },
  email: { label: 'Email', required: false },
  niche: { label: 'Сфера бизнеса', required: false },
  comment: { label: 'Комментарий', required: false },
};

// Phone and Telegram are collected apart: operators work in Telegram, but a
// handle alone leaves nobody to call, so both are asked for outright.
const CREATOR_FIELDS = {
  name: { label: 'Имя', required: true },
  phone: { label: 'Телефон', required: true },
  telegram: { label: 'Telegram', required: true },
};

const SCHEMAS = { client: CLIENT_FIELDS, creator: CREATOR_FIELDS };

/**
 * Validate a raw request body for the given funnel.
 * Returns { ok, errors, fields } where `fields` is the cleaned label→value map.
 */
export function validateLead(funnel, body) {
  const schema = SCHEMAS[funnel];
  if (!schema) return { ok: false, errors: ['Неизвестная воронка'], fields: {} };

  const errors = [];
  const fields = {};

  for (const [key, def] of Object.entries(schema)) {
    const value = clean(body?.[key]);
    if (def.required && !value) {
      errors.push(`Поле «${def.label}» обязательно`);
      continue;
    }
    if (value) fields[def.label] = value;
  }

  // Consent checkbox must be explicitly accepted.
  if (body?.consent !== true && body?.consent !== 'true') {
    errors.push('Необходимо согласие на обработку персональных данных');
  }

  // Both funnels now carry a phone of their own.
  if (body?.phone && !isPhone(clean(body.phone))) {
    errors.push('Укажите корректный номер телефона');
  }

  // Store the handle canonically, or say plainly what a handle looks like.
  if (body?.telegram) {
    const tg = normalizeTelegram(body.telegram);
    if (!tg) errors.push('Telegram укажите в виде @username');
    else if (fields.Telegram) fields.Telegram = tg;
  }

  return { ok: errors.length === 0, errors, fields };
}
