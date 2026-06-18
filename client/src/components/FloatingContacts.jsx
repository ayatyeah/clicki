import { PHONE_TEL, TELEGRAM_URL } from '../lib/config.js';

/** Floating mobile-friendly click-to-call + Telegram (ТЗ 7.4). */
export default function FloatingContacts() {
  return (
    <div className="floating-contacts" aria-label="Быстрые контакты">
      <a className="floating-contacts__btn floating-contacts__btn--call" href={`tel:${PHONE_TEL}`} aria-label="Позвонить">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
      </a>
      <a
        className="floating-contacts__btn floating-contacts__btn--tg"
        href={TELEGRAM_URL}
        target="_blank"
        rel="noreferrer"
        aria-label="Написать в Telegram"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
          <path d="M21.94 4.3 18.7 19.6c-.24 1.08-.88 1.34-1.78.84l-4.92-3.63-2.37 2.28c-.26.26-.48.48-.98.48l.35-4.98 9.06-8.19c.4-.35-.09-.55-.61-.2L6.66 13.2l-4.83-1.51c-1.05-.33-1.07-1.05.22-1.55L20.6 2.78c.87-.32 1.63.2 1.34 1.52z" />
        </svg>
      </a>
    </div>
  );
}
