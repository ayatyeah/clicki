import { useState } from 'react';
import { Link } from 'react-router-dom';
import Logo from './Logo.jsx';
import LangSwitch from './LangSwitch.jsx';
import { useLang } from '../i18n.jsx';

const L = {
  ru: {
    consult: 'Консультация',
    start: 'Стать креатором',
    contacts: 'Контакты',
    login: 'Войти',
    menu: 'Меню',
    home: 'Главная',
    links: {
      business: [
        ['Как работает', '#how'],
        ['Сравнение', '#compare'],
        ['Консультация', '#consult'],
      ],
      creator: [
        ['Как работает', '#how'],
        ['Требования', '#requirements'],
        ['Заявка', '#apply'],
      ],
      hub: [
        ['Бизнесу', '/business'],
        ['Креаторам', '/creators'],
        ['Контакты', '/contacts'],
      ],
    },
  },
  en: {
    consult: 'Consultation',
    start: 'Become a creator',
    contacts: 'Contacts',
    login: 'Log in',
    menu: 'Menu',
    home: 'Home',
    links: {
      business: [
        ['How it works', '#how'],
        ['Comparison', '#compare'],
        ['Consultation', '#consult'],
      ],
      creator: [
        ['How it works', '#how'],
        ['Requirements', '#requirements'],
        ['Apply', '#apply'],
      ],
      hub: [
        ['For business', '/business'],
        ['For creators', '/creators'],
        ['Contacts', '/contacts'],
      ],
    },
  },
};

/**
 * Funnel-scoped navbar. Shows section/page links for the current funnel plus a
 * single contextual CTA, so the two funnels never expose each other's mechanics
 * (ТЗ 2.5). Collapses into a hamburger menu on mobile.
 */
export default function Header({ variant = 'hub' }) {
  const { lang } = useLang();
  const t = L[lang] || L.ru;
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  const links = t.links[variant] || t.links.hub;

  const cta =
    variant === 'business' ? (
      <a className="btn btn--ghost btn--sm" href="#consult" onClick={close}>
        {t.consult}
      </a>
    ) : variant === 'creator' ? (
      <a className="btn btn--ghost btn--sm" href="#apply" onClick={close}>
        {t.start}
      </a>
    ) : (
      <Link className="btn btn--ghost btn--sm" to="/contacts" onClick={close}>
        {t.contacts}
      </Link>
    );

  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Logo to="/" />

        <button
          className="site-header__burger"
          onClick={() => setOpen((o) => !o)}
          aria-label={t.menu}
          aria-expanded={open}
        >
          <span />
          <span />
          <span />
        </button>

        <nav className={`site-nav ${open ? 'is-open' : ''}`}>
          <ul className="site-nav__links">
            {links.map(([label, target]) => (
              <li key={target}>
                {target.startsWith('/') ? (
                  <Link className="site-nav__link" to={target} onClick={close}>
                    {label}
                  </Link>
                ) : (
                  <a className="site-nav__link" href={target} onClick={close}>
                    {label}
                  </a>
                )}
              </li>
            ))}
          </ul>

          <div className="site-nav__actions">
            <LangSwitch />
            <Link className="site-header__login" to={variant === 'business' ? '/business-cabinet' : '/creator'} onClick={close}>
              {t.login}
            </Link>
            {cta}
          </div>
        </nav>

        {open && <button className="site-nav__backdrop" aria-label="Закрыть" onClick={close} />}
      </div>
    </header>
  );
}
