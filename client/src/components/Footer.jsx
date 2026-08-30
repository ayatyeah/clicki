import { Link } from 'react-router-dom';
import { PHONE, PHONE_TEL, TELEGRAM_URL, EMAIL, EMAIL_URL } from '../lib/config.js';
import { useLang } from '../i18n.jsx';
import LegalLinks from './LegalLinks.jsx';

const L = {
  ru: {
    tagline: 'Performance-платформа органических просмотров. Астана, Казахстан.',
    contacts: 'Контакты',
    rights: 'Все права защищены.',
    portal: 'Кабинет креатора',
    about: 'О нас',
    cookie: 'Настройки cookie',
    docs: 'Оферта',
    colContacts: 'Связаться',
    colNav: 'Разделы',
    emojiPre: 'Эмодзи — ',
    emojiPost: ', © Twitter, Inc. и участники проекта, лицензия CC BY 4.0.',
  },
  en: {
    tagline: 'Performance platform for organic views. Astana, Kazakhstan.',
    contacts: 'Contacts',
    rights: 'All rights reserved.',
    portal: 'Creator portal',
    about: 'About',
    cookie: 'Cookie settings',
    docs: 'Offer',
    colContacts: 'Get in touch',
    colNav: 'Sections',
    emojiPre: 'Emoji artwork by ',
    emojiPost: ', © Twitter, Inc. and other contributors, licensed under CC BY 4.0.',
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
        {/* Column headings on all four columns, not just the legal one — three
            unlabelled link piles beside one titled list read as an accident. */}
        <div className="site-footer__contacts">
          <div className="site-footer__col-title">{t.colContacts}</div>
          <a href={`tel:${PHONE_TEL}`}>{PHONE}</a>
          <a href={TELEGRAM_URL} target="_blank" rel="noreferrer">
            Telegram
          </a>
          <a href={EMAIL_URL}>{EMAIL}</a>
        </div>
        <nav className="site-footer__links" aria-label={t.colNav}>
          <div className="site-footer__col-title">{t.colNav}</div>
          <Link to="/about">{t.about}</Link>
          <Link to="/creator">{t.portal}</Link>
          <Link to="/contacts">{t.contacts}</Link>
          <button type="button" onClick={() => window.dispatchEvent(new Event('clicki:cookie-settings'))}>{t.cookie}</button>
        </nav>
        {/* Own column, not a couple of links tacked onto the nav above: the public
            offer is the contract a creator signs, and it has to be findable from
            any page without going through the registration form. */}
        <div className="site-footer__docs">
          <div className="site-footer__docs-title">{t.docs}</div>
          <LegalLinks />
        </div>
      </div>
      {/* ae-skip: this line contains ©, and lib/emoji.js swaps it via
          replaceChild, discarding the text node React created. React kept a
          reference to the now-detached node and, on a language change, updated
          it in vain — the attribution stayed stuck on whichever language was
          active at first render. The legal © doesn't need the sprite swap anyway. */}
      <div className="container site-footer__legal ae-skip">
        © {year} CLICKI. {t.rights}{' '}
        {/* CC BY 4.0 requires visible attribution for the Twemoji sprites used by lib/emoji.js. */}
        <span className="site-footer__attrib">
          {t.emojiPre}
          <a href="https://github.com/jdecked/twemoji" target="_blank" rel="noreferrer noopener">
            Twemoji
          </a>
          {t.emojiPost}
        </span>
      </div>
    </footer>
  );
}
