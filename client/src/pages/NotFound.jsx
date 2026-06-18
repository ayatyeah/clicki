import { Link } from 'react-router-dom';
import Seo from '../components/Seo.jsx';
import Logo from '../components/Logo.jsx';

export default function NotFound() {
  return (
    <main className="thanks">
      <Seo title="Страница не найдена — CLICKI" description="404" path="/404" />
      <div className="thanks__inner">
        <Logo />
        <h1 className="thanks__title">404</h1>
        <p className="thanks__text">Такой страницы нет. Вернёмся на главную?</p>
        <div className="thanks__actions">
          <Link to="/" className="btn btn--primary">
            На главную
          </Link>
        </div>
      </div>
    </main>
  );
}
