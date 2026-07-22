import { API_BASE, RECAPTCHA_SITE_KEY } from './config.js';

// Load the reCAPTCHA v3 script once, lazily.
let recaptchaPromise = null;
function loadRecaptcha() {
  if (!RECAPTCHA_SITE_KEY) return Promise.resolve(null);
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

export async function getRecaptchaToken(action) {
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
