import Seo from '../components/Seo.jsx';
import Header from '../components/Header.jsx';
import Footer from '../components/Footer.jsx';
import FloatingContacts from '../components/FloatingContacts.jsx';
import Reveal from '../components/Reveal.jsx';
import LeadForm from '../components/LeadForm.jsx';
import VideoShowcase from '../components/VideoShowcase.jsx';
import PlatformChips from '../components/PlatformChips.jsx';
import LaptopScene from '../three/LaptopScene.jsx';
import { PHONE, PHONE_TEL, TELEGRAM_URL, EMAIL, EMAIL_URL } from '../lib/config.js';

const CLIENT_FIELDS = [
  { name: 'name', label: 'Имя', required: true, autoComplete: 'name', placeholder: 'Как к вам обращаться' },
  { name: 'company', label: 'Компания', placeholder: 'Название бренда' },
  { name: 'phone', label: 'Телефон', type: 'tel', required: true, autoComplete: 'tel', placeholder: '+7 ___ ___ __ __' },
  { name: 'email', label: 'Email', type: 'email', autoComplete: 'email', placeholder: 'you@company.kz' },
  { name: 'niche', label: 'Сфера бизнеса', placeholder: 'Например: косметика, доставка, услуги' },
  { name: 'comment', label: 'Комментарий', type: 'textarea', placeholder: 'Коротко о задаче' },
];

