import Seo from '../components/Seo.jsx';
import Header from '../components/Header.jsx';
import Footer from '../components/Footer.jsx';
import Assistant from '../components/Assistant.jsx';
import FloatingContacts from '../components/FloatingContacts.jsx';
import FloatingBg from '../components/FloatingBg.jsx';
import LeadForm from '../components/LeadForm.jsx';
import { LegalNote } from '../components/LegalLinks.jsx';
import {
  FunnelHero,
  LogoStrip,
  ProblemScatter,
  Mission,
  SplitFeature,
  Steps,
  CardsGrid,
  ContactSplit,
} from '../components/funnel/Shinta.jsx';
import { useLang } from '../i18n.jsx';
import { COMMUNITY_URL } from '../lib/config.js';

const COPY = {
  ru: {
    seoTitle: 'CLICKI для креаторов - снимай и зарабатывай на органике',
    seoDesc: 'Стань UGC-креатором: снимай короткие видео из дома, расти в органике и развивай портфолио.',
    hero: {
      flip: ['снимай', 'выкладывай', 'зарабатывай', 'расти'],
      title: 'Снимай. Выкладывай.',
      accent: 'Поднимайся.',
      feats: ['Снимай из дома', 'Рост = доход', 'Десятки брендов'],
      lead: 'Бери телефон, снимай короткие видео из дома и превращай свой рост в реальный доход. Без графика, без начальника, без потолка.',
      cta: 'Стать креатором',
    },
    logos: 'Снимай там, где тебе удобно',
    problem: {
      title: 'Снимать в стол — тяжело',
      cards: [
        'Ты заложник одного заказчика',
        'Контент уходит в стол без роста',
        'Нет портфолио и репутации',
        'Платят за факт, а не за твой рост',
      ],
    },
    mission: {
      eyebrow: 'Твой рост — твой доход',
      title: 'Мы превратили съёмку с телефона в реальную профессию и доход.',
    },
    featureA: {
      title: 'Снимаешь из дома — растёшь в органике',
      text: 'Получаешь бриф от платформы, снимаешь короткое вертикальное видео на свой открытый аккаунт и публикуешь. Чем больше живых органических просмотров — тем выше доход.',
      stat: { value: '24/7', label: 'свободный график' },
    },
    featureB: {
      title: 'Портфолио, которое работает на тебя',
      text: 'Каждое задание прокачивает твою папку кейсов. Ты не заложник одного бренда — снимаешь для десятков компаний и ниш и строишь репутацию.',
      stat: { value: '10+', label: 'брендов и ниш' },
    },
    why: {
      eyebrow: 'Почему стоит идти к нам',
      title: 'Что ты получаешь',
      cards: [
        { title: 'Работа с разными брендами', text: 'Ты не заложник одного заказчика — снимаешь для десятков компаний и ниш.' },
        { title: 'Свой шанс стать креатором', text: 'Не «контент для одного бренда», а полноценная профессия и репутация.' },
        { title: 'Собственное портфолио', text: 'Каждое задание прокачивает твою папку кейсов, с которой можно расти дальше.' },
        { title: 'Реальный маркетинг', text: 'Учишься тому, как устроены продвижение и виральность, изнутри.' },
        { title: 'Заработок из дома', text: 'Несложно, гибко, без графика и начальника над душой.' },
        { title: 'Рост = доход', text: 'Чем сильнее ты в органике, тем больше зарабатываешь.' },
      ],
    },
    steps: {
      eyebrow: 'Процесс',
      title: 'Как это работает для креатора',
      items: [
        { title: 'Подаёшь заявку', text: 'И проходишь проверку.' },
        { title: 'Получаешь брифы', text: 'Под разные бренды.' },
        { title: 'Снимаешь и публикуешь', text: 'По техническому заданию.' },
        { title: 'Набираешь просмотры', text: 'Растёшь и зарабатываешь.' },
      ],
    },
    requirements: {
      eyebrow: 'Требования',
      title: 'Кто может стать креатором',
      cards: [
        { title: 'Открытый аккаунт', text: 'Публичный профиль в соцсетях.' },
        { title: 'Оригинальный контент', text: 'Снимаешь сам по брифу.' },
        { title: 'Телефон с камерой', text: 'Нормальное качество съёмки.' },
        { title: 'Желание расти', text: 'Драйв двигаться вперёд.' },
      ],
    },
    contact: {
      title: 'Старт креатором',
      text: 'Заполни анкету — мы проверим заявку и пришлём первые брифы. Это бесплатно и ни к чему не обязывает.',
      cta: 'Стать креатором',
      community: 'Telegram-сообщество',
    },
    qa: [
      { q: 'Как начать снимать с вами?', a: 'Заполни короткую анкету и пройди проверку. После этого начнёшь получать брифы под разные бренды.' },
      { q: 'Что нужно, чтобы стать креатором?', a: 'Открытый аккаунт, телефон с нормальной камерой, желание снимать оригинальный контент по брифу.' },
      { q: 'Сколько времени это занимает?', a: 'Всё удалённо и в удобное время — снимаешь короткие вертикальные видео со своего телефона, без графика и начальника.' },
      { q: 'Как формируется доход?', a: 'Чем больше живых органических просмотров набирают твои ролики, тем выше доход. Твой рост — твой доход.' },
      { q: 'Зачем мне портфолио?', a: 'Каждое задание прокачивает твою папку кейсов и репутацию, с которой можно расти дальше и брать больше брендов.' },
    ],
    fields: [
      { name: 'name', label: 'Имя', required: true, autoComplete: 'name', placeholder: 'Как тебя зовут' },
      { name: 'phone', label: 'Телефон', type: 'tel', required: true, autoComplete: 'tel', placeholder: '+7 ___ ___ __ __' },
      { name: 'telegram', label: 'Telegram', required: true, placeholder: '@username' },
    ],
  },
  en: {
    seoTitle: 'CLICKI for creators - film and earn on organic reach',
    seoDesc: 'Become a UGC creator: film short videos from home, grow in organic reach and build a portfolio.',
    hero: {
      flip: ['film', 'post', 'earn', 'grow'],
      title: 'Film it. Post it.',
      accent: 'Level up.',
      feats: ['Film from home', 'Growth = income', 'Dozens of brands'],
      lead: 'Grab your phone, film short videos from home and turn your growth into real income. No schedule, no boss, no ceiling.',
      cta: 'Become a creator',
    },
    logos: 'Film wherever it’s comfortable for you',
    problem: {
      title: 'Filming alone is hard',
      cards: [
        'You’re a hostage of one client',
        'Content goes nowhere without growth',
        'No portfolio and no reputation',
        'Paid for posting, not for your growth',
      ],
    },
    mission: {
      eyebrow: 'Your growth — your income',
      title: 'We turned filming on your phone into a real profession and income.',
    },
    featureA: {
      title: 'Film from home — grow on organic reach',
      text: 'Get a brief from the platform, film a short vertical video on your public account and publish it. The more real organic views — the higher your income.',
      stat: { value: '24/7', label: 'flexible schedule' },
    },
    featureB: {
      title: 'A portfolio that works for you',
      text: 'Every task grows your case folder. You’re not tied to one brand — you film for dozens of companies and niches and build a reputation.',
      stat: { value: '10+', label: 'brands and niches' },
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
        { title: 'Growth = income', text: 'The stronger you are in organic reach, the more you earn.' },
      ],
    },
    steps: {
      eyebrow: 'Process',
      title: 'How it works for a creator',
      items: [
        { title: 'Apply', text: 'And pass the check.' },
        { title: 'Get briefs', text: 'For different brands.' },
        { title: 'Film and publish', text: 'Following the brief.' },
        { title: 'Gain views', text: 'Grow and earn.' },
      ],
    },
    requirements: {
      eyebrow: 'Requirements',
      title: 'Who can become a creator',
      cards: [
        { title: 'Public account', text: 'A public profile on social media.' },
        { title: 'Original content', text: 'You film it yourself per the brief.' },
        { title: 'Phone with a camera', text: 'Decent shooting quality.' },
        { title: 'Ready to grow', text: 'The drive to move forward.' },
      ],
    },
    contact: {
      title: 'Start as a creator',
      text: 'Fill in the form - we’ll review your application and send the first briefs. It’s free and non-binding.',
      cta: 'Become a creator',
      community: 'Telegram community',
    },
    qa: [
      { q: 'How do I start filming with you?', a: 'Fill in a short form and pass the check. After that you’ll start receiving briefs for different brands.' },
      { q: 'What do I need to become a creator?', a: 'A public account, a phone with a decent camera and the drive to film original content per the brief.' },
      { q: 'How much time does it take?', a: 'Fully remote and whenever it suits you — you film short vertical videos from your phone, no schedule, no boss.' },
      { q: 'How is income formed?', a: 'The more real organic views your clips get, the higher your income. Your growth — your income.' },
      { q: 'Why do I need a portfolio?', a: 'Every task grows your case folder and reputation, so you can go further and take on more brands.' },
    ],
    fields: [
      { name: 'name', label: 'Name', required: true, autoComplete: 'name', placeholder: 'What’s your name' },
      { name: 'phone', label: 'Phone', type: 'tel', required: true, autoComplete: 'tel', placeholder: '+7 ___ ___ __ __' },
      { name: 'telegram', label: 'Telegram', required: true, placeholder: '@username' },
    ],
  },
};

