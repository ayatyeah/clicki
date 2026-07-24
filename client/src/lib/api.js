import { API_BASE, RECAPTCHA_SITE_KEY } from './config.js';

// reCAPTCHA is temporarily disabled site-wide. The site key's domain is not
// verified in the reCAPTCHA console yet, so the v3 widget only threw a visible
// error badge over every page (there is no captcha on cabinet login itself).
// Re-enable by flipping this to true AND restoring the handleLead check in
// server/src/index.js once the domain is configured.
const RECAPTCHA_ENABLED = false;

// Load the reCAPTCHA v3 script once, lazily.
let recaptchaPromise = null;
function loadRecaptcha() {
  if (!RECAPTCHA_ENABLED || !RECAPTCHA_SITE_KEY) return Promise.resolve(null);
  if (recaptchaPromise) return recaptchaPromise;
  recaptchaPromise = new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
    s.async = true;
    s.onload = () => resolve(window.grecaptcha);
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
  });
  return recaptchaPromise;
}

async function getRecaptchaToken(action) {
  const grecaptcha = await loadRecaptcha();
  if (!grecaptcha) return '';
  return new Promise((resolve) => {
    grecaptcha.ready(() => {
      grecaptcha.execute(RECAPTCHA_SITE_KEY, { action }).then(resolve).catch(() => resolve(''));
    });
  });
}

/**
 * Submit a lead to the backend.
 * @param {'client'|'creator'} funnel
 * @param {object} fields
 * @returns {Promise<{ok:boolean, errors?:string[]}>}
 */
export async function submitLead(funnel, fields) {
  const recaptchaToken = await getRecaptchaToken(`lead_${funnel}`);
  const res = await fetch(`${API_BASE}/api/lead/${funnel}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...fields, recaptchaToken, page: window.location.pathname }),
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    /* non-JSON response */
  }
  if (!res.ok) {
    return { ok: false, errors: data.errors || ['Не удалось отправить заявку. Попробуйте ещё раз.'] };
  }
  return { ok: true };
}
