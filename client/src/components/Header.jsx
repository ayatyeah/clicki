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
    platformLogin: 'Войти в платформу',
    menu: 'Меню',
    close: 'Закрыть',
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
      // One "Оферта" entry instead of separate Политика/Условия links: the
      // /legal index lists all four documents (offer first) and keeps the nav
      // from growing every time a document is added.
      hub: [
        ['Бизнесу', '/business'],
        ['Креаторам', '/creators'],
        ['О нас', '/about'],
        ['Контакты', '/contacts'],
        ['Оферта', '/legal'],
      ],
    },
  },
  en: {
    consult: 'Consultation',
    start: 'Become a creator',
    contacts: 'Contacts',
    login: 'Log in',
    platformLogin: 'Log in to the platform',
    menu: 'Menu',
    close: 'Close',
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
        ['About', '/about'],
        ['Contacts', '/contacts'],
        ['Offer', '/legal'],
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

  // Business/creator funnels get their own contextual CTA (consult/apply);
  // the hub nav already lists Contacts as a link, so no second button there —
  // its one CTA is the platform login below.
  const cta =
    variant === 'business' ? (
      <a className="btn btn--ghost btn--sm" href="#consult" onClick={close}>
        {t.consult}
      </a>
    ) : variant === 'creator' ? (
      <a className="btn btn--ghost btn--sm" href="#apply" onClick={close}>
        {t.start}
      </a>
    ) : null;

  const loginTarget = variant === 'business' ? '/business-cabinet' : variant === 'creator' ? '/creator' : '/login';
  const isHub = variant !== 'business' && variant !== 'creator';

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
            <Link
              className={isHub ? 'site-header__login site-header__login--cta' : 'site-header__login'}
              to={loginTarget}
              onClick={close}
            >
              {isHub ? t.platformLogin : t.login}
            </Link>
            {cta}
          </div>
        </nav>

        {open && <button className="site-nav__backdrop" aria-label={t.close} onClick={close} />}
      </div>
    </header>
  );
}