export default function Creators() {
  const { lang } = useLang();
  const t = COPY[lang] || COPY.ru;

  return (
    <div className="page-light">
      <Seo title={t.seoTitle} description={t.seoDesc} path="/creators" />
      <FloatingBg />
      <Header variant="creator" />
      <main className="fx fx--green funnel--creator">
        <FunnelHero
          accent="green"
          flipWords={t.hero.flip}
          title={t.hero.title}
          accentWord={t.hero.accent}
          feats={t.hero.feats}
          lead={t.hero.lead}
          cta={t.hero.cta}
          ctaTo="#apply"
        />

        <LogoStrip caption={t.logos} />

        <ProblemScatter title={t.problem.title} cards={t.problem.cards} />

        <Mission accent="green" eyebrow={t.mission.eyebrow} title={t.mission.title} />

        <SplitFeature
          accent="green"
          ratio="portrait"
          title={t.featureA.title}
          text={t.featureA.text}
          stat={t.featureA.stat}
        />

        <SplitFeature
          accent="green"
          reversed
          ratio="landscape"
          title={t.featureB.title}
          text={t.featureB.text}
          stat={t.featureB.stat}
        />

        <CardsGrid accent="green" eyebrow={t.why.eyebrow} title={t.why.title} cards={t.why.cards} cols={3} />

        <Steps id="how" accent="green" eyebrow={t.steps.eyebrow} title={t.steps.title} steps={t.steps.items} />

        <CardsGrid id="requirements" accent="green" eyebrow={t.requirements.eyebrow} title={t.requirements.title} cards={t.requirements.cards} cols={4} />

        <ContactSplit
          id="apply"
          accent="green"
          mascot
          title={t.contact.title}
          text={t.contact.text}
          contacts={
            <a href={COMMUNITY_URL} target="_blank" rel="noreferrer" className="btn btn--ghost" style={{ marginTop: 20 }}>
              {t.contact.community}
            </a>
          }
        >
          <LeadForm funnel="creator" fields={t.fields} submitLabel={t.contact.cta} />
          {/* Highest-intent spot on the creator funnel: the offer is the contract
              this person is about to sign, so it is linked at the form, not only
              from the footer. */}
          <LegalNote role="creator" />
        </ContactSplit>
      </main>
      <Footer />
      <FloatingContacts />
      <Assistant accent="green" qa={t.qa} />
    </div>
  );
}
