import Seo from '../components/Seo.jsx';
import Header from '../components/Header.jsx';
import Footer from '../components/Footer.jsx';
import FloatingContacts from '../components/FloatingContacts.jsx';
import Reveal from '../components/Reveal.jsx';
import LeadForm from '../components/LeadForm.jsx';
import PlatformChips from '../components/PlatformChips.jsx';
import { ContainerTextFlip } from '../components/ui/container-text-flip';
import ScrollAway from '../components/ScrollAway.jsx';
import { useLang } from '../i18n.jsx';
import { useContent } from '../content.jsx';
import { TELEGRAM_URL } from '../lib/config.js';

const COPY = {
  ru: {
    seoTitle: 'CLICKI для креаторов - снимай и зарабатывай на органике',
    seoDesc: 'Стань UGC-креатором: снимай короткие видео из дома, расти в органике и развивай портфолио.',
    badge: 'Для тех, кто живёт в телефоне 📱',
    hero1: 'Снимай. Выкладывай.',
    heroAccent: 'Поднимайся.',
    heroSub: 'Бери телефон, снимай короткие видео из дома и превращай свой рост в реальный доход. Без графика, без начальника, без потолка.',
    start: 'Стать креатором',
    how: 'Как это работает',
    flipWords: ['снимай', 'выкладывай', 'зарабатывай', 'расти'],
    fields: [
      { name: 'name', label: 'Имя', required: true, autoComplete: 'name', placeholder: 'Как тебя зовут' },
      { name: 'contact', label: 'Телефон / Telegram', required: true, placeholder: '+7 ___ или @username' },
      { name: 'socials', label: 'Ссылки на соцсети', required: true, placeholder: 'TikTok, Instagram и др.' },
      { name: 'city', label: 'Город', placeholder: 'Откуда ты' },
      { name: 'examples', label: 'Примеры контента', type: 'textarea', placeholder: 'Ссылки на твои ролики (по желанию)' },
    ],
    slogans: [
      'Твой рост - твой доход.',
      'Снимай из дома. Зарабатывай на органике.',
      'Стань UGC-креатором для десятков брендов, а не заложником одного.',
      'Построй портфолио, которое работает на тебя.',
    ],
    essence: {
      eyebrow: 'Суть',
      title: 'Что ты делаешь',
      steps: [
        { title: 'Получаешь бриф', text: 'Платформа присылает задание от бренда.' },
        { title: 'Снимаешь видео', text: 'Короткое вертикальное видео на свой открытый аккаунт.' },
        { title: 'Публикуешь', text: 'Чем больше живых органических просмотров - тем выше доход.' },
        { title: 'Всё удалённо', text: 'Со своего телефона, в удобное время.' },
      ],
    },
    why: {
      eyebrow: 'Почему стоит идти к нам',
      title: 'Что ты получаешь',
      cards: [
        { title: 'Работа с разными брендами', text: 'Ты не заложник одного заказчика - снимаешь для десятков компаний и ниш.' },
        { title: 'Свой шанс стать креатором', text: 'Не «контент для одного бренда», а полноценная профессия и репутация.' },
        { title: 'Собственное портфолио', text: 'Каждое задание прокачивает твою папку кейсов, с которой можно расти дальше.' },
        { title: 'Реальный маркетинг', text: 'Учишься тому, как устроены продвижение и виральность, изнутри.' },
        { title: 'Заработок из дома', text: 'Несложно, гибко, без графика и начальника над душой.' },
        { title: 'Рост = доход', text: 'Чем сильнее ты в органике, тем больше зарабатываешь. Соревновательный дух и движение вперёд.' },
      ],
    },
    process: {
      eyebrow: 'Процесс',
      title: 'Как это работает для креатора',
      steps: [
        { title: 'Подаёшь заявку', text: 'И проходишь проверку.' },
        { title: 'Получаешь брифы', text: 'Под разные бренды.' },
        { title: 'Снимаешь и публикуешь', text: 'По техническому заданию.' },
        { title: 'Набираешь просмотры', text: 'Растёшь и зарабатываешь.' },
      ],
    },
    platforms: { eyebrow: 'Каналы', title: 'На каких платформах', note: 'Снимай там, где тебе удобно.' },
    requirements: {
      eyebrow: 'Требования',
      title: 'Кто может стать креатором',
      cards: [
        { title: 'Открытый аккаунт', text: 'Публичный профиль в соцсетях.' },
        { title: 'Оригинальный контент', text: 'Снимаешь сам по брифу.' },
        { title: 'Телефон с камерой', text: 'Нормальное качество съёмки.' },
        { title: '18+ и желание расти', text: 'Возраст от 18 лет и драйв двигаться вперёд.' },
      ],
    },
    finalTitle: 'Старт креатором',
    finalText: 'Заполни анкету - мы проверим заявку и пришлём первые брифы. Это бесплатно и ни к чему не обязывает.',
    community: 'Telegram-сообщество',
  },
  en: {
    seoTitle: 'CLICKI for creators - film and earn on organic reach',
    seoDesc: 'Become a UGC creator: film short videos from home, grow in organic reach and build a portfolio.',
    badge: 'For those who live on their phone 📱',
    hero1: 'Film it. Post it.',
    heroAccent: 'Level up.',
    heroSub: 'Grab your phone, film short videos from home and turn your growth into real income. No schedule, no boss, no ceiling.',
    start: 'Become a creator',
    how: 'How it works',
    flipWords: ['film', 'post', 'earn', 'grow'],
    fields: [
      { name: 'name', label: 'Name', required: true, autoComplete: 'name', placeholder: 'What’s your name' },
      { name: 'contact', label: 'Phone / Telegram', required: true, placeholder: '+7 ___ or @username' },
      { name: 'socials', label: 'Social links', required: true, placeholder: 'TikTok, Instagram, etc.' },
      { name: 'city', label: 'City', placeholder: 'Where you’re from' },
      { name: 'examples', label: 'Content samples', type: 'textarea', placeholder: 'Links to your clips (optional)' },
    ],
    slogans: [
      'Your growth - your income.',
      'Film from home. Earn on organic reach.',
      'Become a UGC creator for dozens of brands, not a hostage of one.',
      'Build a portfolio that works for you.',
    ],
    essence: {
      eyebrow: 'The gist',
      title: 'What you do',
      steps: [
        { title: 'Get a brief', text: 'The platform sends a task from a brand.' },
        { title: 'Film a video', text: 'A short vertical video on your public account.' },
        { title: 'Publish it', text: 'The more real organic views - the higher your income.' },
        { title: 'Fully remote', text: 'From your phone, whenever it suits you.' },
      ],
    },
    why: {
      eyebrow: 'Why come to us',
      title: 'What you get',
      cards: [
        { title: 'Work with many brands', text: 'You’re not tied to one client - you film for dozens of companies and niches.' },
        { title: 'Your shot at being a creator', text: 'Not “content for one brand”, but a real profession and reputation.' },
        { title: 'Your own portfolio', text: 'Every task grows your case folder to go further with.' },
        { title: 'Real marketing', text: 'Learn how promotion and virality actually work, from the inside.' },
        { title: 'Earn from home', text: 'Simple, flexible, no schedule and no boss over your shoulder.' },
        { title: 'Growth = income', text: 'The stronger you are in organic reach, the more you earn. A competitive drive forward.' },
      ],
    },
    process: {
      eyebrow: 'Process',
      title: 'How it works for a creator',
      steps: [
        { title: 'Apply', text: 'And pass the check.' },
        { title: 'Get briefs', text: 'For different brands.' },
        { title: 'Film and publish', text: 'Following the brief.' },
        { title: 'Gain views', text: 'Grow and earn.' },
      ],
    },
    platforms: { eyebrow: 'Channels', title: 'Which platforms', note: 'Film wherever it’s comfortable for you.' },
    requirements: {
      eyebrow: 'Requirements',
      title: 'Who can become a creator',
      cards: [
        { title: 'Public account', text: 'A public profile on social media.' },
        { title: 'Original content', text: 'You film it yourself per the brief.' },
        { title: 'Phone with a camera', text: 'Decent shooting quality.' },
        { title: '18+ and ready to grow', text: 'Age 18 or older and the drive to move forward.' },
      ],
    },
    finalTitle: 'Start as a creator',
    finalText: 'Fill in the form - we’ll review your application and send the first briefs. It’s free and non-binding.',
    community: 'Telegram community',
  },
};

