import Seo from '../components/Seo.jsx';
import Header from '../components/Header.jsx';
import Footer from '../components/Footer.jsx';
import FloatingContacts from '../components/FloatingContacts.jsx';
import FloatingBg from '../components/FloatingBg.jsx';
import Assistant from '../components/Assistant.jsx';
import LeadForm from '../components/LeadForm.jsx';
import {
  FunnelHero,
  LogoStrip,
  ProblemScatter,
  Mission,
  SplitFeature,
  Steps,
  CardsGrid,
  Compare,
  ContactSplit,
} from '../components/funnel/Shinta.jsx';
import { useLang } from '../i18n.jsx';
import { PHONE, PHONE_TEL, TELEGRAM_URL, EMAIL, EMAIL_URL } from '../lib/config.js';

const COPY = {
  ru: {
    seoTitle: 'CLICKI для бизнеса - реклама с оплатой за просмотры',
    seoDesc: 'Первая автоматизированная платформа рекламы с оплатой за органические просмотры. Получите консультацию.',
    hero: {
      flip: ['органика', 'просмотры', 'охваты', 'результат'],
      title: 'Платишь за',
      accent: 'результат',
      tail: ', а не за надежду',
      feats: ['Оплата за просмотры', 'Защита от накруток', 'Запуск за 48 часов'],
      lead: 'Первая платформа, где вы платите за живые просмотры, а не за обещания. Запуск за пару дней и никакого слитого бюджета.',
      cta: 'Получить консультацию',
    },
    logos: 'Мультиплатформенный охват одной кампанией',
    problem: {
      title: 'Классическая реклама сливает бюджет',
      cards: [
        'Платишь блогеру фикс — видео не зашло, деньги потеряны',
        'Результат интеграций непредсказуем',
        'CAC растёт, ROI стремится к нулю',
        'Никаких гарантий охвата',
      ],
    },
    mission: {
      eyebrow: 'Наша миссия',
      title: 'Мы превратили рекламу в предсказуемый канал органических просмотров.',
    },
    featureA: {
      title: 'Платим только за просмотры',
      text: 'Бренд ставит бриф и платит строго за подтверждённый живой охват. Никаких фиксированных гонораров за ролик, который может набрать ноль.',
      stat: { value: '48 ч', label: 'до запуска кампании' },
    },
    featureB: {
      title: 'Полный автопилот и защита от накруток',
      text: 'Платформа сама раздаёт заказы проверенным авторам и считает просмотры. Умные фильтры отсекают ботов и «левый» трафик.',
      stat: { value: 'Live', label: 'прозрачный дашборд' },
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
    steps: {
      eyebrow: 'Процесс',
      title: 'Как работает CLICKI',
      items: [
        { title: 'Бренд ставит бриф', text: 'Что и для кого продвигаем.' },
        { title: 'Платформа распределяет задачи', text: 'Заказ уходит сети проверенных авторов.' },
        { title: 'Авторы публикуют UGC', text: 'Видео выходят на реальных аккаунтах.' },
        { title: 'Бренд получает охват', text: 'Подтверждённые органические просмотры и прозрачный отчёт.' },
      ],
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
    contact: {
      title: 'Давайте обсудим ваш результат',
      text: 'Оставьте заявку — мы свяжемся с вами, разберём задачу и покажем, как запустить кампанию.',
      cta: 'Получить консультацию',
    },
    qa: [
      { q: 'Чем оплата за просмотры лучше обычной рекламы?', a: 'Вы платите за подтверждённый живой охват, а не за факт публикации. Никаких фиксированных гонораров за ролик, который может набрать ноль.' },
      { q: 'Сколько занимает запуск кампании?', a: 'До 48 часов: вы ставите бриф — платформа сама раздаёт заказы проверенным авторам и запускает публикации.' },
      { q: 'Что такое UGC и почему это работает?', a: 'UGC — короткие видео от реальных людей на их живых аккаунтах. Аудитория доверяет такому контенту больше, чем прямой рекламе.' },
      { q: 'Как вы защищаете от накруток?', a: 'Умные фильтры отсекают ботов и «левый» трафик, поэтому в отчёт попадают только живые органические просмотры.' },
      { q: 'На каких платформах работаете?', a: 'TikTok, Instagram Reels, YouTube Shorts, Threads и X — мультиплатформенный охват одной кампанией.' },
    ],
    fields: [
      { name: 'name', label: 'Имя', required: true, autoComplete: 'name', placeholder: 'Как к вам обращаться' },
      { name: 'company', label: 'Компания', placeholder: 'Название бренда' },
      { name: 'phone', label: 'Телефон', type: 'tel', required: true, autoComplete: 'tel', placeholder: '+7 ___ ___ __ __' },
      { name: 'email', label: 'Email', type: 'email', autoComplete: 'email', placeholder: 'you@company.kz' },
      { name: 'niche', label: 'Сфера бизнеса', placeholder: 'Например: косметика, доставка, услуги' },
      { name: 'comment', label: 'Комментарий', type: 'textarea', placeholder: 'Коротко о задаче' },
    ],
  },
  en: {
    seoTitle: 'CLICKI for business - pay-for-views advertising',
    seoDesc: 'The first automated pay-for-organic-views advertising platform. Get a consultation.',
    hero: {
      flip: ['organic', 'views', 'reach', 'results'],
      title: 'You pay for',
      accent: 'results',
      tail: ', not for hope',
      feats: ['Pay per view', 'Bot protection', 'Launch in 48 hours'],
      lead: 'The first platform where you pay for real views, not promises. Launch in days — no wasted budget.',
      cta: 'Get a consultation',
    },
    logos: 'Multi-platform reach in a single campaign',
    problem: {
      title: 'Classic advertising burns budget',
      cards: [
        'You pay a blogger a fixed fee — the video flops, money gone',
        'Integration results are unpredictable',
        'CAC rises, ROI trends to zero',
        'No reach guarantees at all',
      ],
    },
    mission: {
      eyebrow: 'Our mission',
      title: 'We turned advertising into a predictable channel of organic views.',
    },
    featureA: {
      title: 'Pay only per view',
      text: 'The brand sets a brief and pays strictly for confirmed real reach. No fixed fees for a video that may get zero.',
      stat: { value: '48 h', label: 'to launch a campaign' },
    },
    featureB: {
      title: 'Full autopilot and bot protection',
      text: 'The platform assigns tasks to vetted creators and counts the views. Smart filters cut out bots and junk traffic.',
      stat: { value: 'Live', label: 'transparent dashboard' },
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
    steps: {
      eyebrow: 'Process',
      title: 'How CLICKI works',
      items: [
        { title: 'The brand sets a brief', text: 'What we promote and for whom.' },
        { title: 'The platform distributes tasks', text: 'The order goes to a network of vetted creators.' },
        { title: 'Creators publish UGC', text: 'Videos go live on real accounts.' },
        { title: 'The brand gets reach', text: 'Confirmed organic views and a transparent report.' },
      ],
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
    contact: {
      title: 'Let’s talk about your result',
      text: 'Leave a request — we’ll contact you, dig into your goal and show how to launch a campaign.',
      cta: 'Get a consultation',
    },
    qa: [
      { q: 'Why is pay-per-view better than classic ads?', a: 'You pay for confirmed real reach, not for the fact of posting. No fixed fees for a video that may get zero views.' },
      { q: 'How long does a launch take?', a: 'Up to 48 hours: you set a brief — the platform assigns tasks to vetted creators and starts the posts.' },
      { q: 'What is UGC and why does it work?', a: 'UGC is short videos by real people on their real accounts. Audiences trust it more than direct ads.' },
      { q: 'How do you protect against bots?', a: 'Smart filters cut out bots and junk traffic, so only real organic views make it into the report.' },
      { q: 'Which platforms do you work on?', a: 'TikTok, Instagram Reels, YouTube Shorts, Threads and X — multi-platform reach in a single campaign.' },
    ],
    fields: [
      { name: 'name', label: 'Name', required: true, autoComplete: 'name', placeholder: 'How should we address you' },
      { name: 'company', label: 'Company', placeholder: 'Brand name' },
      { name: 'phone', label: 'Phone', type: 'tel', required: true, autoComplete: 'tel', placeholder: '+7 ___ ___ __ __' },
      { name: 'email', label: 'Email', type: 'email', autoComplete: 'email', placeholder: 'you@company.kz' },
      { name: 'niche', label: 'Industry', placeholder: 'e.g. cosmetics, delivery, services' },
      { name: 'comment', label: 'Comment', type: 'textarea', placeholder: 'Briefly about your goal' },
    ],
  },
};

export default function Business() {
  const { lang } = useLang();
  const t = COPY[lang] || COPY.ru;

  return (
    <div className="page-light">
      <Seo title={t.seoTitle} description={t.seoDesc} path="/business" />
      <FloatingBg />
      <Header variant="business" />
      <main className="fx fx--violet funnel--business">
        <FunnelHero
          accent="violet"
          flipWords={t.hero.flip}
          title={t.hero.title}
          accentWord={t.hero.accent}
          tail={t.hero.tail}
          feats={t.hero.feats}
          lead={t.hero.lead}
          cta={t.hero.cta}
          ctaTo="#consult"
          call={PHONE}
        />

        <LogoStrip caption={t.logos} />

        <ProblemScatter title={t.problem.title} cards={t.problem.cards} />

        <Mission accent="violet" eyebrow={t.mission.eyebrow} title={t.mission.title} />

        <SplitFeature
          accent="violet"
          ratio="portrait"
          title={t.featureA.title}
          text={t.featureA.text}
          stat={t.featureA.stat}
        />

        <SplitFeature
          accent="violet"
          reversed
          ratio="landscape"
          title={t.featureB.title}
          text={t.featureB.text}
          stat={t.featureB.stat}
        />

        <CardsGrid accent="violet" eyebrow={t.why.eyebrow} title={t.why.title} cards={t.why.cards} cols={4} />

        <Steps id="how" accent="violet" eyebrow={t.steps.eyebrow} title={t.steps.title} steps={t.steps.items} />

        <Compare id="compare" eyebrow={t.compare.eyebrow} title={t.compare.title} head={t.compare.head} rows={t.compare.rows} />

        <ContactSplit
          id="consult"
          accent="violet"
          mascot
          mascotSrc="/mascot-business.png"
          mascotCrop={false}
          title={t.contact.title}
          text={t.contact.text}
          contacts={
            <ul className="cta-section__contacts">
              <li><a href={`tel:${PHONE_TEL}`}>☎ {PHONE}</a></li>
              <li><a href={TELEGRAM_URL} target="_blank" rel="noreferrer">Telegram</a></li>
              <li><a href={EMAIL_URL}>{EMAIL}</a></li>
            </ul>
          }
        >
          <LeadForm funnel="client" fields={t.fields} submitLabel={t.contact.cta} />
        </ContactSplit>
      </main>
      <Footer />
      <FloatingContacts />
      <Assistant accent="violet" qa={t.qa} />
    </div>
  );
}
