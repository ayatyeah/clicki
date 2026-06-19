import { Link } from 'react-router-dom';
import { PHONE, PHONE_TEL, TELEGRAM_URL, EMAIL, EMAIL_URL } from '../lib/config.js';
import { useLang } from '../i18n.jsx';

const L = {
  ru: {
    tagline: 'Performance-платформа органических просмотров. Астана, Казахстан.',
    contacts: 'Контакты',
    privacy: 'Политика конфиденциальности',
    rights: 'Все права защищены.',
  },
  en: {
    tagline: 'Performance platform for organic views. Astana, Kazakhstan.',
    contacts: 'Contacts',
    privacy: 'Privacy policy',
    rights: 'All rights reserved.',
  },
};

export default function Footer() {
  const { lang } = useLang();
  const t = L[lang] || L.ru;
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="container site-footer__inner">
        <div>
          <div className="site-footer__brand">CLICKI</div>
          <p className="site-footer__tagline">{t.tagline}</p>
        </div>
        <div className="site-footer__contacts">
          <a href={`tel:${PHONE_TEL}`}>{PHONE}</a>
          <a href={TELEGRAM_URL} target="_blank" rel="noreferrer">
            Telegram
          </a>
          <a href={EMAIL_URL}>{EMAIL}</a>
        </div>
        <nav className="site-footer__links">
          <Link to="/contacts">{t.contacts}</Link>
          <Link to="/privacy">{t.privacy}</Link>
        </nav>
      </div>
      <div className="container site-footer__legal">© {year} CLICKI. {t.rights}</div>
    </footer>
  );
}
