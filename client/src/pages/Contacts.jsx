import Seo from '../components/Seo.jsx';
import Header from '../components/Header.jsx';
import Footer from '../components/Footer.jsx';
import { useLang } from '../i18n.jsx';
import { PHONE, PHONE_TEL, TELEGRAM, TELEGRAM_URL, EMAIL, EMAIL_URL, LINKEDIN_URL } from '../lib/config.js';

const COPY = {
  ru: {
    seoTitle: 'CLICKI - контакты',
    seoDesc: 'Свяжитесь с командой CLICKI.',
    title: 'Контакты',
    lead: 'Performance-платформа органических просмотров. Астана, Казахстан.',
    phone: 'Телефон',
    email: 'Email',
  },
  en: {
    seoTitle: 'CLICKI - contacts',
    seoDesc: 'Get in touch with the CLICKI team.',
    title: 'Contacts',
    lead: 'Performance platform for organic views. Astana, Kazakhstan.',
    phone: 'Phone',
    email: 'Email',
  },
};

export default function Contacts() {
  const { lang } = useLang();
  const t = COPY[lang] || COPY.ru;
  return (
    <div className="page-light">
      <Seo title={t.seoTitle} description={t.seoDesc} path="/contacts" />
      <Header variant="hub" />
      <main className="page">
        <div className="container page__inner">
          <h1 className="page__title">{t.title}</h1>
          <p className="page__lead">{t.lead}</p>

          <div className="contacts-grid">
            <a className="contact-card" href={`tel:${PHONE_TEL}`}>
              <span className="contact-card__label">{t.phone}</span>
              <span className="contact-card__value">{PHONE}</span>
            </a>
            <a className="contact-card" href={TELEGRAM_URL} target="_blank" rel="noreferrer">
              <span className="contact-card__label">Telegram</span>
              <span className="contact-card__value">@{TELEGRAM}</span>
            </a>
            <a className="contact-card" href={EMAIL_URL}>
              <span className="contact-card__label">{t.email}</span>
              <span className="contact-card__value">{EMAIL}</span>
            </a>
            <a className="contact-card" href={LINKEDIN_URL} target="_blank" rel="noreferrer">
              <span className="contact-card__label">LinkedIn</span>
              <span className="contact-card__value">Assanali Tursumbayev</span>
            </a>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
