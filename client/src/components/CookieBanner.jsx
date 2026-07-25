import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLang } from '../i18n.jsx';

// One key holds the whole decision: { choice: 'all' | 'essential', ts }. The ts
// is our record of when consent was given. Third-party trackers (GA/Pixel/
// Metrika) load ONLY when choice === 'all'; essential cookies (session token,
// language, referral tag) are never gated — the site cannot work without them.
const KEY = 'clicki_cookie_consent';

/** Read the stored choice: 'all' | 'essential' | null (not decided yet). */
export function getCookieConsent() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || 'null')?.choice || null;
  } catch {
    return null;
  }
}

const COPY = {
  ru: {
    title: 'Мы используем cookie',
    text: 'Необходимые cookie нужны для работы сайта — вход в кабинет и выбор языка, они включены всегда. С вашего согласия мы также используем аналитические cookie, чтобы понимать, как улучшать сервис.',
    more: 'Подробнее в политике',
    all: 'Принять все',
    ess: 'Только необходимые',
  },
  en: {
    title: 'We use cookies',
    text: 'Essential cookies keep the site working — signing in and your language choice; they are always on. With your consent we also use analytics cookies to understand how to improve the service.',
    more: 'More in the policy',
    all: 'Accept all',
    ess: 'Essential only',
  },
};

export default function CookieBanner({ onAcceptAll }) {
  const { lang } = useLang();
  const t = COPY[lang] || COPY.ru;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(!getCookieConsent());
    // The footer "Cookie settings" link fires this so a visitor can revisit or
    // withdraw their choice at any time (right to withdraw consent).
    const reopen = () => setOpen(true);
    window.addEventListener('clicki:cookie-settings', reopen);
    return () => window.removeEventListener('clicki:cookie-settings', reopen);
  }, []);

  if (!open) return null;

  const choose = (choice) => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ choice, ts: new Date().toISOString() }));
    } catch {
      /* private mode: can't persist, but still dismiss for this session */
    }
    if (choice === 'all' && typeof onAcceptAll === 'function') onAcceptAll();
    setOpen(false);
  };

  return (
    <div className="cookie" role="dialog" aria-label={t.title} aria-live="polite">
      <div className="cookie__card">
        <div className="cookie__body">
          <p className="cookie__title">{t.title}</p>
          <p className="cookie__text">
            {t.text}{' '}
            <Link className="cookie__link" to="/privacy">{t.more}</Link>.
          </p>
        </div>
        <div className="cookie__actions">
          <button type="button" className="cookie__btn cookie__btn--ghost" onClick={() => choose('essential')}>
            {t.ess}
          </button>
          <button type="button" className="cookie__btn cookie__btn--primary" onClick={() => choose('all')}>
            {t.all}
          </button>
        </div>
      </div>
    </div>
  );
}
