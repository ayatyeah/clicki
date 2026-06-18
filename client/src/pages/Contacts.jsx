import Seo from '../components/Seo.jsx';
import Header from '../components/Header.jsx';
import Footer from '../components/Footer.jsx';
import { PHONE, PHONE_TEL, TELEGRAM, TELEGRAM_URL, EMAIL, EMAIL_URL } from '../lib/config.js';

export default function Contacts() {
  return (
    <>
      <Seo title="CLICKI — контакты" description="Свяжитесь с командой CLICKI." path="/contacts" />
      <Header variant="hub" />
      <main className="page">
        <div className="container page__inner">
          <h1 className="page__title">Контакты</h1>
          <p className="page__lead">Performance-платформа органических просмотров. Астана, Казахстан.</p>

          <div className="contacts-grid">
            <a className="contact-card" href={`tel:${PHONE_TEL}`}>
              <span className="contact-card__label">Телефон</span>
              <span className="contact-card__value">{PHONE}</span>
            </a>
            <a className="contact-card" href={TELEGRAM_URL} target="_blank" rel="noreferrer">
              <span className="contact-card__label">Telegram</span>
              <span className="contact-card__value">@{TELEGRAM}</span>
            </a>
            <a className="contact-card" href={EMAIL_URL}>
              <span className="contact-card__label">Email</span>
              <span className="contact-card__value">{EMAIL}</span>
            </a>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
