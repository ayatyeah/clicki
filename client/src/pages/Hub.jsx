import { Link } from 'react-router-dom';
import Seo from '../components/Seo.jsx';
import LangSwitch from '../components/LangSwitch.jsx';
import { useLang } from '../i18n.jsx';

const COPY = {
  ru: {
    seoTitle: 'CLICKI - performance-платформа органических просмотров',
    seoDesc: 'Реклама с оплатой за результат. Выберите свой путь: бизнес или креатор.',
    title1: 'Контент, который',
    title2: 'реально',
    accent: 'залетает',
    subtitle: 'Живая органика без накруток и фейка. Выбирай свою сторону - и погнали 👇',
    bizEyebrow: 'Я бизнес',
    bizTitle: 'Хочу охваты',
    bizDesc: 'Продвигай продукт через живой контент и плати только за результат.',
    crEyebrow: 'Я креатор',
    crTitle: 'Хочу зарабатывать',
    crDesc: 'Снимай ролики с телефона и превращай свой рост в реальный доход.',
    contact: 'Связаться с нами',
  },
  en: {
    seoTitle: 'CLICKI - performance platform for organic views',
    seoDesc: 'Pay-for-result advertising. Pick your path: business or creator.',
    title1: 'Content that',
    title2: 'actually',
    accent: 'takes off',
    subtitle: 'Real organic reach - no bots, no fakes. Pick your side and let’s go 👇',
    bizEyebrow: 'I’m a business',
    bizTitle: 'I want reach',
    bizDesc: 'Promote your product through real content and pay only for results.',
    crEyebrow: 'I’m a creator',
    crTitle: 'I want to earn',
    crDesc: 'Film clips on your phone and turn your growth into real income.',
    contact: 'Get in touch',
  },
};

/**
 * Neutral entry point (ТЗ 4.1). Short slogan + two CTAs that route visitors
 * into the two isolated funnels. No business mechanics are revealed here.
 */
export default function Hub() {
  const { lang } = useLang();
  const t = COPY[lang] || COPY.ru;
  return (
    <main className="hub">
      <Seo title={t.seoTitle} description={t.seoDesc} path="/" />
      <div className="hub__bg" aria-hidden="true" />
      <div className="hub__logos" aria-hidden="true">
        <img src="/social/tiktok.svg" alt="" />
        <img src="/social/instagram.svg" alt="" />
        <img src="/social/youtube.svg" alt="" />
        <img src="/social/x.svg" alt="" />
        <img src="/social/threads.svg" alt="" />
      </div>
      <div className="container hub__inner">
        <div className="hub__topbar">
          <div className="hub__brand">
            <img className="hub__mark" src="/logo-mark.png" alt="" width="56" height="56" />
            <span className="hub__wordmark">CLICKI</span>
          </div>
          <div className="hub__topnav">
            <LangSwitch />
          </div>
        </div>
        <h1 className="hub__title">
          {t.title1}
          <br />
          {t.title2} <span className="accent">{t.accent}</span>
        </h1>
        <p className="hub__subtitle">{t.subtitle}</p>

        <div className="hub__choices">
          <Link to="/business" className="choice choice--business">
            <span className="choice__eyebrow">{t.bizEyebrow}</span>
            <span className="choice__title">{t.bizTitle}</span>
            <span className="choice__desc">{t.bizDesc}</span>
            <span className="choice__arrow" aria-hidden="true">→</span>
          </Link>

          <Link to="/creators" className="choice choice--creator">
            <span className="choice__eyebrow">{t.crEyebrow}</span>
            <span className="choice__title">{t.crTitle}</span>
            <span className="choice__desc">{t.crDesc}</span>
            <span className="choice__arrow" aria-hidden="true">→</span>
          </Link>
        </div>

        <div className="hub__links">
          <Link to="/contacts" className="hub__link">
            {t.contact}
          </Link>
        </div>

        <div className="hub__social">
          <a className="hub__social-btn" href="tel:+77753056326" title="+7 775 305 63 26" aria-label="Позвонить">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
              <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.4 0 .8-.2 1l-2.3 2.2z" />
            </svg>
          </a>
          <a className="hub__social-btn" href="tel:+77770814444" title="+7 777 081 44 44" aria-label="Позвонить">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
              <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.4 0 .8-.2 1l-2.3 2.2z" />
            </svg>
          </a>
          <a
            className="hub__social-btn"
            href="https://www.linkedin.com/in/assanali-tursumbayev-45795639a/"
            target="_blank"
            rel="noreferrer"
            aria-label="LinkedIn"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
              <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14zM8.34 9.5H5.67V18h2.67V9.5zM7 5.7a1.55 1.55 0 1 0 0 3.1 1.55 1.55 0 0 0 0-3.1zM18.33 18v-4.67c0-2.5-1.34-3.66-3.12-3.66-1.44 0-2.08.79-2.44 1.35V9.5h-2.66V18h2.66v-4.42c0-1.17.22-2.3 1.67-2.3 1.43 0 1.45 1.34 1.45 2.38V18h2.6z" />
            </svg>
          </a>
        </div>
      </div>

      {/* Persistent centered CTA docked at the bottom (trendsee-style) */}
      <div className="hub__cta-dock">
        <Link to="/contacts" className="btn btn--primary btn--lg">
          {t.contact}
        </Link>
      </div>
    </main>
  );
}
