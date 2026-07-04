import { Link } from 'react-router-dom';
import Seo from '../components/Seo.jsx';
import Header from '../components/Header.jsx';
import { useLang } from '../i18n.jsx';

const COPY = {
  ru: {
    seoTitle: 'CLICKI - вход в платформу',
    seoDesc: 'Выберите, как вы хотите войти: как креатор или как бизнес.',
    title: 'Как вы хотите войти?',
    lead: 'Выберите свой кабинет — вход и функции отличаются для криэйторов и бизнеса.',
    creatorEyebrow: 'Я криэйтор',
    creatorTitle: 'Кабинет криэйтора',
    creatorDesc: 'Брифы, кошелёк, автосинк просмотров и AI-инструменты для съёмки.',
    businessEyebrow: 'Я бизнес',
    businessTitle: 'Кабинет бизнеса',
    businessDesc: 'Брифы, приёмка работ, аналитика кампании и AI-конструктор брифа.',
  },
  en: {
    seoTitle: 'CLICKI - log in to the platform',
    seoDesc: 'Choose how you want to log in: as a creator or as a business.',
    title: 'How do you want to log in?',
    lead: 'Pick your cabinet — login and features differ for creators and businesses.',
    creatorEyebrow: 'I’m a creator',
    creatorTitle: 'Creator cabinet',
    creatorDesc: 'Briefs, wallet, view auto-sync and AI tools for filming.',
    businessEyebrow: 'I’m a business',
    businessTitle: 'Business cabinet',
    businessDesc: 'Briefs, work review, campaign analytics and the AI brief constructor.',
  },
};

/** Role-choice gate reached from the main navbar's "Войти в платформу" — the
 * platform has two entirely separate login systems (creator vs business), so
 * this just routes to the right one instead of guessing. */
export default function LoginChoice() {
  const { lang } = useLang();
  const t = COPY[lang] || COPY.ru;
  return (
    <main className="login-gate">
      <Seo title={t.seoTitle} description={t.seoDesc} path="/login" noindex />
      <Header variant="hub" />
      <div className="login-gate__inner">
        <h1 className="login-gate__title">{t.title}</h1>
        <p className="login-gate__lead">{t.lead}</p>
        <div className="login-gate__choices">
          <Link to="/creator" className="login-gate__choice" data-track="Вход: криэйтор">
            <span className="login-gate__eyebrow login-gate__eyebrow--creator">{t.creatorEyebrow}</span>
            <span className="login-gate__choice-title">{t.creatorTitle}</span>
            <span className="login-gate__choice-desc">{t.creatorDesc}</span>
            <span className="login-gate__arrow" aria-hidden="true">→</span>
          </Link>
          <Link to="/business-cabinet" className="login-gate__choice" data-track="Вход: бизнес">
            <span className="login-gate__eyebrow login-gate__eyebrow--business">{t.businessEyebrow}</span>
            <span className="login-gate__choice-title">{t.businessTitle}</span>
            <span className="login-gate__choice-desc">{t.businessDesc}</span>
            <span className="login-gate__arrow" aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
