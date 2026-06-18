import { Link } from 'react-router-dom';
import { PHONE, PHONE_TEL, TELEGRAM_URL, EMAIL, EMAIL_URL } from '../lib/config.js';

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="container site-footer__inner">
        <div>
          <div className="site-footer__brand">CLICKI</div>
          <p className="site-footer__tagline">Performance-платформа органических просмотров. Астана, Казахстан.</p>
        </div>
        <div className="site-footer__contacts">
          <a href={`tel:${PHONE_TEL}`}>{PHONE}</a>
          <a href={TELEGRAM_URL} target="_blank" rel="noreferrer">
            Telegram
          </a>
          <a href={EMAIL_URL}>{EMAIL}</a>
        </div>
        <nav className="site-footer__links">
          <Link to="/contacts">Контакты</Link>
          <Link to="/privacy">Политика конфиденциальности</Link>
        </nav>
      </div>
      <div className="container site-footer__legal">© {year} CLICKI. Все права защищены.</div>
    </footer>
  );
}