export default function Business() {
  return (
    <>
      <Seo
        title="CLICKI для бизнеса — реклама с оплатой за просмотры"
        description="Первая автоматизированная платформа рекламы с оплатой за органические просмотры. Получите консультацию."
        path="/business"
      />
      <Header variant="business" />
      <main className="funnel funnel--business">
        {/* 5.1 Hero */}
        <section className="hero">
          <div className="container hero__inner">
            <Reveal as="div" className="hero__copy">
              <span className="badge">Performance-маркетинг нового поколения</span>
              <h1 className="hero__title">
                Платишь за <span className="accent">результат</span>, а не за надежду
              </h1>
              <p className="hero__subtitle">
                Первая платформа, где вы платите за живые просмотры, а не за обещания. Запуск за пару дней и никакого
                слитого бюджета.
              </p>
              <div className="hero__actions">
                <a href="#consult" className="btn btn--primary btn--lg">
                  Получить консультацию
                </a>
                <a href="#how" className="btn btn--ghost btn--lg">
                  Как это работает
                </a>
              </div>
              <a href={`tel:${PHONE_TEL}`} className="hero__call">
                ☎ {PHONE}
              </a>
            </Reveal>
            <Reveal className="hero__art hero__art--device">
              <LaptopScene interactive className="hero__device hero__device--lg" />
            </Reveal>
          </div>
        </section>

        {/* 5.2 Problem */}
        <Section id="problem" eyebrow="Проблема" title="Почему классическая реклама сливает бюджет">
          <div className="cards cards--2">
            <Card title="Слив бюджета" text="Платите блогеру фиксированный гонорар, а видео не набирает просмотров — деньги потеряны." />
            <Card title="Нет гарантий" text="Результат интеграций непредсказуем: стоимость привлечения растёт, отдача стремится к нулю." />
          </div>
        </Section>

        {/* 5.3 What is UGC */}
        <Section eyebrow="Контекст" title="Что такое UGC" tone="muted">
          <p className="lead">
            UGC (User Generated Content) — короткие видео от реальных людей на их живых аккаунтах. Аудитория доверяет
            таким роликам больше, чем прямой рекламе. Никаких фейков и накруток — только живой контент.
          </p>
        </Section>

        {/* 5.4 Why business needs UGC */}
        <Section eyebrow="Зачем это бизнесу" title="Что даёт UGC вашему бренду">
          <div className="cards cards--4">
            <Card title="Доверие" text="Живая аудитория вместо «рекламной слепоты» к баннерам." />
            <Card title="Вовлечённость" text="Выше отклик и конверсия, чем у таргета и медийки." />
            <Card title="Дешевле продакшн" text="Контент без дорогого классического креатива." />
            <Card title="Предсказуемость" text="Измеримый, понятный охват." />
          </div>
        </Section>

        {/* 5.5 Solution */}
        <Section eyebrow="Решение" title="Платформа CLICKI" tone="violet">
          <div className="cards cards--3">
            <Feature icon={<IconTarget />} title="Платим только за просмотр">
              Бренд ставит бриф и платит строго за подтверждённый живой охват.
            </Feature>
            <Feature icon={<IconAuto />} title="Полный автопилот">
              Платформа сама раздаёт заказы проверенным авторам и считает просмотры.
            </Feature>
            <Feature icon={<IconShield />} title="Защита от накруток">
              Умные фильтры отсекают ботов и «левый» трафик.
            </Feature>
          </div>
        </Section>

        {/* 5.6 How it works */}
        <Section id="how" eyebrow="Процесс" title="Как работает CLICKI">
          <ol className="steps">
            <Step n="1" title="Бренд ставит бриф" text="Что и для кого продвигаем." />
            <Step n="2" title="Платформа распределяет задачи" text="Заказ уходит сети проверенных авторов." />
            <Step n="3" title="Авторы публикуют UGC" text="Видео выходят на реальных аккаунтах." />
            <Step n="4" title="Бренд получает охват" text="Подтверждённые органические просмотры и прозрачный отчёт." />
          </ol>
        </Section>

        {/* 5.7 Lifecycle */}
        <Section eyebrow="Прозрачность" title="Что происходит с вашим продуктом" tone="muted">
          <p className="lead">
            От брифа до живого охвата и понятной отчётности в дашборде. Полный контроль, прозрачность и безопасность
            бренда на каждом шаге кампании.
          </p>
        </Section>

        {/* 5.8 Comparison */}
        <Section eyebrow="Сравнение" title="Почему именно мы">
          <div className="compare">
            <table className="compare__table">
              <thead>
                <tr>
                  <th>Параметр</th>
                  <th>Обычные агентства</th>
                  <th className="compare__us">Платформа CLICKI</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>За что платит бренд</td>
                  <td>За публикацию (может набрать 0)</td>
                  <td className="compare__us">За гарантированные просмотры</td>
                </tr>
                <tr>
                  <td>Время на запуск</td>
                  <td>2–4 недели</td>
                  <td className="compare__us">До 48 часов, автоматически</td>
                </tr>
                <tr>
                  <td>Риски слива бюджета</td>
                  <td>Огромные</td>
                  <td className="compare__us">Нулевые — оплата за результат</td>
                </tr>
                <tr>
                  <td>Прозрачность</td>
                  <td>Скриншоты в Excel</td>
                  <td className="compare__us">Интерактивный live-дашборд</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Section>

        {/* 5.9 Platforms */}
        <Section eyebrow="Каналы" title="На каких платформах работаем" tone="muted">
          <PlatformChips />
          <p className="muted-note">Мультиплатформенный охват одной кампанией.</p>
        </Section>

        {/* 5.11 Showcase */}
        <Section eyebrow="Витрина" title="Лента нашей рекламы">
          <VideoShowcase />
          <p className="muted-note">Примеры UGC-роликов, которые мы производим.</p>
        </Section>

        {/* 5.10 About + 5.12 Results */}
        <Section eyebrow="О нас" title="Кто мы" tone="violet">
          <p className="lead">
            CLICKI — технологическая performance-платформа из Астаны. Доверие, экспертиза и ясное видение того, как
            работает органический охват. За плечами — собранная сеть авторов, запущенный пилот и готовый продукт.
          </p>
        </Section>

        {/* 5.13 Final CTA + form */}
        <section id="consult" className="cta-section">
          <div className="container cta-section__inner">
            <Reveal className="cta-section__copy">
              <h2 className="cta-section__title">Получить консультацию</h2>
              <p className="cta-section__text">
                Оставьте заявку — мы свяжемся с вами, разберём задачу и покажем, как запустить кампанию.
              </p>
              <ul className="cta-section__contacts">
                <li>
                  <a href={`tel:${PHONE_TEL}`}>☎ {PHONE}</a>
                </li>
                <li>
                  <a href={TELEGRAM_URL} target="_blank" rel="noreferrer">
                    Telegram
                  </a>
                </li>
                <li>
                  <a href={EMAIL_URL}>{EMAIL}</a>
                </li>
              </ul>
            </Reveal>
            <Reveal className="cta-section__form">
              <LeadForm funnel="client" fields={CLIENT_FIELDS} submitLabel="Получить консультацию" />
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

function Feature({ icon, title, children }) {
  return (
    <div className="feature">
      <div className="feature__icon">{icon}</div>
      <h3 className="feature__title">{title}</h3>
      <p className="feature__text">{children}</p>
    </div>
  );
}

function Step({ n, title, text }) {
  return (
    <li className="step">
      <span className="step__num">{n}</span>
      <div>
        <h3 className="step__title">{title}</h3>
        <p className="step__text">{text}</p>
      </div>
    </li>
  );
}

function IconTarget() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}
function IconAuto() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3v3m0 12v3m9-9h-3M6 12H3m13.5-6.5-2 2m-7 7-2 2m11 0-2-2m-7-7-2-2" />
      <circle cx="12" cy="12" r="3.5" />
    </svg>
  );
}
function IconShield() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}
