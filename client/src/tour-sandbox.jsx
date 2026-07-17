/**
 * Превью онбординг-тура без базы и без сервера.
 *
 *   npm --prefix client run dev
 *   → http://localhost:5174/tour-sandbox.html
 *
 * Здесь настоящий Tour.jsx и настоящие шаги из content/guides.js, но вокруг —
 * заглушка навигации вместо кабинета: ни одного запроса к API, ни одной строки
 * из живой базы. Так тур можно крутить и править, не заходя под реальным
 * креатором. Разметка нарочно повторяет CreatorPortal: каждая вкладка
 * отрисована дважды — сайдбар и нижняя панель, — потому что именно на этом
 * тур выбирает, какую копию подсветить.
 *
 * Ужать окно до ~390px, чтобы проверить мобильный вид.
 *
 * Файл в прод-сборку не попадает: Vite собирает только index.html.
 */
import { useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import Tour from './components/Tour.jsx';
import { CREATOR_TOUR } from './content/guides.js';
import './styles/tailwind.css';
import './styles/index.css';
import './styles/funnel-shinta.css';
import './styles/app-light.css';

// Повторяет CREATOR_TABS из CreatorPortal: [ключ, подпись в сайдбаре,
// короткая подпись для нижней панели] — иначе на телефоне подписи обрежутся,
// и превью соврёт.
const TABS = [
  ['overview', 'Обзор', 'Обзор'],
  ['briefs', 'Заказы', 'Заказы'],
  ['videos', 'Видео', 'Видео'],
  ['referrals', 'Рефералы', 'Рефы'],
  ['rating', 'Рейтинг', 'Топ'],
  ['guide', 'Как это работает', 'Гайд'],
  ['account', 'Мой аккаунт', 'Профиль'],
];

function Sandbox() {
  const [view, setView] = useState('overview');
  const [open, setOpen] = useState(true);
  const steps = useMemo(
    () => CREATOR_TOUR.map((s) => ({ ...s, onEnter: s.view ? () => setView(s.view) : undefined })),
    []
  );
  const label = TABS.find(([k]) => k === view)?.[1];
  return (
    <main className="creator-portal page-light app-light">
      <div className="container creator-portal__inner creator-portal__inner--wide">
        <div className="cp-shell">
          <aside className="cp-side">
            <span className="cp-side__brand">CLICKI</span>
            <nav className="cp-side__nav" aria-label="Разделы кабинета">
              {TABS.map(([k, t]) => (
                <button key={k} type="button" data-tour={`nav-${k}`} className={`cp-side__link ${view === k ? 'is-active' : ''}`} onClick={() => setView(k)}>
                  {t}
                </button>
              ))}
            </nav>
          </aside>
          <div className="cp-shell__main">
            <div className="creator-portal__top">
              <span className="creator-portal__title" data-testid="view">{label}</span>
            </div>
            <div className="bp-card" style={{ margin: '16px 0' }}>
              <p className="creator-portal__muted" style={{ marginTop: 0 }}>
                Превью тура. Здесь вместо кабинета заглушка — тур настоящий.
              </p>
              <button className="btn btn--primary btn--sm" onClick={() => setOpen(true)}>Смотреть тур</button>
            </div>
            <nav className="cp-bottomnav" aria-label="Разделы кабинета">
              {TABS.map(([k, , short]) => (
                <button key={k} type="button" data-tour={`nav-${k}`} className={`cp-bottomnav__btn ${view === k ? 'is-active' : ''}`} onClick={() => setView(k)}>
                  <span className="cp-bottomnav__label">{short}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>
      </div>
      <Tour steps={steps} open={open} onClose={() => setOpen(false)} />
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Sandbox />);
