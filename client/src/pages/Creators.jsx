import Seo from '../components/Seo.jsx';
import Header from '../components/Header.jsx';
import Footer from '../components/Footer.jsx';
import FloatingContacts from '../components/FloatingContacts.jsx';
import Reveal from '../components/Reveal.jsx';
import LeadForm from '../components/LeadForm.jsx';
import PlatformChips from '../components/PlatformChips.jsx';
import DeviceScene from '../three/DeviceScene.jsx';
import { TELEGRAM_URL } from '../lib/config.js';

const CREATOR_FIELDS = [
  { name: 'name', label: 'Имя', required: true, autoComplete: 'name', placeholder: 'Как тебя зовут' },
  { name: 'contact', label: 'Телефон / Telegram', required: true, placeholder: '+7 ___ или @username' },
  { name: 'socials', label: 'Ссылки на соцсети', required: true, placeholder: 'TikTok, Instagram и др.' },
  { name: 'city', label: 'Город', placeholder: 'Откуда ты' },
  { name: 'examples', label: 'Примеры контента', type: 'textarea', placeholder: 'Ссылки на твои ролики (по желанию)' },
];

const SLOGANS = [
  'Твой рост — твой доход.',
  'Снимай из дома. Зарабатывай на органике.',
  'Стань UGC-креатором для десятков брендов, а не заложником одного.',
  'Построй портфолио, которое работает на тебя.',
];

export default function Creators() {
  return (
    <>
      <Seo
        title="CLICKI для креаторов — снимай и зарабатывай на органике"
        description="Стань UGC-креатором: снимай короткие видео из дома, расти в органике и развивай портфолио."
        path="/creators"
      />
      <Header variant="creator" />
      <main className="funnel funnel--creator">
        {/* 6.1 Hero */}
        <section className="hero hero--creator">
          <div className="container hero__inner">
            <Reveal className="hero__copy">
              <span className="badge badge--green">Для тех, кто живёт в телефоне 📱</span>
              <h1 className="hero__title">
                Снимай. Выкладывай.<br />
                <span className="accent">Поднимайся.</span>
              </h1>
              <p className="hero__subtitle">
                Бери телефон, снимай короткие видео из дома и превращай свой рост в реальный доход. Без графика, без
                начальника, без потолка.
              </p>
              <div className="hero__actions">
                <a href="#apply" className="btn btn--green btn--lg">
                  Стать креатором
                </a>
                <a href="#how" className="btn btn--ghost btn--lg">
                  Как это работает
                </a>
              </div>
            </Reveal>
            <Reveal className="hero__art hero__art--device">
              <DeviceScene variant="green" interactive className="hero__device hero__device--lg" />
            </Reveal>
          </div>
        </section>

        {/* Slogans — right after the hero */}
        <section className="slogans">
          <div className="container">
            <div className="slogans__grid">
              {SLOGANS.map((s, i) => (
                <Reveal key={i} className="slogans__item" delay={i * 60}>
                  «{s}»
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* 6.2 Essence */}
        <Section id="essence" eyebrow="Суть" title="Что ты делаешь">
          <ol className="steps">
            <Step n="1" title="Получаешь бриф" text="Платформа присылает задание от бренда." />
            <Step n="2" title="Снимаешь видео" text="Короткое вертикальное видео на свой открытый аккаунт." />
            <Step n="3" title="Публикуешь" text="Чем больше живых органических просмотров — тем выше доход." />
            <Step n="4" title="Всё удалённо" text="Со своего телефона, в удобное время." />
          </ol>
        </Section>

        {/* 6.3 Why us */}
        <Section eyebrow="Почему стоит идти к нам" title="Что ты получаешь" tone="green">
          <div className="cards cards--3">
            <Card title="Работа с разными брендами" text="Ты не заложник одного заказчика — снимаешь для десятков компаний и ниш." />
            <Card title="Свой шанс стать креатором" text="Не «контент для одного бренда», а полноценная профессия и репутация." />
            <Card title="Собственное портфолио" text="Каждое задание прокачивает твою папку кейсов, с которой можно расти дальше." />
            <Card title="Реальный маркетинг" text="Учишься тому, как устроены продвижение и виральность, изнутри." />
            <Card title="Заработок из дома" text="Несложно, гибко, без графика и начальника над душой." />
            <Card title="Рост = доход" text="Чем сильнее ты в органике, тем больше зарабатываешь. Соревновательный дух и движение вперёд." />
          </div>
        </Section>

        {/* 6.4 How it works */}
        <Section id="how" eyebrow="Процесс" title="Как это работает для креатора">
          <ol className="steps">
            <Step n="1" title="Подаёшь заявку" text="И проходишь проверку." />
            <Step n="2" title="Получаешь брифы" text="Под разные бренды." />
            <Step n="3" title="Снимаешь и публикуешь" text="По техническому заданию." />
            <Step n="4" title="Набираешь просмотры" text="Растёшь и зарабатываешь." />
          </ol>
        </Section>

        {/* 6.5 Platforms */}
        <Section eyebrow="Каналы" title="На каких платформах" tone="muted">
          <PlatformChips />
          <p className="muted-note">Снимай там, где тебе удобно.</p>
        </Section>

        {/* 6.6 Who can become a creator */}
        <Section eyebrow="Требования" title="Кто может стать креатором">
          <div className="cards cards--4">
            <Card title="Открытый аккаунт" text="Публичный профиль в соцсетях." />
            <Card title="Оригинальный контент" text="Снимаешь сам по брифу." />
            <Card title="Телефон с камерой" text="Нормальное качество съёмки." />
            <Card title="18+ и желание расти" text="Возраст от 18 лет и драйв двигаться вперёд." />
          </div>
        </Section>

        {/* 6.8 Final CTA + form */}
        <section id="apply" className="cta-section cta-section--green">
          <div className="container cta-section__inner">
            <Reveal className="cta-section__copy">
              <h2 className="cta-section__title">Старт креатором</h2>
              <p className="cta-section__text">
                Заполни анкету — мы проверим заявку и пришлём первые брифы. Это бесплатно и ни к чему не обязывает.
              </p>
              <a href={TELEGRAM_URL} target="_blank" rel="noreferrer" className="btn btn--ghost">
                Telegram-сообщество
              </a>
            </Reveal>
            <Reveal className="cta-section__form">
              <LeadForm funnel="creator" fields={CREATOR_FIELDS} submitLabel="Стать креатором" requireAdult />
            </Reveal>
          </div>
        </section>
      </main>
      <Footer />
      <FloatingContacts />
    </>
  );
}

/* ---- Local presentational helpers ---- */

function Section({ id, eyebrow, title, tone = 'plain', children }) {
  return (
    <section id={id} className={`section section--${tone}`}>
      <div className="container">
        <Reveal as="header" className="section__head">
          {eyebrow && <span className="section__eyebrow">{eyebrow}</span>}
          <h2 className="section__title">{title}</h2>
        </Reveal>
        <Reveal>{children}</Reveal>
      </div>
    </section>
  );
}

function Card({ title, text }) {
  return (
    <div className="card">
      <h3 className="card__title">{title}</h3>
      <p className="card__text">{text}</p>
    </div>
  );
}

function Step({ n, title, text }) {
  return (
    <li className="step">
      <span className="step__num step__num--green">{n}</span>
      <div>
        <h3 className="step__title">{title}</h3>
        <p className="step__text">{text}</p>
      </div>
    </li>
  );
}
