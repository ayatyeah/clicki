import { useState } from 'react';
import { PHONE_TEL, TELEGRAM_URL, WHATSAPP_URL } from '../lib/config.js';
import { useLang } from '../i18n.jsx';

const L = {
  ru: { quick: 'Быстрые контакты', call: 'Позвонить', tg: 'Написать в Telegram', wa: 'Написать в WhatsApp', open: 'Открыть быстрые контакты', close: 'Скрыть быстрые контакты' },
  en: { quick: 'Quick contacts', call: 'Call', tg: 'Message on Telegram', wa: 'Message on WhatsApp', open: 'Open quick contacts', close: 'Hide quick contacts' },
};

/** Floating click-to-call + Telegram + WhatsApp (ТЗ 7.4 / 10).
 *
 *  Collapsed behind one trigger on phones: three permanent 54px circles plus the
 *  Assistant FAB covered the bottom of a 390px viewport, sitting on exactly the
 *  content a thumb scrolls to (the comparison table, the lead form's last
 *  fields). The trigger is display:none from 641px up, where the stack has room
 *  to stay open — see .floating-contacts in styles/index.css. */
export default function FloatingContacts() {
  const { lang } = useLang();
  const t = L[lang] || L.ru;
  const [open, setOpen] = useState(false);
  return (
    <div className={`floating-contacts ${open ? 'is-open' : ''}`} aria-label={t.quick}>
      <button
        type="button"
        className="floating-contacts__toggle"
        aria-expanded={open}
        aria-label={open ? t.close : t.open}
        onClick={() => setOpen((v) => !v)}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />}
        </svg>
      </button>
      <a className="floating-contacts__btn floating-contacts__btn--call" href={`tel:${PHONE_TEL}`} aria-label={t.call}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
      </a>
      <a
        className="floating-contacts__btn floating-contacts__btn--wa"
        href={WHATSAPP_URL}
        target="_blank"
        rel="noreferrer"
        aria-label={t.wa}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.86 9.86 0 0 0 12.04 2zm5.8 14.16c-.24.68-1.4 1.3-1.94 1.38-.5.07-1.12.1-1.81-.11-.42-.13-.95-.31-1.64-.6-2.88-1.24-4.76-4.14-4.9-4.33-.14-.19-1.17-1.56-1.17-2.97s.74-2.11 1-2.4c.26-.29.57-.36.76-.36l.55.01c.18.01.41-.07.64.49.24.57.81 1.98.88 2.12.07.14.12.31.02.5-.1.19-.15.31-.29.48-.14.17-.3.38-.43.5-.14.14-.29.29-.13.57.16.28.71 1.18 1.53 1.91 1.05.94 1.94 1.23 2.22 1.37.28.14.44.12.6-.07.16-.19.69-.81.87-1.08.18-.28.36-.23.61-.14.25.09 1.6.76 1.87.9.28.14.46.21.53.33.07.12.07.68-.17 1.36z" />
        </svg>
      </a>
      <a
        className="floating-contacts__btn floating-contacts__btn--tg"
        href={TELEGRAM_URL}
        target="_blank"
        rel="noreferrer"
        aria-label={t.tg}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
          <path d="M21.94 4.3 18.7 19.6c-.24 1.08-.88 1.34-1.78.84l-4.92-3.63-2.37 2.28c-.26.26-.48.48-.98.48l.35-4.98 9.06-8.19c.4-.35-.09-.55-.61-.2L6.66 13.2l-4.83-1.51c-1.05-.33-1.07-1.05.22-1.55L20.6 2.78c.87-.32 1.63.2 1.34 1.52z" />
        </svg>
      </a>
    </div>
  );
}
