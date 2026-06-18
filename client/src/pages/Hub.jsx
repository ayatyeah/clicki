import { Link } from 'react-router-dom';
import Seo from '../components/Seo.jsx';

/**
 * Neutral entry point (ТЗ 4.1). Short slogan + two CTAs that route visitors
 * into the two isolated funnels. No business mechanics are revealed here.
 */
export default function Hub() {
  return (
    <main className="hub">
      <Seo
        title="CLICKI — performance-платформа органических просмотров"
        description="Реклама с оплатой за результат. Выберите свой путь: бизнес или креатор."
        path="/"
      />
      <div className="hub__bg" aria-hidden="true" />
      <div className="container hub__inner">
        <div className="hub__brand">
          <img className="hub__mark" src="/logo-mark.png" alt="" width="56" height="56" />
          <span className="hub__wordmark">CLICKI</span>
        </div>
        <h1 className="hub__title">
          Контент, который
          <br />
          реально <span className="accent">залетает</span>
        </h1>
        <p className="hub__subtitle">Живая органика без накруток и фейка. Выбирай свою сторону — и погнали 👇</p>

        <div className="hub__choices">
          <Link to="/business" className="choice choice--business">
            <span className="choice__eyebrow">Я бизнес</span>
            <span className="choice__title">Нужны просмотры</span>
            <span className="choice__desc">Продвигай продукт через живой контент и плати только за результат.</span>
            <span className="choice__arrow" aria-hidden="true">→</span>
          </Link>

          <Link to="/creators" className="choice choice--creator">
            <span className="choice__eyebrow">Я креатор</span>
            <span className="choice__title">Хочу зарабатывать</span>
            <span className="choice__desc">Снимай ролики с телефона и превращай свой рост в реальный доход.</span>
            <span className="choice__arrow" aria-hidden="true">→</span>
          </Link>
        </div>

        <Link to="/contacts" className="hub__link">
          Связаться с нами
        </Link>
      </div>
    </main>
  );
}
