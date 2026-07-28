import { Link } from 'react-router-dom';
import { PHONE, PHONE_TEL, TELEGRAM_URL, EMAIL, EMAIL_URL } from '../lib/config.js';
import { useLang } from '../i18n.jsx';

const L = {
  ru: {
    tagline: 'Performance-платформа органических просмотров. Астана, Казахстан.',
    contacts: 'Контакты',
    privacy: 'Политика конфиденциальности',
    terms: 'Условия использования',
    rights: 'Все права защищены.',
    portal: 'Кабинет креатора',
    about: 'О нас',
    cookie: 'Настройки cookie',
    emojiPre: 'Эмодзи — ',
    emojiPost: ', © Twitter, Inc. и участники проекта, лицензия CC BY 4.0.',
  },
  en: {
    tagline: 'Performance platform for organic views. Astana, Kazakhstan.',
    contacts: 'Contacts',
    privacy: 'Privacy policy',
    terms: 'Terms of Service',
    rights: 'All rights reserved.',
    portal: 'Creator portal',
    about: 'About',
    cookie: 'Cookie settings',
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
        <div className="site-footer__contacts">
          <a href={`tel:${PHONE_TEL}`}>{PHONE}</a>
          <a href={TELEGRAM_URL} target="_blank" rel="noreferrer">
            Telegram
          </a>
          <a href={EMAIL_URL}>{EMAIL}</a>
        </div>
        <nav className="site-footer__links">
          <Link to="/about">{t.about}</Link>
          <Link to="/creator">{t.portal}</Link>
          <Link to="/contacts">{t.contacts}</Link>
          <Link to="/privacy">{t.privacy}</Link>
          <Link to="/terms">{t.terms}</Link>
          <button type="button" onClick={() => window.dispatchEvent(new Event('clicki:cookie-settings'))}>{t.cookie}</button>
        </nav>
      </div>
      {/* ae-skip: строка содержит ©, а lib/emoji.js подменяет его через
          replaceChild и выбрасывает текстовый узел, созданный React.
          React остаётся со ссылкой на отсоединённый узел и при смене
          языка обновляет его вхолостую — атрибуция застревала на языке
          первого рендера. Юридическому © подмена на спрайт и не нужна. */}
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
