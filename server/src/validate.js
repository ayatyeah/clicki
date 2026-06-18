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

const CLIENT_FIELDS = {
  name: { label: 'Имя', required: true },
  company: { label: 'Компания', required: false },
  phone: { label: 'Телефон', required: true },
  email: { label: 'Email', required: false },
  niche: { label: 'Сфера бизнеса', required: false },
  comment: { label: 'Комментарий', required: false },
};

const CREATOR_FIELDS = {
  name: { label: 'Имя', required: true },
  contact: { label: 'Телефон/Telegram', required: true },
  socials: { label: 'Соцсети', required: true },
  city: { label: 'Город', required: false },
  examples: { label: 'Примеры контента', required: false },
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

  // Creators must confirm 18+.
  if (funnel === 'creator' && body?.adult !== true && body?.adult !== 'true') {
    errors.push('Необходимо подтверждение 18+');
  }

  // Phone sanity check (client funnel).
  if (funnel === 'client' && body?.phone && !isPhone(clean(body.phone))) {
    errors.push('Укажите корректный номер телефона');
  }

  return { ok: errors.length === 0, errors, fields };
}
