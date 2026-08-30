import { Link } from 'react-router-dom';
import Seo from '../components/Seo.jsx';
import Logo from '../components/Logo.jsx';
import { useLang } from '../i18n.jsx';

const COPY = {
  ru: { title: 'Страница не найдена - CLICKI', text: 'Такой страницы нет. Вернёмся на главную?', home: 'На главную' },
  en: { title: 'Page not found - CLICKI', text: 'This page doesn’t exist. Back to home?', home: 'Home' },
};

export default function NotFound() {
  const { lang } = useLang();
  const t = COPY[lang] || COPY.ru;
  return (
    <main className="thanks page-light">
      <Seo title={t.title} description="404" path="/404" noindex />
      <div className="thanks__inner">
        <Logo />
        <h1 className="thanks__title">404</h1>
        <p className="thanks__text">{t.text}</p>
        <div className="thanks__actions">
          <Link to="/" className="btn btn--primary">
            {t.home}
          </Link>
        </div>
      </div>
    </main>
  );
}
