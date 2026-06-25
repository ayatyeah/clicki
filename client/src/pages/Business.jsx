import Seo from '../components/Seo.jsx';
import Header from '../components/Header.jsx';
import Footer from '../components/Footer.jsx';
import FloatingContacts from '../components/FloatingContacts.jsx';
import Reveal from '../components/Reveal.jsx';
import LeadForm from '../components/LeadForm.jsx';
import { ThreeDMarquee } from '../components/ui/3d-marquee';
import PlatformChips from '../components/PlatformChips.jsx';
import { MacbookScroll } from '../components/ui/macbook-scroll';
import { ContainerTextFlip } from '../components/ui/container-text-flip';
import { useLang } from '../i18n.jsx';
import { useContent } from '../content.jsx';
import { PHONE, PHONE_TEL, TELEGRAM_URL, EMAIL, EMAIL_URL } from '../lib/config.js';

const COPY = {
  ru: {
    seoTitle: 'CLICKI для бизнеса — реклама с оплатой за просмотры',
    seoDesc: 'Первая автоматизированная платформа рекламы с оплатой за органические просмотры. Получите консультацию.',
    badge: 'Performance-маркетинг нового поколения',
    heroPre: 'Платишь за ',
    heroAccent: 'результат',
    heroPost: ', а не за надежду',
    heroSub: 'Первая платформа, где вы платите за живые просмотры, а не за обещания. Запуск за пару дней и никакого слитого бюджета.',
    consult: 'Получить консультацию',
    how: 'Как это работает',
    macbookTitle: 'Вся кампания — в одном дашборде',
    flipWords: ['органика', 'просмотры', 'охваты', 'результат'],
    fields: [
      { name: 'name', label: 'Имя', required: true, autoComplete: 'name', placeholder: 'Как к вам обращаться' },
      { name: 'company', label: 'Компания', placeholder: 'Название бренда' },
      { name: 'phone', label: 'Телефон', type: 'tel', required: true, autoComplete: 'tel', placeholder: '+7 ___ ___ __ __' },
      { name: 'email', label: 'Email', type: 'email', autoComplete: 'email', placeholder: 'you@company.kz' },
      { name: 'niche', label: 'Сфера бизнеса', placeholder: 'Например: косметика, доставка, услуги' },
      { name: 'comment', label: 'Комментарий', type: 'textarea', placeholder: 'Коротко о задаче' },
    ],
    problem: {
      eyebrow: 'Проблема',
      title: 'Почему классическая реклама сливает бюджет',
      cards: [
        { title: 'Слив бюджета', text: 'Платите блогеру фиксированный гонорар, а видео не набирает просмотров — деньги потеряны.' },
        { title: 'Нет гарантий', text: 'Результат интеграций непредсказуем: стоимость привлечения растёт, отдача стремится к нулю.' },
      ],
    },
    ugc: {
      eyebrow: 'Контекст',
      title: 'Что такое UGC',
      lead: 'UGC (User Generated Content) — короткие видео от реальных людей на их живых аккаунтах. Аудитория доверяет таким роликам больше, чем прямой рекламе. Никаких фейков и накруток — только живой контент.',
    },
    why: {
      eyebrow: 'Зачем это бизнесу',
      title: 'Что даёт UGC вашему бренду',
      cards: [
        { title: 'Доверие', text: 'Живая аудитория вместо «рекламной слепоты» к баннерам.' },
        { title: 'Вовлечённость', text: 'Выше отклик и конверсия, чем у таргета и медийки.' },
        { title: 'Дешевле продакшн', text: 'Контент без дорогого классического креатива.' },
        { title: 'Предсказуемость', text: 'Измеримый, понятный охват.' },
      ],
    },
    solution: {
      eyebrow: 'Решение',
      title: 'Платформа CLICKI',
      features: [
        { title: 'Платим только за просмотр', text: 'Бренд ставит бриф и платит строго за подтверждённый живой охват.' },
        { title: 'Полный автопилот', text: 'Платформа сама раздаёт заказы проверенным авторам и считает просмотры.' },
        { title: 'Защита от накруток', text: 'Умные фильтры отсекают ботов и «левый» трафик.' },
      ],
    },
    process: {
      eyebrow: 'Процесс',
      title: 'Как работает CLICKI',
      steps: [
        { title: 'Бренд ставит бриф', text: 'Что и для кого продвигаем.' },
        { title: 'Платформа распределяет задачи', text: 'Заказ уходит сети проверенных авторов.' },
        { title: 'Авторы публикуют UGC', text: 'Видео выходят на реальных аккаунтах.' },
        { title: 'Бренд получает охват', text: 'Подтверждённые органические просмотры и прозрачный отчёт.' },
      ],
    },
    lifecycle: {
      eyebrow: 'Прозрачность',
      title: 'Что происходит с вашим продуктом',
      lead: 'От брифа до живого охвата и понятной отчётности в дашборде. Полный контроль, прозрачность и безопасность бренда на каждом шаге кампании.',
    },
    compare: {
      eyebrow: 'Сравнение',
      title: 'Почему именно мы',
      head: ['Параметр', 'Обычные агентства', 'Платформа CLICKI'],
      rows: [
        ['За что платит бренд', 'За публикацию (может набрать 0)', 'За гарантированные просмотры'],
        ['Время на запуск', '2–4 недели', 'До 48 часов, автоматически'],
        ['Риски слива бюджета', 'Огромные', 'Нулевые — оплата за результат'],
        ['Прозрачность', 'Скриншоты в Excel', 'Интерактивный live-дашборд'],
      ],
    },
    platforms: { eyebrow: 'Каналы', title: 'На каких платформах работаем', note: 'Мультиплатформенный охват одной кампанией.' },
    showcase: { eyebrow: 'Витрина', title: 'Лента нашей рекламы', note: 'Примеры UGC-роликов, которые мы производим.' },
    about: {
      eyebrow: 'О нас',
      title: 'Кто мы',
      alt: 'Партнёрское рукопожатие — доверие и долгосрочные отношения с брендами',
      lead: 'CLICKI — технологическая performance-платформа из Астаны. Доверие, экспертиза и ясное видение того, как работает органический охват. За плечами — собранная сеть авторов, запущенный пилот и готовый продукт.',
    },
    faq: {
      title: 'Частые вопросы',
      sub: 'Всё, что важно знать перед запуском кампании',
      items: [
        {
          q: 'Чем оплата за просмотры лучше обычной рекламы?',
          a: 'Вы платите только за подтверждённый живой охват, а не за факт публикации. Никаких фиксированных гонораров за ролик, который может набрать ноль просмотров.',
        },
        {
          q: 'Сколько времени занимает запуск кампании?',
          a: 'До 48 часов. Вы ставите бриф — платформа сама раздаёт заказы проверенным авторам и запускает публикации.',
        },
        {
          q: 'Что такое UGC и почему это работает?',
          a: 'UGC — короткие видео от реальных людей на их живых аккаунтах. Аудитория доверяет такому контенту больше, чем прямой рекламе.',
        },
        {
          q: 'Где я вижу результаты кампании?',
          a: 'В интерактивном live-дашборде: подтверждённые просмотры, охват и прозрачный отчёт по каждому ролику.',
        },
        {
          q: 'На каких платформах вы работаете?',
          a: 'Instagram, TikTok, YouTube Shorts и другие — мультиплатформенный охват одной кампанией.',
        },
      ],
    },
    finalTitle: 'Получить консультацию',
    finalText: 'Оставьте заявку — мы свяжемся с вами, разберём задачу и покажем, как запустить кампанию.',
  },
  en: {
    seoTitle: 'CLICKI for business — pay-for-views advertising',
    seoDesc: 'The first automated pay-for-organic-views advertising platform. Get a consultation.',
    badge: 'Next-generation performance marketing',
    heroPre: 'You pay for ',
    heroAccent: 'results',
    heroPost: ', not for hope',
    heroSub: 'The first platform where you pay for real views, not promises. Launch in days — no wasted budget.',
    consult: 'Get a consultation',
    how: 'How it works',
    macbookTitle: 'Your whole campaign in one dashboard',
    flipWords: ['organic', 'views', 'reach', 'results'],
    fields: [
      { name: 'name', label: 'Name', required: true, autoComplete: 'name', placeholder: 'How should we address you' },
      { name: 'company', label: 'Company', placeholder: 'Brand name' },
      { name: 'phone', label: 'Phone', type: 'tel', required: true, autoComplete: 'tel', placeholder: '+7 ___ ___ __ __' },
      { name: 'email', label: 'Email', type: 'email', autoComplete: 'email', placeholder: 'you@company.kz' },
      { name: 'niche', label: 'Industry', placeholder: 'e.g. cosmetics, delivery, services' },
      { name: 'comment', label: 'Comment', type: 'textarea', placeholder: 'Briefly about your goal' },
    ],
    problem: {
      eyebrow: 'Problem',
      title: 'Why classic advertising burns budget',
      cards: [
        { title: 'Wasted budget', text: 'You pay a blogger a fixed fee, the video gets no views — the money is gone.' },
        { title: 'No guarantees', text: 'Integration results are unpredictable: acquisition cost rises, ROI trends to zero.' },
      ],
    },
    ugc: {
      eyebrow: 'Context',
      title: 'What is UGC',
      lead: 'UGC (User Generated Content) — short videos by real people on their real accounts. Audiences trust them more than direct ads. No fakes, no bots — only real content.',
    },
    why: {
      eyebrow: 'Why business needs it',
      title: 'What UGC gives your brand',
      cards: [
        { title: 'Trust', text: 'A live audience instead of “banner blindness”.' },
        { title: 'Engagement', text: 'Higher response and conversion than targeting and display.' },
        { title: 'Cheaper production', text: 'Content without expensive classic creative.' },
        { title: 'Predictability', text: 'Measurable, clear reach.' },
      ],
    },
    solution: {
      eyebrow: 'Solution',
      title: 'The CLICKI platform',
      features: [
        { title: 'Pay only per view', text: 'The brand sets a brief and pays strictly for confirmed real reach.' },
        { title: 'Full autopilot', text: 'The platform assigns tasks to vetted creators and counts the views.' },
        { title: 'Bot protection', text: 'Smart filters cut out bots and junk traffic.' },
      ],
    },
    process: {
      eyebrow: 'Process',
      title: 'How CLICKI works',
      steps: [
        { title: 'The brand sets a brief', text: 'What we promote and for whom.' },
        { title: 'The platform distributes tasks', text: 'The order goes to a network of vetted creators.' },
        { title: 'Creators publish UGC', text: 'Videos go live on real accounts.' },
        { title: 'The brand gets reach', text: 'Confirmed organic views and a transparent report.' },
      ],
    },
    lifecycle: {
      eyebrow: 'Transparency',
      title: 'What happens to your product',
      lead: 'From brief to real reach and clear reporting in the dashboard. Full control, transparency and brand safety at every step of the campaign.',
    },
    compare: {
      eyebrow: 'Comparison',
      title: 'Why us',
      head: ['Parameter', 'Typical agencies', 'CLICKI platform'],
      rows: [
        ['What the brand pays for', 'For posting (may get 0)', 'For guaranteed views'],
        ['Time to launch', '2–4 weeks', 'Up to 48 hours, automatically'],
        ['Budget-waste risk', 'Huge', 'Zero — pay for results'],
        ['Transparency', 'Screenshots in Excel', 'Interactive live dashboard'],
      ],
    },
    platforms: { eyebrow: 'Channels', title: 'Platforms we work on', note: 'Multi-platform reach in a single campaign.' },
    showcase: { eyebrow: 'Showcase', title: 'Our ad feed', note: 'Examples of the UGC clips we produce.' },
    about: {
      eyebrow: 'About',
      title: 'Who we are',
      alt: 'A partnership handshake — trust and long-term relationships with brands',
      lead: 'CLICKI is a technology performance platform from Astana. Trust, expertise and a clear vision of how organic reach works. Behind us — a built creator network, a launched pilot and a ready product.',
    },
    faq: {
      title: 'FAQ',
      sub: 'Everything worth knowing before launching a campaign',
      items: [
        {
          q: 'Why is pay-per-view better than classic advertising?',
          a: 'You pay only for confirmed real reach, not for the fact of posting. No fixed blogger fees for a video that may get zero views.',
        },
        {
          q: 'How long does it take to launch a campaign?',
          a: 'Up to 48 hours. You set a brief — the platform assigns tasks to vetted creators and starts the posts.',
        },
        {
          q: 'What is UGC and why does it work?',
          a: 'UGC is short videos by real people on their real accounts. Audiences trust this content more than direct ads.',
        },
        {
          q: 'Where do I see campaign results?',
          a: 'In an interactive live dashboard: confirmed views, reach and a transparent report for every clip.',
        },
        {
          q: 'Which platforms do you work on?',
          a: 'Instagram, TikTok, YouTube Shorts and more — multi-platform reach in a single campaign.',
        },
      ],
    },
    finalTitle: 'Get a consultation',
    finalText: 'Leave a request — we’ll contact you, dig into your goal and show how to launch a campaign.',
  },
};

