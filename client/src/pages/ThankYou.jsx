import { useParams, Link } from 'react-router-dom';
import Seo from '../components/Seo.jsx';
import Logo from '../components/Logo.jsx';
import { TELEGRAM_URL } from '../lib/config.js';

const CONTENT = {
  client: {
    title: 'Спасибо! Мы свяжемся с вами',
    text: 'Заявка получена. Наша команда перезвонит в ближайшее время, чтобы обсудить вашу задачу.',
    back: { to: '/business', label: 'Вернуться на главную' },
  },
  creator: {
    title: 'Спасибо! Заявка принята',
    text: 'Мы проверим её и пришлём первые брифы. А пока загляни в наше сообщество.',
    back: { to: '/creators', label: 'Вернуться на главную' },
    extra: true,
  },
};

export default function ThankYou() {
  const { type } = useParams();
  const data = CONTENT[type] || CONTENT.client;

  return (
    <main className="thanks">
      <Seo title="Спасибо — CLICKI" description="Заявка отправлена." path={`/thanks/${type}`} />
      <div className="thanks__inner">
        <Logo to={data.back.to} />
        <div className="thanks__check" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="thanks__title">{data.title}</h1>
        <p className="thanks__text">{data.text}</p>
        <div className="thanks__actions">
          {data.extra && (
            <a href={TELEGRAM_URL} target="_blank" rel="noreferrer" className="btn btn--green">
              Telegram-сообщество
            </a>
          )}
          <Link to={data.back.to} className="btn btn--ghost">
            {data.back.label}
          </Link>
        </div>
      </div>
    </main>
  );
}