export default function Creators() {
  const { lang } = useLang();
  const content = useContent();
  const t = COPY[lang] || COPY.ru;
  return (
    <>
      <Seo title={t.seoTitle} description={t.seoDesc} path="/creators" />
      <Header variant="creator" />
      <main className="funnel funnel--creator">
        {/* 6.1 Hero */}
        <section className="hero hero--creator">
          <div className="container hero__inner">
            <Reveal className="hero__copy">
              <div style={{ marginBottom: 18, display: 'flex', justifyContent: 'center' }}>
                <ContainerTextFlip words={t.flipWords} />
              </div>
              <span className="badge badge--green">{t.badge}</span>
              <h1 className="hero__title">
                {t.hero1}
                <br />
                <span className="accent">{t.heroAccent}</span>
              </h1>
              <p className="hero__subtitle">{t.heroSub}</p>
              <div className="hero__actions">
                <a href="#apply" className="btn btn--green btn--lg">
                  {t.start}
                </a>
                <a href="#how" className="btn btn--ghost btn--lg">
                  {t.how}
                </a>
              </div>
            </Reveal>
            <ScrollAway className="hero__art" distance={220}>
              <div className="creator-video">
                {content.creatorVideo ? (
                  <video src={content.creatorVideo} muted loop autoPlay playsInline controls />
                ) : (
                  <div className="creator-video__empty" aria-label="Видео">
                    <svg viewBox="0 0 24 24" width="56" height="56" fill="currentColor" aria-hidden="true">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                )}
              </div>
            </ScrollAway>
          </div>
        </section>

        {/* Slogans - right after the hero */}
        <section className="slogans">
          <div className="container">
            <div className="slogans__grid">
              {t.slogans.map((s, i) => (
                <Reveal key={i} className="slogans__item" delay={i * 60}>
                  «{s}»
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <Section id="essence" eyebrow={t.essence.eyebrow} title={t.essence.title}>
          <ol className="steps">
            {t.essence.steps.map((s, i) => (
              <Step key={s.title} n={i + 1} {...s} />
            ))}
          </ol>
        </Section>

        <Section eyebrow={t.why.eyebrow} title={t.why.title} tone="green">
          <div className="cards cards--3">
            {t.why.cards.map((c, i) => (
              <Reveal key={c.title} delay={i * 80}>
                <Card {...c} />
              </Reveal>
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

        <Section eyebrow={t.platforms.eyebrow} title={t.platforms.title} tone="muted">
          <PlatformChips />
          <p className="muted-note">{t.platforms.note}</p>
        </Section>

        <Section eyebrow={t.requirements.eyebrow} title={t.requirements.title}>
          <div className="cards cards--4">
            {t.requirements.cards.map((c, i) => (
              <Reveal key={c.title} delay={i * 80}>
                <Card {...c} />
              </Reveal>
            ))}
          </div>
        </Section>

        {/* 6.8 Final CTA + form */}
        <section id="apply" className="cta-section cta-section--green">
          <div className="container cta-section__inner">
            <Reveal className="cta-section__copy">
              <h2 className="cta-section__title">{t.finalTitle}</h2>
              <p className="cta-section__text">{t.finalText}</p>
              <a href={TELEGRAM_URL} target="_blank" rel="noreferrer" className="btn btn--ghost">
                {t.community}
              </a>
            </Reveal>
            <Reveal className="cta-section__form">
              <LeadForm funnel="creator" fields={t.fields} submitLabel={t.start} requireAdult />
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