const ICONS = [<IconTarget key="t" />, <IconAuto key="a" />, <IconShield key="s" />];

// Branded gradient tiles used when the CMS feed has no preview images yet.
const phImg = (a, b) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='320' height='560'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${a}'/><stop offset='1' stop-color='${b}'/></linearGradient></defs><rect width='100%' height='100%' rx='28' fill='url(#g)'/><text x='50%' y='52%' fill='rgba(255,255,255,0.9)' font-family='sans-serif' font-size='34' font-weight='700' text-anchor='middle'>CLICKI</text></svg>`,
  )}`;
const MARQUEE_PLACEHOLDERS = [
  ['#7c3aed', '#22c55e'],
  ['#8b5cf6', '#16a34a'],
  ['#a78bfa', '#7c3aed'],
  ['#6ee7a8', '#16a34a'],
  ['#7c3aed', '#4c1d95'],
  ['#22c55e', '#0f766e'],
  ['#a78bfa', '#22c55e'],
  ['#8b5cf6', '#6ee7a8'],
].map(([a, b]) => phImg(a, b));

export default function Business() {
  const { lang } = useLang();
  const content = useContent();
  const t = COPY[lang] || COPY.ru;

  // 3D marquee needs images. Use CMS image/poster previews; fall back to tiles.
  const previews = (content.showcase || [])
    .map((it) => (it?.type === 'image' ? it.src : it?.poster))
    .filter(Boolean);
  const base = previews.length ? previews : MARQUEE_PLACEHOLDERS;
  const marqueeImages = Array.from({ length: Math.max(16, base.length) }, (_, i) => base[i % base.length]);

  return (
    <>
      <Seo title={t.seoTitle} description={t.seoDesc} path="/business" />
      <Header variant="business" />
      <main className="funnel funnel--business">
        {/* 5.1 Hero */}
        <section className="hero">
          <div className="container hero__inner hero__inner--single">
            <Reveal as="div" className="hero__copy">
              <div style={{ marginBottom: 18 }}>
                <ContainerTextFlip words={t.flipWords} />
              </div>
              <span className="badge">{t.badge}</span>
              <h1 className="hero__title">
                {t.heroPre}
                <span className="accent">{t.heroAccent}</span>
                {t.heroPost}
              </h1>
              <p className="hero__subtitle">{t.heroSub}</p>
              <div className="hero__actions">
                <a href="#consult" className="btn btn--primary btn--lg">
                  {t.consult}
                </a>
                <a href="#how" className="btn btn--ghost btn--lg">
                  {t.how}
                </a>
              </div>
              <a href={`tel:${PHONE_TEL}`} className="hero__call">
                ☎ {PHONE}
              </a>
            </Reveal>
          </div>
        </section>

        <section className="relative isolate overflow-hidden bg-[#0a0a12]">
          <MacbookScroll
            src={content.devices?.laptop?.image}
            screen={
              content.devices?.laptop?.image ? undefined : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-[#1b1340] via-[#0b0a1c] to-[#08160f] p-6 text-white">
                  <span className="text-5xl font-extrabold tracking-tight">CLICKI</span>
                  <span className="text-sm text-white/55">live-дашборд кампании</span>
                  <div className="mt-3 flex w-3/4 gap-2">
                    <div className="h-16 flex-1 rounded-lg bg-violet-500/30" />
                    <div className="h-16 flex-1 rounded-lg bg-emerald-500/30" />
                    <div className="h-16 flex-1 rounded-lg bg-violet-400/20" />
                  </div>
                </div>
              )
            }
            title={t.macbookTitle}
          />
        </section>

        <Section id="problem" eyebrow={t.problem.eyebrow} title={t.problem.title}>
          <div className="cards cards--2">
            {t.problem.cards.map((c) => (
              <Card key={c.title} {...c} />
            ))}
          </div>
        </Section>

        <Section eyebrow={t.ugc.eyebrow} title={t.ugc.title} tone="muted">
          <p className="lead">{t.ugc.lead}</p>
        </Section>

        <Section eyebrow={t.why.eyebrow} title={t.why.title}>
          <div className="cards cards--4">
            {t.why.cards.map((c) => (
              <Card key={c.title} {...c} />
            ))}
          </div>
        </Section>

        <Section eyebrow={t.solution.eyebrow} title={t.solution.title} tone="violet">
          <div className="cards cards--3">
            {t.solution.features.map((f, i) => (
              <Feature key={f.title} icon={ICONS[i]} title={f.title}>
                {f.text}
              </Feature>
            ))}
          </div>
        </Section>

        <Section id="how" eyebrow={t.process.eyebrow} title={t.process.title}>
          <ol className="steps">
            {t.process.steps.map((s, i) => (
              <Step key={s.title} n={i + 1} {...s} />
            ))}
          </ol>
        </Section>

        <Section eyebrow={t.lifecycle.eyebrow} title={t.lifecycle.title} tone="muted">
          <p className="lead">{t.lifecycle.lead}</p>
        </Section>

        <Section eyebrow={t.compare.eyebrow} title={t.compare.title}>
          <div className="compare">
            <table className="compare__table">
              <thead>
                <tr>
                  <th>{t.compare.head[0]}</th>
                  <th>{t.compare.head[1]}</th>
                  <th className="compare__us">{t.compare.head[2]}</th>
                </tr>
              </thead>
              <tbody>
                {t.compare.rows.map((r) => (
                  <tr key={r[0]}>
                    <td>{r[0]}</td>
                    <td>{r[1]}</td>
                    <td className="compare__us">{r[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section eyebrow={t.platforms.eyebrow} title={t.platforms.title} tone="muted">
          <PlatformChips />
          <p className="muted-note">{t.platforms.note}</p>
        </Section>

        <Section eyebrow={t.showcase.eyebrow} title={t.showcase.title}>
          <ThreeDMarquee images={marqueeImages} />
          <p className="muted-note">{t.showcase.note}</p>
        </Section>

        <Section eyebrow={t.about.eyebrow} title={t.about.title} tone="violet">
          <div className="about-grid">
            <div className="about-photo">
              <img src="/handshake.png" alt={t.about.alt} width="740" height="375" loading="lazy" />
            </div>
            <p className="lead">{t.about.lead}</p>
          </div>
        </Section>

        {/* FAQ — dropdown accordion */}
        <section className="section">
          <div className="container">
            <Reveal as="header" className="section__head section__head--center">
              <h2 className="section__title">{t.faq.title}</h2>
              <p className="faq__sub">{t.faq.sub}</p>
            </Reveal>
            <Reveal>
              <div className="faq">
                {t.faq.items.map((it) => (
                  <details key={it.q} className="faq__item">
                    <summary className="faq__q">{it.q}</summary>
                    <p className="faq__a">{it.a}</p>
                  </details>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        {/* 5.13 Final CTA + form */}
        <section id="consult" className="cta-section">
          <div className="container cta-section__inner">
            <Reveal className="cta-section__copy">
              <h2 className="cta-section__title">{t.finalTitle}</h2>
              <p className="cta-section__text">{t.finalText}</p>
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
              <LeadForm funnel="client" fields={t.fields} submitLabel={t.consult} />
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
