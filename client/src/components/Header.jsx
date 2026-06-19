import { Link } from 'react-router-dom';
import Logo from './Logo.jsx';
import LangSwitch from './LangSwitch.jsx';
import { useLang } from '../i18n.jsx';

const L = {
  ru: { home: '← На главную', consult: 'Получить консультацию', start: 'Стать креатором', contacts: 'Контакты' },
  en: { home: '← Home', consult: 'Get a consultation', start: 'Become a creator', contacts: 'Contacts' },
};

/**
 * Funnel-scoped header. `variant` controls the single contextual CTA so the two
 * funnels never expose each other's mechanics on the same screen (ТЗ 2.5).
 */
export default function Header({ variant = 'hub' }) {
  const { lang } = useLang();
  const t = L[lang] || L.ru;
  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Logo to="/" />
        <nav className="site-header__nav">
          {(variant === 'business' || variant === 'creator') && (
            <Link className="site-header__home" to="/">
              {t.home}
            </Link>
          )}
          <LangSwitch />
          {variant === 'business' && (
            <a className="btn btn--ghost btn--sm" href="#consult">
              {t.consult}
            </a>
          )}
          {variant === 'creator' && (
            <a className="btn btn--ghost btn--sm" href="#apply">
              {t.start}
            </a>
          )}
          {variant === 'hub' && (
            <Link className="btn btn--ghost btn--sm" to="/contacts">
              {t.contacts}
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
