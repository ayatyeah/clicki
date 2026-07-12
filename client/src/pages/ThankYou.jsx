import { useParams, Link } from 'react-router-dom';
import Seo from '../components/Seo.jsx';
import Logo from '../components/Logo.jsx';
import { useLang } from '../i18n.jsx';
import { COMMUNITY_URL } from '../lib/config.js';

const COPY = {
  ru: {
    client: {
      title: 'Спасибо! Мы свяжемся с вами',
      text: 'Заявка получена. Наша команда перезвонит в ближайшее время, чтобы обсудить вашу задачу.',
      back: 'Вернуться на главную',
    },
    creator: {
      title: 'Спасибо! Заявка принята',
      text: 'Мы проверим её и пришлём первые брифы. А пока загляни в наше сообщество.',
      back: 'Вернуться на главную',
    },
    community: 'Telegram-сообщество',
    seoTitle: 'Спасибо — CLICKI',
    seoDesc: 'Заявка отправлена.',
  },
  en: {
    client: {
      title: 'Thank you! We’ll be in touch',
      text: 'Your request is received. Our team will call you shortly to discuss your goal.',
      back: 'Back to home',
    },
    creator: {
      title: 'Thank you! Application received',
      text: 'We’ll review it and send the first briefs. Meanwhile, join our community.',
      back: 'Back to home',
    },
    community: 'Telegram community',
    seoTitle: 'Thank you — CLICKI',
    seoDesc: 'Your request has been sent.',
  },
};

const BACK = { client: '/business', creator: '/creators' };

export default function ThankYou() {
  const { type } = useParams();
  const { lang } = useLang();
  const t = COPY[lang] || COPY.ru;
  const data = t[type] || t.client;
  const backTo = BACK[type] || '/business';

  return (
    <main className="thanks">
      <Seo title={t.seoTitle} description={t.seoDesc} path={`/thanks/${type}`} noindex />
      <div className="thanks__inner">
        <Logo to={backTo} />
        <div className="thanks__check" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="thanks__title">{data.title}</h1>
        <p className="thanks__text">{data.text}</p>
        <div className="thanks__actions">
          {type === 'creator' && (
            <a href={COMMUNITY_URL} target="_blank" rel="noreferrer" className="btn btn--green">
              {t.community}
            </a>
          )}
          <Link to={backTo} className="btn btn--ghost">
            {data.back}
          </Link>
        </div>
      </div>
    </main>
  );
}
