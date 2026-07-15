import { useEffect, useRef } from 'react';
import Seo from '../components/Seo.jsx';
import Header from '../components/Header.jsx';
import Footer from '../components/Footer.jsx';
import { useLang } from '../i18n.jsx';
import { EMAIL, EMAIL_URL, TELEGRAM, TELEGRAM_URL } from '../lib/config.js';

const COPY = {
  ru: {
    seoTitle: 'О нас — CLICKI',
    seoDesc:
      'CLICKI — performance-платформа, соединяющая бренды и авторов короткого видео. Оплата по подтверждённым результатам. Астана, Казахстан.',
    title: 'О нас',
    lead:
      'CLICKI — performance-платформа, которая соединяет бренды и авторов короткого видеоконтента. Мы делаем органический охват измеримым: результат каждой кампании подтверждается фактическими данными, а расчёты между сторонами происходят по итогу, а не по обещаниям.',
    sections: [
      {
        h: 'Наша миссия',
        p: 'Сделать рынок UGC-контента прозрачным и предсказуемым для всех участников. Бренды получают понятный, проверяемый результат. Авторы получают честные и своевременные расчёты за свою работу. Платформа выступает нейтральным звеном, которое гарантирует единые правила для обеих сторон.',
      },
      {
        h: 'Как это работает',
        p: 'На платформе размещаются задания с чёткими требованиями к контенту. Авторы создают видео в соответствии с этими требованиями и публикуют их на своих площадках. CLICKI верифицирует результаты по объективным данным и обеспечивает расчёты между сторонами. Весь процесс — от брифа до отчёта — проходит внутри платформы.',
      },
    ],
    principlesHeading: 'Наши принципы',
    principles: [
      ['Оплата за результат.', 'Все расчёты на платформе привязаны к подтверждённым, измеримым показателям.'],
      ['Прозрачность.', 'Обе стороны видят статус кампании, критерии оценки и данные, на основе которых происходят расчёты.'],
      ['Единые правила.', 'Требования к контенту, порядок верификации и условия расчётов зафиксированы заранее и одинаковы для всех участников.'],
    ],
    companyHeading: 'Компания',
    company:
      'CLICKI основана в 2026 году в Астане, Казахстан. Мы начали с рынка Казахстана и строим платформу с архитектурой, рассчитанной на международное масштабирование.',
    teamHeading: 'Команда',
    team: [
      ['Асанали Турсумбаев', 'Founder & CEO'],
      ['Рауан Айдархан', 'Co-founder & COO'],
      ['Аят Балмағамбет', 'CTO'],
      ['Сергей Запорожец', 'CMO'],
    ],
    contactsHeading: 'Контакты',
    location: 'Астана, Казахстан',
  },
  en: {
    seoTitle: 'About — CLICKI',
    seoDesc:
      'CLICKI is a performance platform connecting brands and short-form video creators. Payment based on verified results. Astana, Kazakhstan.',
    title: 'About CLICKI',
    lead:
      'CLICKI is a performance platform connecting brands with short-form video creators. We make organic reach measurable: every campaign’s outcome is verified with actual data, and settlements between parties are based on results, not promises.',
    sections: [
      {
        h: 'Our Mission',
        p: 'To make the UGC market transparent and predictable for everyone involved. Brands get clear, verifiable outcomes. Creators get fair and timely compensation for their work. The platform acts as a neutral layer that guarantees the same rules for both sides.',
      },
      {
        h: 'How It Works',
        p: 'Campaigns with clear content requirements are published on the platform. Creators produce videos according to those requirements and publish them on their own channels. CLICKI verifies the results using objective data and handles settlements between parties. The entire process — from brief to report — happens inside the platform.',
      },
    ],
    principlesHeading: 'Our Principles',
    principles: [
      ['Pay for results.', 'All settlements on the platform are tied to verified, measurable metrics.'],
      ['Transparency.', 'Both sides see campaign status, evaluation criteria, and the data behind every settlement.'],
      ['One set of rules.', 'Content requirements, verification procedures, and settlement terms are fixed upfront and identical for all participants.'],
    ],
    companyHeading: 'Company',
    company:
      'CLICKI was founded in 2026 in Astana, Kazakhstan. We started in Kazakhstan and are building the platform with an architecture designed for international scale from day one.',
    teamHeading: 'Team',
    team: [
      ['Assanali Tursumbayev', 'Founder & CEO'],
      ['Rauan Aidarkhan', 'Co-founder & COO'],
      ['Ayat Balmagambet', 'CTO'],
      ['Sergey Zaporozhets', 'CMO'],
    ],
    contactsHeading: 'Contact',
    location: 'Astana, Kazakhstan',
  },
};

/**
 * Company "About" page. `/about` follows the language toggle; `/en/about` is a
 * dedicated English URL (Google for Startups reviews in English) that forces
 * the whole page to English on mount.
 */
export default function About({ forceLang }) {
  const { lang: ctxLang, setLang } = useLang();
  const lang = forceLang || ctxLang;
  const t = COPY[lang] || COPY.ru;

  // /en/about (for the EN startup-review) flips the whole page (header/footer too)
  // to English while it's open, but RESTORES the visitor's language on leave — so a
  // shared /en/about link no longer permanently switches a RU user's site to EN.
  const originalLang = useRef(ctxLang);
  useEffect(() => {
    if (!forceLang) return undefined;
    const prev = originalLang.current;
    setLang(forceLang);
    return () => setLang(prev);
  }, [forceLang, setLang]);

  return (
    <>
      <Seo title={t.seoTitle} description={t.seoDesc} path={forceLang === 'en' ? '/en/about' : '/about'} />
      <Header variant="hub" />
      <main className="page page--legal about-page">
        <div className="container page__inner">
          <h1 className="page__title">{t.title}</h1>
          <p className="page__lead">{t.lead}</p>

          {t.sections.map((s) => (
            <section className="legal-article" key={s.h}>
              <h2 className="legal-article__title">{s.h}</h2>
              <p className="legal-article__text">{s.p}</p>
            </section>
          ))}

          <section className="legal-article">
            <h2 className="legal-article__title">{t.principlesHeading}</h2>
            <ul className="about-principles">
              {t.principles.map(([term, text]) => (
                <li key={term} className="about-principle">
                  <b>{term}</b> {text}
                </li>
              ))}
            </ul>
          </section>

          <section className="legal-article">
            <h2 className="legal-article__title">{t.companyHeading}</h2>
            <p className="legal-article__text">{t.company}</p>
          </section>

          <section className="legal-article">
            <h2 className="legal-article__title">{t.teamHeading}</h2>
            <div className="about-team">
              {t.team.map(([name, role]) => (
                <div key={name} className="about-team__card">
                  <div className="about-team__name">{name}</div>
                  <div className="about-team__role">{role}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="legal-article">
            <h2 className="legal-article__title">{t.contactsHeading}</h2>
            <p className="legal-article__text about-contacts">
              <a href={EMAIL_URL}>{EMAIL}</a>
              <span aria-hidden="true"> · </span>
              <a href={TELEGRAM_URL} target="_blank" rel="noreferrer">Telegram: @{TELEGRAM}</a>
              <span aria-hidden="true"> · </span>
              {t.location}
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
