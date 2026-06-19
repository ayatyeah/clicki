import { Link } from 'react-router-dom';
import Seo from '../components/Seo.jsx';
import LangSwitch from '../components/LangSwitch.jsx';
import { useLang } from '../i18n.jsx';

const COPY = {
  ru: {
    seoTitle: 'CLICKI — performance-платформа органических просмотров',
    seoDesc: 'Реклама с оплатой за результат. Выберите свой путь: бизнес или креатор.',
    title1: 'Контент, который',
    title2: 'реально',
    accent: 'залетает',
    subtitle: 'Живая органика без накруток и фейка. Выбирай свою сторону — и погнали 👇',
    bizEyebrow: 'Я бизнес',
    bizTitle: 'Нужны просмотры',
    bizDesc: 'Продвигай продукт через живой контент и плати только за результат.',
    crEyebrow: 'Я креатор',
    crTitle: 'Хочу зарабатывать',
    crDesc: 'Снимай ролики с телефона и превращай свой рост в реальный доход.',
    contact: 'Связаться с нами',
  },
  en: {
    seoTitle: 'CLICKI — performance platform for organic views',
    seoDesc: 'Pay-for-result advertising. Pick your path: business or creator.',
    title1: 'Content that',
    title2: 'actually',
    accent: 'takes off',
    subtitle: 'Real organic reach — no bots, no fakes. Pick your side and let’s go 👇',
    bizEyebrow: 'I’m a business',
    bizTitle: 'I need views',
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
      <div className="container hub__inner">
        <div className="hub__topbar">
          <div className="hub__brand">
            <img className="hub__mark" src="/logo-mark.png" alt="" width="56" height="56" />
            <span className="hub__wordmark">CLICKI</span>
          </div>
          <LangSwitch />
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

        <Link to="/contacts" className="hub__link">
          {t.contact}
        </Link>
      </div>
    </main>
  );
}
