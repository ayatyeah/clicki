import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Seo from '../components/Seo.jsx';
import { API_BASE, SITE_URL } from '../lib/config.js';
import { createApiClient } from '../lib/apiClient.js';
import { safeHref } from '../lib/safeHref.js';
import StatScreenshots, { guideFor } from '../components/StatScreenshots.jsx';
import Icon from '../components/Icon.jsx';
import { TikTokConnect, InstagramSoon } from '../components/SocialConnect.jsx';
import AvatarCropper from '../components/AvatarCropper.jsx';
import CopyButton from '../components/CopyButton.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Guide from '../components/Guide.jsx';
import Tour from '../components/Tour.jsx';
import { CREATOR_GUIDE, CREATOR_TOUR } from '../content/guides.js';
import { useToast } from '../components/Toast.jsx';

const KEY = 'clicki_creator_token';
const PLATFORMS = ['TikTok', 'Instagram Reels', 'YouTube Shorts', 'Threads', 'X (Twitter)'];

// Screenshots/avatars may live in Spaces (absolute URL) or Postgres (relative /api/media/:id).
const mediaUrl = (u) => (u && /^https?:\/\//i.test(u) ? u : `${API_BASE}${u}`);

// TODO: written but never rendered — no component consumes this FAQ. Either wire
// it into the cabinet or delete it. Kept so the copy isn't lost silently.
// eslint-disable-next-line no-unused-vars
const CREATOR_QA = [
  { q: 'Когда придут деньги?', a: 'Как только баланс в кошельке достигнет порога выплаты, оператор оформит перевод на Kaspi — статус видно во вкладке «Кошелёк».' },
  { q: 'Почему видео не засчитали?', a: 'Причина отклонения указана рядом со статусом видео — обычно это несоответствие хронометражу, отсутствие хэштега/упоминания или низкое качество.' },
  { q: 'Как получить больше брифов?', a: 'Открытые заказы видны в разделе «Заказы» — берите любой активный, оператор также может назначить бриф лично.' },
  { q: 'Что даёт реферальная ссылка?', a: '+500 XP за друга, ставшего креатором, и +30 XP за каждую заявку бизнеса, пришедшую по ссылке в шапке профиля.' },
];

// Onboarding test (ТЗ §3 step 2) — filters "не по брифу" disputes before filming.
const QUIZ = [
  { q: 'Минимум просмотров, чтобы видео засчиталось?', opts: ['2 000', '5 000', '10 000'], a: 0 },
  { q: 'Можно загрузить чужое видео?', opts: ['Да', 'Нет, только своё по брифу'], a: 1 },
  { q: 'Когда проверяется, удалено ли видео?', opts: ['Каждый день', 'На 30-й день после публикации'], a: 1 },
];

export default function CreatorPortal() {
  // Persistent login (localStorage): the installed PWA reopens into the cabinet.
  // Migrate a token left in sessionStorage by the previous (session-only) build.
  const [token, setToken] = useState(() => {
    const legacy = sessionStorage.getItem(KEY);
    if (legacy && !localStorage.getItem(KEY)) { localStorage.setItem(KEY, legacy); sessionStorage.removeItem(KEY); }
    return localStorage.getItem(KEY) || '';
  });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  // Set right after a creator finishes onboarding, so their first Dashboard opens
  // straight into "Как это работает" instead of the overview.
  const [openGuide, setOpenGuide] = useState(false);

  // Shared client: bearer + "only 401/403 ends the session" policy (lib/apiClient.js).
  const api = useMemo(
    () => createApiClient({ tokenKey: KEY, persistent: true, onUnauthorized: () => { setToken(''); setData(null); } }),
    []
  );
  const { authFetch } = api;
  const toast = useToast();

  const loadMe = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/creator/me');
      if (res.status === 401 || res.status === 403) return; // client already cleared the session
      if (!res.ok) throw new Error('load-failed');
      setData(await res.json());
    } catch {
      /* keep the session; the effect will retry on next mount / reload */
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (token && !data) loadMe();
  }, [token, data, loadMe]);

  // Keep the cabinet numbers fresh without a manual reload — views, balance and
  // "в проверке" update as the operator records them or the TikTok/Instagram sync
  // runs. Poll only while the tab is visible so a backgrounded PWA stays idle.
  useEffect(() => {
    if (!token) return undefined;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') loadMe();
    }, 60000);
    return () => clearInterval(id);
  }, [token, loadMe]);

  // OAuth (TikTok/Instagram) returns to /creator?<provider>=connected|error. The
  // connect cards only mount on some tabs, so surface the result here at the portal
  // level: toast, refresh, and strip the query param.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tt = params.get('tiktok');
    const ig = params.get('instagram');
    if (!tt && !ig) return;
    if (tt) toast[tt === 'connected' ? 'success' : 'error'](tt === 'connected' ? 'TikTok подключён ✓' : 'Не удалось подключить TikTok');
    if (ig) toast[ig === 'connected' ? 'success' : 'error'](ig === 'connected' ? 'Instagram подключён ✓' : 'Не удалось подключить Instagram');
    window.history.replaceState(null, '', window.location.pathname);
    if (token) loadMe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onAuthed = (tok, payload) => {
    api.setToken(tok);
    setToken(tok);
    setData(payload);
  };
  const logout = () => {
    api.clearToken();
    setToken('');
    setData(null);
    setOpenGuide(false);
  };

  if (!token) {
    const refId = new URLSearchParams(window.location.search).get('ref');
    return <AuthScreen refId={refId} onAuthed={onAuthed} />;
  }
  if (!data) return <Shell><p className="creator-portal__muted">{loading ? 'Загрузка…' : '…'}</p></Shell>;

  const c = data.creator;
  if (!c.onboarding_passed) return <Onboarding authFetch={authFetch} onDone={() => { setOpenGuide(true); loadMe(); }} />;

  // openGuide is set the moment onboarding is completed, so it doubles as "this
  // creator is brand new" — which is exactly who the tour should auto-run for.
  // The 220+ creators already using the cabinet never hit that transition again,
  // so it never ambushes them; they start it from the button in the guide.
  return (
    <Dashboard
      data={data}
      authFetch={authFetch}
      reload={loadMe}
      onLogout={logout}
      initialView={openGuide ? 'guide' : 'overview'}
      autoTour={openGuide}
    />
  );
}

function Shell({ children, wide = false }) {
  return (
    <main className="creator-portal page-light app-light ae-skip">
      <Seo title="CLICKI — кабинет креатора" path="/creator" description="Личный кабинет креатора CLICKI: брифы, сдача видео, кошелёк и рейтинг." noindex />
      <div className={`container creator-portal__inner${wide ? ' creator-portal__inner--wide' : ''}`}>
        {!wide && (
          <div className="creator-portal__head">
            <Link to="/" className="creator-portal__brand"><img className="brand-mark" src="/logo-mark.png" alt="" />CLICKI</Link>
            <span className="creator-portal__tag">кабинет креатора</span>
          </div>
        )}
        {children}
      </div>
    </main>
  );
}

/* ---------------- Auth: login + application tabs ---------------- */
function AuthScreen({ onAuthed, refId }) {
  const [mode, setMode] = useState('login'); // 'login' | 'apply' | 'forgot'
  const [applied, setApplied] = useState(false);
  return (
    <Shell>
      <div className="mascot-avatar"><img src="/mascot-hood.jpg" alt="CLICKI" /></div>
      <h1 className="creator-portal__title">Кабинет креатора</h1>
      {mode === 'forgot' ? (
        <ForgotForm onBack={() => setMode('login')} />
      ) : (
        <>
          <p className="creator-portal__muted">
            {mode === 'login'
              ? 'Войди в аккаунт, который выдал оператор CLICKI.'
              : 'Оставь заявку — оператор свяжется и выдаст доступ в кабинет.'}
          </p>
          <div className="creator-portal__tabs">
            <button className={`creator-portal__tab ${mode === 'login' ? 'is-active' : ''}`} onClick={() => setMode('login')}>
              Вход
            </button>
            <button
              className={`creator-portal__tab ${mode === 'apply' ? 'is-active' : ''}`}
              onClick={() => { setMode('apply'); setApplied(false); }}
            >
              Подать заявку
            </button>
          </div>
          {mode === 'login' ? (
            <LoginForm onAuthed={onAuthed} toApply={() => setMode('apply')} onForgot={() => setMode('forgot')} />
          ) : applied ? (
            <ApplyDone onToLogin={() => { setApplied(false); setMode('login'); }} />
          ) : (
            <ApplyForm refId={refId} onDone={() => setApplied(true)} />
          )}
        </>
      )}
    </Shell>
  );
}

/** "Забыли пароль?" — collects the login + a contact so the operator can restore
 *  access manually (there's no self-serve reset yet). Ends on a "we'll be in touch". */
function ForgotForm({ onBack }) {
  const [f, setF] = useState({ login: '', contact: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!f.login.trim() || !f.contact.trim()) return setError('Укажи логин и Telegram для связи');
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/creator/password-reset-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: f.login.trim(), contact: f.contact.trim() }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((d.errors && d.errors[0]) || 'Ошибка');
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="creator-portal__card cp-forgot-done">
        <div className="cp-forgot-done__icon" aria-hidden="true">✓</div>
        <h2 className="creator-portal__title" style={{ fontSize: '1.25rem', margin: 0 }}>Мы свяжемся с вами скоро</h2>
        <p className="creator-portal__muted">Оператор восстановит доступ и напишет в Telegram, который ты указал.</p>
        <button type="button" className="btn btn--ghost btn--block" onClick={onBack}>Вернуться ко входу</button>
      </div>
    );
  }
  return (
    <form className="creator-portal__card" onSubmit={submit} noValidate>
      <p className="creator-portal__muted">Укажи свой логин и Telegram — оператор восстановит доступ и свяжется с тобой.</p>
      <input placeholder="Твой логин" value={f.login} onChange={(e) => set('login', e.target.value)} />
      <input placeholder="Telegram для связи (@ник или телефон)" value={f.contact} onChange={(e) => set('contact', e.target.value)} />
      {error && <p className="creator-portal__err">{error}</p>}
      <button className="btn btn--primary btn--block" disabled={busy}>{busy ? 'Отправляю…' : 'Отправить'}</button>
      <p className="creator-portal__muted creator-portal__switch">
        <button type="button" className="creator-portal__link" onClick={onBack}>← Назад ко входу</button>
      </p>
    </form>
  );
}

function LoginForm({ onAuthed, toApply, onForgot }) {
  const [f, setF] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/creator/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(f),
      });
      const d = await res.json();
      if (!res.ok) throw new Error((d.errors && d.errors[0]) || 'Ошибка входа');
      onAuthed(d.token, d);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="creator-portal__card" onSubmit={submit} noValidate>
      <input name="username" placeholder="Логин" autoComplete="username" value={f.username} onChange={(e) => set('username', e.target.value)} />
      <input name="password" type="password" placeholder="Пароль" autoComplete="current-password" value={f.password} onChange={(e) => set('password', e.target.value)} />
      {error && <p className="creator-portal__err">{error}</p>}
      <button className="btn btn--primary btn--block" disabled={busy}>{busy ? 'Вхожу…' : 'Войти'}</button>
      <p className="creator-portal__muted creator-portal__switch" style={{ marginBottom: 0 }}>
        <button type="button" className="creator-portal__link" onClick={onForgot}>Забыли пароль?</button>
      </p>
      <p className="creator-portal__muted creator-portal__switch">
        Нет аккаунта?{' '}
        <button type="button" className="creator-portal__link" onClick={toApply}>Подать заявку</button>
      </p>
    </form>
  );
}

function ApplyForm({ refId, onDone }) {
  const [f, setF] = useState({ name: '', contact: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/creator/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...f, referred_by: refId ? Number(refId) : undefined }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error((d.errors && d.errors[0]) || 'Ошибка');
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="creator-portal__card" onSubmit={submit} noValidate>
      <input name="name" placeholder="Имя" autoComplete="name" value={f.name} onChange={(e) => set('name', e.target.value)} />
      <input name="contact" placeholder="Телефон / Telegram" autoComplete="tel" value={f.contact} onChange={(e) => set('contact', e.target.value)} />
      {error && <p className="creator-portal__err">{error}</p>}
      <button className="btn btn--primary btn--block" disabled={busy}>{busy ? 'Отправляю…' : 'Отправить заявку'}</button>
      <p className="creator-portal__muted creator-portal__switch">
        Доступ выдаёт оператор после проверки заявки.
      </p>
    </form>
  );
}

function ApplyDone({ onToLogin }) {
  return (
    <div className="creator-portal__card">
      <div className="creator-portal__applied">
        <span className="creator-portal__applied-icon" aria-hidden="true">✓</span>
        <h2 className="creator-portal__h2" style={{ marginTop: 0 }}>Заявка отправлена</h2>
        <p className="creator-portal__muted">
          Оператор CLICKI свяжется с тобой и выдаст логин и пароль для входа в кабинет.
        </p>
        <button type="button" className="btn btn--ghost btn--block" onClick={onToLogin}>
          Перейти ко входу
        </button>
      </div>
    </div>
  );
}

function Onboarding({ authFetch, onDone }) {
  const [step, setStep] = useState('quiz'); // 'quiz' | 'done'
  const [ans, setAns] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submitQuiz = async () => {
    const correct = QUIZ.filter((q, i) => ans[i] === q.a).length;
    if (correct < QUIZ.length) {
      return setError(`Правильных ${correct} из ${QUIZ.length}. Ответь верно на все — перечитай и попробуй снова.`);
    }
    setBusy(true);
    setError('');
    try {
      const res = await authFetch('/api/creator/onboarding', { method: 'POST' });
      if (!res.ok) throw new Error('Не удалось сохранить — попробуйте ещё раз');
      setStep('done'); // show the welcome screen before opening the cabinet
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (step === 'done') {
    return (
      <Shell>
        <div className="mascot-avatar"><img src="/mascot-hood.jpg" alt="CLICKI" /></div>
        <h1 className="creator-portal__title">Добро пожаловать в CLICKI! 🎉</h1>
        <p className="creator-portal__muted">
          Отличный результат — ты прошёл тест и разобрался в правилах. Теперь можно брать заказы и зарабатывать на коротких видео.
        </p>
        <div className="creator-portal__card">
          <button className="btn btn--primary btn--block" onClick={onDone}>Войти в кабинет →</button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="creator-portal__title">Короткий тест</h1>
      <p className="creator-portal__muted">Несколько вопросов о правилах — чтобы видео не отклонялись потом.</p>
      <div className="creator-portal__card">
        {QUIZ.map((q, i) => (
          <div key={i} className="creator-portal__q">
            <div className="creator-portal__q-title">{i + 1}. {q.q}</div>
            {q.opts.map((o, oi) => (
              <label key={oi} className="creator-portal__opt">
                <input type="radio" name={`q${i}`} checked={ans[i] === oi} onChange={() => setAns((a) => ({ ...a, [i]: oi }))} />
                {o}
              </label>
            ))}
          </div>
        ))}
        {error && <p className="creator-portal__err">{error}</p>}
        <button className="btn btn--primary btn--block" onClick={submitQuiz} disabled={busy}>{busy ? 'Сохраняю…' : 'Пройти тест'}</button>
      </div>
    </Shell>
  );
}

const CREATOR_TABS = [
  { key: 'overview', label: 'Обзор', short: 'Обзор', icon: 'home' },
  { key: 'briefs', label: 'Заказы', short: 'Заказы', icon: 'briefs' },
  { key: 'videos', label: 'Видео', short: 'Видео', icon: 'video' },
  { key: 'referrals', label: 'Рефералы', short: 'Рефы', icon: 'users' },
  { key: 'rating', label: 'Рейтинг', short: 'Топ', icon: 'trophy' },
  { key: 'guide', label: 'Как это работает', short: 'Гайд', icon: 'help' },
  { key: 'account', label: 'Мой аккаунт', short: 'Профиль', icon: 'user' },
];

function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'только что';
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`;
  return `${Math.floor(diff / 86400)} дн назад`;
}

/** Notification bell — shows admin broadcasts. Opening it marks everything read
 *  (clears the badge). Polls once a minute so a fresh broadcast shows up live. */
function NotificationBell({ authFetch }) {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const r = await (await authFetch('/api/creator/announcements')).json();
      if (r.ok !== false) {
        setItems(r.items || []);
        setUnread(r.unread || 0);
      }
    } catch {
      /* keep the last snapshot on a transient error */
    }
  }, [authFetch]);

  useEffect(() => {
    load();
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, 60000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      setUnread(0);
      setItems((prev) => prev.map((it) => ({ ...it, unread: false })));
      try { await authFetch('/api/creator/announcements/seen', { method: 'POST' }); } catch { /* ignore */ }
    }
  };

  return (
    <div className="cp-bell" ref={wrapRef}>
      <button type="button" className="cp-bell__btn" onClick={toggle} aria-label="Уведомления" aria-expanded={open}>
        <Icon name="bell" size={20} />
        {unread > 0 && <span className="cp-bell__badge">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="cp-bell__panel" role="dialog" aria-label="Уведомления">
          <div className="cp-bell__head">Уведомления</div>
          {items.length ? (
            <ul className="cp-bell__list">
              {items.map((a) => (
                <li key={a.id} className={`cp-bell__item ${a.unread ? 'is-unread' : ''}`}>
                  <div className="cp-bell__item-title">{a.title}</div>
                  {a.body && <div className="cp-bell__item-body">{a.body}</div>}
                  <div className="cp-bell__item-time">{timeAgo(a.createdAt)}</div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="cp-bell__empty">Пока нет уведомлений</div>
          )}
        </div>
      )}
    </div>
  );
}

function Dashboard({ data, authFetch, reload, onLogout, initialView = 'overview', autoTour = false }) {
  const { creator: c, wallet, briefs, openBriefs = [], submissions, level } = data;
  const [view, setView] = useState(initialView);
  const [tourOpen, setTourOpen] = useState(autoTour);
  // guides.js stays plain data; the behaviour of a step ("open this tab") is
  // wired here. Memoised so Tour's step effect isn't handed new closures every
  // render. setView from useState is stable, hence the empty deps.
  const tourSteps = useMemo(
    () => CREATOR_TOUR.map((s) => ({ ...s, onEnter: s.view ? () => setView(s.view) : undefined })),
    []
  );
  // Brief pre-selected in the "Сдать видео" form after tapping "Взять в работу".
  const [takeBriefId, setTakeBriefId] = useState('');
  // A published brief is an open order for every creator; anyone can submit to it.
  const submitBriefs = openBriefs.length ? openBriefs : briefs;
  const firstName = (c.name || '').split(' ')[0] || c.name;
  // How many live videos still need today's stats screenshot — surfaced up here
  // so the creator sees the daily task without opening each video card. A video
  // still inside its 10h cooldown isn't counted (nothing to do yet).
  const COOLDOWN_MS = 24 * 60 * 60 * 1000;
  const needStatsToday = submissions.filter((s) => {
    if (s.status === 'rejected' || s.screenshot_today) return false;
    if (s.last_screenshot_at && Date.now() - new Date(s.last_screenshot_at).getTime() < COOLDOWN_MS) return false;
    return true;
  }).length;
  const avatarNode = c.avatar_url
    ? <img src={mediaUrl(c.avatar_url)} alt="" />
    : <span>{(firstName || '?').charAt(0).toUpperCase()}</span>;
  return (
    <Shell wide>
      <div className="cp-shell">
        {/* Desktop sidebar (hidden on mobile — the tab strip takes over there) */}
        <aside className="cp-side">
          <Link to="/" className="cp-side__brand"><img className="brand-mark" src="/logo-mark.png" alt="" />CLICKI</Link>
          <nav className="cp-side__nav" aria-label="Разделы кабинета">
            {CREATOR_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                data-tour={`nav-${tab.key}`}
                className={`cp-side__link ${view === tab.key ? 'is-active' : ''}`}
                onClick={() => setView(tab.key)}
              >
                <span className="cp-side__icon" aria-hidden="true"><Icon name={tab.icon} size={20} /></span>
                {tab.label}
              </button>
            ))}
          </nav>
          <button type="button" className="cp-side__user" onClick={() => setView('account')}>
            <span className="cp-avatar">{avatarNode}</span>
            <span className="cp-side__user-text">
              <b>{firstName}</b>
              <span className="creator-portal__muted">{level}</span>
            </span>
          </button>
        </aside>

        <div className="cp-shell__main">
          <div className="creator-portal__top">
            <button type="button" className="cp-greeting" onClick={() => setView('account')} title="Мой аккаунт">
              <span className="cp-avatar">{avatarNode}</span>
              <span className="cp-greeting__text">
                <span className="creator-portal__title cp-greeting__title">Привет, {firstName} {c.founding && <span className="pf-badge">Founding</span>}</span>
                <span className="creator-portal__muted">{level} · Стрик {c.streak} дн · XP {c.xp} · Trust {c.trust_score}</span>
              </span>
            </button>
            <div className="cp-top__actions">
              <NotificationBell authFetch={authFetch} />
              <button className="btn btn--ghost btn--sm" onClick={onLogout}>Выйти</button>
            </div>
          </div>

          {needStatsToday > 0 && (
            <button type="button" className="cp-reminder" onClick={() => setView('videos')}>
              📊 {needStatsToday === 1 ? '1 видео ждёт скриншот статистики за сегодня' : `${needStatsToday} видео ждут скриншот статистики за сегодня`}
              <span className="cp-reminder__cta">Загрузить →</span>
            </button>
          )}

          <nav className="cp-bottomnav" aria-label="Разделы кабинета">
            {CREATOR_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                data-tour={`nav-${tab.key}`}
                aria-current={view === tab.key ? 'page' : undefined}
                className={`cp-bottomnav__btn ${view === tab.key ? 'is-active' : ''}`}
                onClick={() => setView(tab.key)}
              >
                <span className="cp-bottomnav__icon" aria-hidden="true"><Icon name={tab.icon} size={24} /></span>
                <span className="cp-bottomnav__label">{tab.short || tab.label}</span>
              </button>
            ))}
          </nav>

      {view === 'overview' && (
        <OverviewHome
          c={c} wallet={wallet} level={level} submissions={submissions} briefs={briefs}
          forecast={data.forecast} go={setView}
        />
      )}

      {view === 'briefs' && (
        <OrdersView
          openBriefs={openBriefs}
          briefs={briefs}
          onTake={(id) => { setTakeBriefId(String(id || '')); setView('videos'); }}
          goProfile={() => setView('overview')}
        />
      )}

      {view === 'videos' && (
        <div className="cp-videos">
          <SubmitForm c={c} authFetch={authFetch} briefs={submitBriefs} reload={reload} initialBriefId={takeBriefId} />

          <section className="creator-portal__card cp-videos__list">
            <h2 className="cp-card__title">Мои видео</h2>
            {submissions.length ? (
              <div className="cp-vids">
                {submissions.map((s) => <VideoRow key={s.id} s={s} authFetch={authFetch} reload={reload} />)}
              </div>
            ) : (
              <EmptyState
                icon="🎬"
                title="Пока ничего не сдано"
                hint="Возьми открытый заказ во вкладке «Заказы», сними видео по брифу и загрузи ссылку здесь."
              />
            )}
          </section>
        </div>
      )}

      {view === 'referrals' && (
        <>
          <h2 className="creator-portal__h2">Рефералы</h2>
          <p className="creator-portal__muted cp-section-sub">
            Приглашай друзей-креаторов и приводи бренды по своим ссылкам — за каждого начисляем XP.
          </p>
          {c.username ? (
            <ReferralsView authFetch={authFetch} username={c.username} />
          ) : (
            <div className="creator-portal__card">
              <EmptyState
                icon="🔗"
                title="Ссылки появятся, когда выдадут логин"
                hint="Оператор создаёт тебе логин после подтверждения заявки — тогда здесь появятся твоя реф-ссылка и ссылка для профиля."
              />
            </div>
          )}
        </>
      )}

      {view === 'rating' && (
        <>
          <h2 className="creator-portal__h2">Рейтинг</h2>
          <p className="creator-portal__muted cp-section-sub">
            Чем больше XP, тем выше ты в топе. Снимай видео и держи ежедневный стрик — так рейтинг растёт быстрее.
          </p>
          <Leaderboard meId={c.id} />
        </>
      )}

      {view === 'guide' && (
        <>
          <div className="cp-guide__head">
            <h2 className="creator-portal__h2" style={{ margin: 0 }}>Как это работает</h2>
            <button type="button" className="btn btn--primary btn--sm" onClick={() => setTourOpen(true)}>
              Смотреть тур
            </button>
          </div>
          <p className="creator-portal__muted" style={{ marginTop: 0 }}>
            Тур проведёт по кабинету и покажет, где что находится. Ниже — тот же путь текстом и скриншотами.
          </p>
          <Guide content={CREATOR_GUIDE} />
        </>
      )}

          {view === 'account' && <AccountView c={c} authFetch={authFetch} reload={reload} />}
        </div>
      </div>
      <Tour steps={tourSteps} open={tourOpen} onClose={() => setTourOpen(false)} />
    </Shell>
  );
}

/* ---------------- Creator account (avatar, bio, niche) ---------------- */
function AccountView({ c, authFetch, reload }) {
  const toast = useToast();
  const fileRef = useRef(null);
  const [avatar, setAvatar] = useState(c.avatar_url || '');
  const [city, setCity] = useState(c.city || '');
  const [email, setEmail] = useState(c.email || '');
  const [socials, setSocials] = useState(c.socials || '');
  const [bio, setBio] = useState(c.bio || '');
  const [uploading, setUploading] = useState(false);
  const [cropFile, setCropFile] = useState(null); // raw file being cropped
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  // A user picked a file → open the cropper (validation of the raw file only).
  const pickFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('Нужно изображение (JPG или PNG).');
    if (file.size > 20 * 1024 * 1024) return toast.error('Слишком большой файл — до 20 МБ.');
    setCropFile(file);
  };

  // Upload the cropped 512×512 JPEG blob produced by AvatarCropper.
  const uploadAvatar = async (blob) => {
    setCropFile(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', blob, 'avatar.jpg');
      const res = await authFetch('/api/creator/avatar', { method: 'POST', body: fd });
      const d = await res.json();
      if (!res.ok || d.ok === false) throw new Error(d.errors?.[0] || 'Не удалось загрузить');
      setAvatar(d.creator.avatar_url);
      reload();
      toast.success('Фото обновлено');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setBusy(true);
    setMsg('');
    try {
      const res = await authFetch('/api/creator/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bio, city, socials, email }),
      });
      const d = await res.json();
      if (!res.ok || d.ok === false) throw new Error(d.errors?.[0] || 'Ошибка');
      reload();
      setMsg('Сохранено ✓');
      setTimeout(() => setMsg(''), 2500);
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h2 className="creator-portal__h2">Мой аккаунт</h2>
      <p className="creator-portal__muted cp-section-sub">Аватар и профиль видят бренды и другие креаторы.</p>

      {cropFile && <AvatarCropper file={cropFile} onCancel={() => setCropFile(null)} onConfirm={uploadAvatar} />}

      <div className="creator-portal__card cp-account">
        <div className="cp-account__head">
          <div className="cp-avatar cp-avatar--lg">
            {avatar ? <img src={mediaUrl(avatar)} alt="" /> : <span>{(c.name || '?').charAt(0).toUpperCase()}</span>}
          </div>
          <div className="cp-account__id">
            <b>{c.name}</b>
            {c.username && <span className="creator-portal__muted">@{c.username}</span>}
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; pickFile(f); }} />
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? 'Загрузка…' : avatar ? 'Сменить фото' : 'Загрузить фото'}
            </button>
          </div>
        </div>

        <label className="cp-field-label">Город
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Например: Алматы" />
        </label>
        <label className="cp-field-label">Почта
          <input type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </label>
        <label className="cp-field-label">Соцсети
          <input value={socials} onChange={(e) => setSocials(e.target.value)} placeholder="@ник в TikTok / Instagram" />
        </label>
        <label className="cp-field-label">О себе
          <textarea rows={3} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Пара слов о тебе и твоём контенте" />
        </label>

        <button className="btn btn--primary btn--block" onClick={save} disabled={busy}>{busy ? 'Сохраняю…' : 'Сохранить'}</button>
        {msg && <p className="creator-portal__muted" style={{ textAlign: 'center' }}>{msg}</p>}
      </div>

      {/* Connect social accounts so views sync automatically (no daily screenshots). */}
      <div className="creator-portal__card cp-social">
        <h3 className="cp-card__title">Подключение соцсетей</h3>
        <p className="creator-portal__muted cp-section-sub">Подключи аккаунт — просмотры видео будут подтягиваться сами, без скриншотов.</p>
        <TikTokConnect c={c} authFetch={authFetch} reload={reload} />
        <InstagramSoon />
      </div>
    </>
  );
}

const STYLE_LABELS = {
  youth: 'Молодёжный',
  premium: 'Премиальный',
  corporate: 'Корпоративный',
  entertainment: 'Развлекательный',
};

const SUB_STATUS_RU = {
  ai_check: 'AI-проверка',
  ai_passed: 'на проверке',
  rework: 'на доработку',
  sent_to_business: 'у бизнеса',
  accepted: 'принято',
  rejected: 'отклонено',
  pending: 'ожидает',
};

// XP thresholds mirror the server's levelFromXp — used for the progress ring.
const LEVELS = [
  { name: 'Rookie', min: 0 },
  { name: 'Rising Star', min: 500 },
  { name: 'Pro Creator', min: 2000 },
  { name: 'Elite', min: 5000 },
  { name: 'Legend', min: 15000 },
];
function levelProgress(xp = 0) {
  let idx = 0;
  for (let i = 0; i < LEVELS.length; i += 1) if (xp >= LEVELS[i].min) idx = i;
  const cur = LEVELS[idx];
  const next = LEVELS[idx + 1] || null;
  if (!next) return { cur: cur.name, next: null, pct: 100, toNext: 0, curMin: cur.min, nextMin: cur.min };
  const span = next.min - cur.min;
  return { cur: cur.name, next: next.name, pct: Math.min(100, Math.round(((xp - cur.min) / span) * 100)), toNext: Math.max(0, next.min - xp), curMin: cur.min, nextMin: next.min };
}
const nfmt = (n) => Math.round(n || 0).toLocaleString('ru-RU');

/**
 * Redesigned creator home — the "living product" overview: level progress, key
 * metrics, an attention list of what to do next, and active orders. All from the
 * data the cabinet already loads.
 */
function OverviewHome({ c, wallet, submissions, briefs, forecast, go }) {
  const toast = useToast();
  const lp = levelProgress(c.xp);
  const threshold = wallet.payout_threshold || 0;
  const payoutPct = threshold ? Math.min(100, Math.round((wallet.balance / threshold) * 100)) : 0;
  const accepted = submissions.filter((s) => s.status === 'accepted');
  const totalViews = accepted.reduce((a, s) => a + (s.views || 0), 0);
  const needStats = submissions.filter((s) => s.status !== 'rejected' && !s.screenshot_today).length;
  const inReview = submissions.filter((s) => ['ai_passed', 'sent_to_business'].includes(s.status)).length;
  const activeOrders = [...briefs, ...submissions.filter((s) => s.status !== 'rejected')].slice(0, 6);

  // Human label for an order's status (briefs use active/new/revision; submissions use the pipeline statuses).
  const orderLabel = (o) => ({
    active: 'в работе', new: 'на модерации', revision: 'на доработке',
    ai_check: 'AI-проверка', ai_passed: 'на проверке', rework: 'на доработку',
    sent_to_business: 'у бизнеса', accepted: 'принято', rejected: 'отклонено', paid: 'оплачено',
  }[o.status] || o.status);

  const attention = [];
  if (needStats > 0) attention.push({ icon: '📊', title: `${needStats} видео ждут статистику`, cta: 'Загрузить', onClick: () => go('videos') });
  if (lp.next) attention.push({ icon: '⭐', title: `${nfmt(lp.toNext)} XP до «${lp.next}»`, cta: 'Рейтинг', onClick: () => go('rating') });

  return (
    <div className="cp-home">
      {/* Level card */}
      <div className="cp-level">
        <div className="cp-level__info">
          <div className="cp-level__row">
            <span className="cp-level__name">{lp.cur}</span>
            <span className="cp-chip cp-chip--soft">текущий</span>
          </div>
          <div className="cp-level__bar"><div style={{ width: `${lp.pct}%` }} /></div>
          <div className="cp-level__meta">
            <span>{nfmt(c.xp)}{lp.next ? ` / ${nfmt(lp.nextMin)}` : ''} XP</span>
            {lp.next && <span className="creator-portal__muted">до «{lp.next}» осталось {nfmt(lp.toNext)} XP</span>}
          </div>
        </div>
        <div className="cp-level__badge" aria-hidden="true"><img src="/mascot-hood.jpg" alt="" /></div>
      </div>

      {/* KPI grid */}
      <div className="cp-kpis">
        <div className="cp-kpi">
          <div className="cp-kpi__label">Баланс</div>
          <div className="cp-kpi__value">{nfmt(wallet.balance)} ₸</div>
          <button
            className="btn btn--primary btn--sm cp-kpi__btn"
            onClick={() => toast.info(threshold && wallet.balance >= threshold
              ? 'Выплата на Kaspi оформляется оператором — обычно в течение дня.'
              : `Вывод откроется при балансе ${nfmt(threshold)} ₸ — сейчас ${nfmt(wallet.balance)} ₸.`)}
          >
            Вывести
          </button>
        </div>
        <div className="cp-kpi">
          <div className="cp-kpi__label">До выплаты</div>
          <div className="cp-kpi__value">{nfmt(Math.max(0, threshold - wallet.balance))} ₸</div>
          <div className="cp-kpi__bar"><div style={{ width: `${payoutPct}%` }} /></div>
        </div>
        <div className="cp-kpi">
          <div className="cp-kpi__label">Всего просмотров</div>
          <div className="cp-kpi__value">{nfmt(totalViews)}</div>
          <div className="cp-kpi__sub">{accepted.length} принято</div>
        </div>
        <div className="cp-kpi">
          <div className="cp-kpi__label">В проверке</div>
          <div className="cp-kpi__value">{inReview}</div>
          <div className="cp-kpi__sub">видео на модерации</div>
        </div>
      </div>

      {forecast && <EarningsForecastCard forecast={forecast} />}

      {/* Attention list */}
      {attention.length > 0 && (
        <>
          <h2 className="creator-portal__h2">Требуют внимания</h2>
          <div className="cp-attention">
            {attention.map((a, i) => (
              <div key={i} className="cp-att-card">
                <span className="cp-att-card__icon" aria-hidden="true">{a.icon}</span>
                <div className="cp-att-card__body">
                  <b>{a.title}</b>
                  {a.hint && <span className="creator-portal__muted">{a.hint}</span>}
                </div>
                <button className="btn btn--ghost btn--sm" onClick={a.onClick}>{a.cta}</button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Active orders */}
      <h2 className="creator-portal__h2">Активные заказы</h2>
      {activeOrders.length ? (
        <div className="cp-orders">
          {activeOrders.map((o) => (
            <button key={`${o.id}-${o.status || 'brief'}`} className="cp-order" onClick={() => go(o.status ? 'videos' : 'briefs')}>
              <div className="cp-order__body">
                <b>{o.title || o.brief_title || o.platform}</b>
                <span className="cp-order__sub">{o.platform}{o.status ? ` · ${orderLabel(o)}` : ''}</span>
              </div>
              {o.est_payout > 0 && <span className="cp-order__pay">≈ {nfmt(o.est_payout)} ₸</span>}
              <span className="cp-order__chev" aria-hidden="true">→</span>
            </button>
          ))}
        </div>
      ) : (
        <EmptyState icon="🎬" title="Пока нет активных заказов" hint="Возьми заказ во вкладке «Заказы» и сними видео по брифу." />
      )}
    </div>
  );
}

/** Earnings Forecaster — projects income from the creator's own recent pace. */
function EarningsForecastCard({ forecast }) {
  if (!forecast.videos_30d) {
    return (
      <div className="creator-portal__card">
        <div className="creator-portal__wallet-row"><span>Прогноз заработка</span></div>
        <p className="creator-portal__muted">Прогноз появится после первого принятого видео за последние 30 дней.</p>
      </div>
    );
  }
  return (
    <div className="creator-portal__card">
      <div className="creator-portal__wallet-row">
        <span>Прогноз заработка</span>
        <b>{forecast.pace_30d.toLocaleString('ru-RU')} ₸/мес</b>
      </div>
      <p className="creator-portal__muted">
        В том же темпе (за 30 дней — {forecast.videos_30d} видео).
        {forecast.avg_per_video > 0 && (
          <> Возьми ещё 2 брифа — примерно <b>{forecast.plus_2_briefs.toLocaleString('ru-RU')} ₸</b>.</>
        )}
      </p>
    </div>
  );
}

/**
 * Referrals tab, reworked into one coherent screen:
 *  - the two links a creator shares (bio/lead link + invite-a-friend link), each
 *    with one-click copy, a preview and a plain-language "what it does";
 *  - a funnel readout: link opens → business leads → conversion %, plus the
 *    friend-referral XP — so the creator sees the payoff, not just raw links.
 */
function ReferralsView({ authFetch, username }) {
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await (await authFetch('/api/creator/referrals')).json();
        if (alive) setData(r.referrals || null);
      } catch {
        /* keep the links usable even if stats fail to load */
      }
    })();
    return () => { alive = false; };
  }, [authFetch]);

  const bioLink = `${SITE_URL}/ref/${username}`;
  const friendLink = `${SITE_URL}/friend/${username}`;
  const leads = data?.leads || [];

  return (
    <>
      {/* Funnel: opens → leads → conversion. Numbers show once stats arrive. */}
      <div className="ref-stats">
        <div className="ref-stat">
          <div className="ref-stat__value">{data ? (data.clicks ?? 0).toLocaleString('ru-RU') : '—'}</div>
          <div className="ref-stat__label">Открыли ссылку</div>
        </div>
        <div className="ref-stat__arrow" aria-hidden="true">→</div>
        <div className="ref-stat">
          <div className="ref-stat__value">{data ? (data.total ?? 0).toLocaleString('ru-RU') : '—'}</div>
          <div className="ref-stat__label">Заявок от бизнеса</div>
        </div>
        <div className="ref-stat__arrow" aria-hidden="true">→</div>
        <div className="ref-stat">
          <div className="ref-stat__value">{data?.conversion != null ? `${data.conversion}%` : '—'}</div>
          <div className="ref-stat__label">Конверсия</div>
        </div>
      </div>

      <div className="creator-portal__card ref-link">
        <div className="ref-card__head">
          <span className="ref-card__icon" aria-hidden="true"><Icon name="link" /></span>
          <div className="ref-card__titles">
            <b>Ссылка для профиля</b>
            <span className="creator-portal__muted">приводит клиентов из твоих соцсетей</span>
          </div>
        </div>
        <p className="creator-portal__muted">
          Помести её в шапку профиля в соцсетях. По ней открывается твоя страница на CLICKI с брендами, с которыми ты работал.
          <b> +{data?.xpPerLead ?? 30} XP</b> за каждую заявку бизнеса по этой ссылке.
        </p>
        <div className="ref-link__row">
          <input className="ref-link__input" readOnly value={bioLink} onFocus={(e) => e.target.select()} />
          <CopyButton value={bioLink} />
        </div>
        {data && data.total > 0 && (
          <button type="button" className="creator-portal__link" onClick={() => setOpen((o) => !o)}>
            {open ? 'Скрыть заявки' : `Показать заявки (${data.total})`}
          </button>
        )}
        {open && (
          <ul className="ref-link__leads">
            {leads.map((l) => (
              <li key={l.id} className="creator-portal__muted">Заявка · {l.at}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="creator-portal__card ref-link">
        <div className="ref-card__head">
          <span className="ref-card__icon" aria-hidden="true"><Icon name="users" /></span>
          <div className="ref-card__titles">
            <b>Пригласить друга-креатора</b>
            <span className="creator-portal__muted">+500 XP за каждого</span>
          </div>
        </div>
        <p className="creator-portal__muted">
          Отправь эту ссылку другу. <b>+500 XP</b>, когда у него засчитают первое видео.
        </p>
        <div className="ref-link__row">
          <input className="ref-link__input" readOnly value={friendLink} onFocus={(e) => e.target.select()} />
          <CopyButton value={friendLink} />
        </div>
      </div>
    </>
  );
}

/** Connect TikTok (Login Kit) so view counts sync automatically instead of an operator typing them in. */
/* ---------------- Orders (Заказы) ---------------- */
/** The Заказы tab: open orders (available to everyone) + orders personally
 * assigned to this creator, with a lightweight client-side sort and a
 * "how to get more orders" tip at the bottom. */
function OrdersView({ openBriefs, briefs, onTake, goProfile }) {
  const [sort, setSort] = useState('new');
  // Mark the single most profitable open order as "Топ по выгоде".
  const topPayout = Math.max(0, ...openBriefs.map((b) => b.est_payout || 0));
  const topId = topPayout > 0 ? openBriefs.find((b) => (b.est_payout || 0) === topPayout)?.id : null;
  const sorted = [...openBriefs].sort((a, b) =>
    sort === 'payout' ? (b.est_payout || 0) - (a.est_payout || 0) : (b.id || 0) - (a.id || 0)
  );

  return (
    <>
      <div className="cp-orders-head">
        <h2 className="creator-portal__h2">Заказы <span className="creator-portal__chip">доступны всем</span></h2>
        {openBriefs.length > 1 && (
          <select className="cp-sort" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Сортировка заказов">
            <option value="new">Сначала новые</option>
            <option value="payout">Сначала выгодные</option>
          </select>
        )}
      </div>

      {sorted.length ? (
        sorted.map((b) => <BriefCard key={b.id} b={b} top={b.id === topId} onTake={onTake} />)
      ) : (
        <p className="creator-portal__muted">Открытых заказов пока нет — менеджер скоро опубликует.</p>
      )}

      {briefs.length > 0 && (
        <>
          <h2 className="creator-portal__h2">Назначенные тебе</h2>
          {briefs.map((b) => <BriefCard key={b.id} b={b} onTake={onTake} />)}
        </>
      )}

      <div className="cp-tip">
        <span className="cp-tip__icon" aria-hidden="true">💡</span>
        <div className="cp-tip__body">
          <b>Как получать больше заказов?</b>
          <span className="creator-portal__muted">
            Заполни профиль, загружай качественные видео и повышай уровень — так бренды будут чаще обращаться к тебе.
          </span>
        </div>
        <button type="button" className="btn btn--ghost btn--sm" onClick={goProfile}>Перейти в профиль</button>
      </div>
    </>
  );
}

/** Small monochrome line icons for the order card's meta tiles. */
function TileIcon({ name }) {
  const paths = {
    format: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
    deadline: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    review: <><path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6l7-3z" /><path d="M9 12l2 2 4-4" /></>,
    pay: <><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M2.5 9.5h19" /></>,
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

function BriefCard({ b, top = false, onTake }) {
  const [open, setOpen] = useState(false);
  const spec = b.spec || {};
  const rows = [];
  if (b.goal) rows.push(['Цель', b.goal]);
  if (b.audience) rows.push(['Аудитория', b.audience]);
  if (spec.orientation) rows.push(['Ориентация', spec.orientation === 'horizontal' ? 'Горизонтальное' : 'Вертикальное']);
  rows.push(['Хронометраж', b.duration_min ? `${b.duration_min}–${b.duration_max} сек` : `до ${b.duration_max} сек`]);
  if (spec.cta_required) rows.push(['CTA', 'Обязательно']);
  if (spec.logo_first5) rows.push(['Логотип', 'В первые 5 секунд']);
  if (spec.brand_spoken) rows.push(['Название бренда', 'Обязательно произнести']);
  if (spec.product_in_frame) rows.push(['Продукт в кадре', 'Да']);
  if (spec.style) rows.push(['Стиль', STYLE_LABELS[spec.style] || spec.style]);
  else if (b.tone) rows.push(['Стиль / тон', b.tone]);
  if (b.req_hashtag) rows.push(['Хэштег', b.req_hashtag]);
  if (b.req_mention) rows.push(['Упоминание бренда', 'В первые 3 сек']);
  if (b.req_cta_link) rows.push(['CTA-ссылка', b.req_cta_link]);
  if (b.dos) rows.push(['Делать', b.dos]);
  if (b.donts) rows.push(['Не делать', b.donts]);
  if (b.refs) rows.push(['Референсы', b.refs]);

  const tiles = [
    { name: 'format', label: 'Формат', value: '1 видео' },
    { name: 'deadline', label: 'Дедлайн', value: b.deadline || '—' },
    { name: 'review', label: 'Проверка', value: 'до 48 ч' },
    { name: 'pay', label: 'Оплата', value: 'за результат' },
  ];
  const initial = (b.title || b.platform || '?').trim().charAt(0).toUpperCase();

  return (
    <div className="cp-brief">
      <div className="cp-brief__top">
        <div className="cp-brief__avatar" aria-hidden="true">{initial}</div>
        <div className="cp-brief__heading">
          <b className="cp-brief__title">{b.title}</b>
          <div className="cp-brief__badges">
            <span className="pf-badge">{b.platform}</span>
            {top && <span className="pf-badge pf-badge--accent">Топ по выгоде</span>}
          </div>
        </div>
        {b.est_payout > 0 && (
          <div className="cp-brief__price">
            <span className="cp-brief__price-val">≈ {b.est_payout.toLocaleString('ru-RU')} ₸</span>
            <span className="cp-brief__price-unit">за видео</span>
          </div>
        )}
      </div>

      {b.est_payout > 0 && (
        <p className="cp-brief__est">
          Ожидаемо ~<b>{b.est_payout.toLocaleString('ru-RU')} ₸</b> за видео
          {b.est_basis === 'own' && ` (по твоим ${b.est_sample_size} видео на этой площадке)`}
          {b.est_basis === 'market' && ' (по среднему охвату на платформе)'}
          {b.est_basis === 'baseline' && ' (ориентир, данных пока нет)'}
        </p>
      )}
      {b.key_message && <p className="cp-brief__msg">{b.key_message}</p>}

      <div className="cp-brief__tiles">
        {tiles.map((tile) => (
          <div key={tile.label} className="cp-brief__tile">
            <span className="cp-brief__tile-icon"><TileIcon name={tile.name} /></span>
            <span className="cp-brief__tile-text">
              <span className="cp-brief__tile-label">{tile.label}</span>
              <span className="cp-brief__tile-value">{tile.value}</span>
            </span>
          </div>
        ))}
      </div>

      {open && (
        <dl className="brief-detail">
          {rows.map(([k, v]) => (
            <div key={k} className="brief-detail__row">
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="cp-brief__actions">
        <button type="button" className="creator-portal__link" onClick={() => setOpen((o) => !o)}>
          {open ? 'Свернуть ↑' : 'Читать весь бриф →'}
        </button>
        <button type="button" className="btn btn--primary btn--sm cp-brief__take" onClick={() => onTake?.(b.brief_id || b.id)}>Взять в работу</button>
      </div>
    </div>
  );
}

const MEDALS = ['gold', 'silver', 'bronze'];

function Leaderboard({ meId }) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    fetch(`${API_BASE}/api/leaderboard`)
      .then((r) => r.json())
      .then((d) => setRows(d.leaderboard || []))
      .catch(() => setRows([]));
  }, []);
  if (rows === null) return <p className="creator-portal__muted">Загрузка…</p>;
  if (!rows.length) return <p className="creator-portal__muted">Рейтинг пока пуст.</p>;
  return (
    <div className="creator-portal__card cp-lb">
      {rows.map((r, i) => {
        const rank = i + 1;
        const medal = rank <= 3 ? MEDALS[rank - 1] : null;
        const initial = (r.name || '?').trim().charAt(0).toUpperCase();
        const me = r.id === meId;
        return (
          <div key={r.id} className={`cp-lb-row${me ? ' is-me' : ''}`}>
            <span className={`cp-lb-rank${medal ? ` cp-lb-rank--${medal}` : ''}`}>{rank}</span>
            <span className="cp-lb-avatar" aria-hidden="true">{initial}</span>
            <div className="cp-lb-info">
              <span className="cp-lb-name">
                {r.name}
                {me && <span className="cp-lb-you">ты</span>}
              </span>
              <span className="cp-lb-meta">
                <span className="pf-badge">{r.level}</span>
                {r.streak > 0 && <span className="cp-lb-streak">🔥 {r.streak}</span>}
              </span>
            </div>
            <span className="cp-lb-xp">{(r.xp || 0).toLocaleString('ru-RU')}<span> XP</span></span>
          </div>
        );
      })}
    </div>
  );
}

/** Small monochrome line icons that prefix the submit-form fields. */
function FieldIcon({ name }) {
  const paths = {
    brief: <><path d="M6 2.5h8l5 5v14H6z" /><path d="M14 2.5v5h5" /><path d="M9 13h7M9 16.5h5" /></>,
    platform: <><rect x="3" y="4.5" width="18" height="15" rx="2.5" /><path d="M10.5 9v6l5-3z" /></>,
    link: <><path d="M9.5 14.5l5-5" /><path d="M12 6.5l1-1a3.5 3.5 0 0 1 5 5l-2 2" /><path d="M12 17.5l-1 1a3.5 3.5 0 0 1-5-5l2-2" /></>,
    date: <><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /></>,
    image: <><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><circle cx="9" cy="10" r="1.6" /><path d="M20.5 15.5l-4.5-4.5-8 8" /></>,
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

/** One row in "Мои видео": brand avatar, title + status + views/AI, optional
 * AI feedback, and the daily stats-screenshots strip. */
function VideoRow({ s, authFetch, reload }) {
  const initial = (s.brief_title || s.platform || '?').trim().charAt(0).toUpperCase();
  return (
    <div className="cp-vid">
      <div className="cp-vid__avatar" aria-hidden="true">{initial}</div>
      <div className="cp-vid__body">
        <div className="cp-vid__row1">
          <div className="cp-vid__titlewrap">
            <a className="cp-vid__title" href={safeHref(s.video_url)} target="_blank" rel="noreferrer">{s.brief_title || s.platform}</a>
            <span className={`pf-status pf-status--${s.status}`}>{SUB_STATUS_RU[s.status] || s.status}</span>
          </div>
          <div className="cp-vid__stats">
            <span className="cp-vid__views">{(s.views || 0).toLocaleString('ru-RU')} просм.</span>
            {s.ai_score != null && <span className="ai-score">AI {s.ai_score}/100</span>}
          </div>
        </div>

        {s.status === 'rework' && s.ai_feedback && (
          <p className="creator-portal__rework">↻ На доработку: {s.ai_feedback}</p>
        )}
        {(s.status === 'accepted' || s.status === 'rejected') && s.coach_feedback && (
          <p className="cp-vid__coach">🎯 AI-коуч: {s.coach_feedback}</p>
        )}
        {s.review_note && <p className="cp-vid__note">📝 Комментарий модератора: {s.review_note}</p>}

        {/* Daily stats reporting — only while the video is live (not after a reject). */}
        {s.status !== 'rejected' && (
          <StatScreenshots
            submissionId={s.id}
            platform={s.platform}
            basePath="/api/creator/submissions"
            authFetch={authFetch}
            canUpload
            today={s.screenshot_today}
            count={s.screenshots_count}
            lastAt={s.last_screenshot_at}
            onUploaded={reload}
          />
        )}
      </div>
    </div>
  );
}

function SubmitForm({ c, authFetch, briefs, reload, initialBriefId = '' }) {
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState({ brief_id: initialBriefId || '', platform: 'TikTok', video_url: '', published_at: today, screenshot_url: '', rights_confirmed: false });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [shotUploading, setShotUploading] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const shotRef = useRef(null);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  const uploadShot = async (file) => {
    if (!file) return;
    setError('');
    if (!file.type.startsWith('image/')) return setError('Нужен скриншот-изображение (JPG или PNG).');
    if (file.size > 4 * 1024 * 1024) return setError('Слишком большой файл — сделай обычный скриншот (до 4 МБ).');
    setShotUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await authFetch('/api/creator/upload', { method: 'POST', body: fd });
      const d = await res.json();
      if (!res.ok || d.ok === false) throw new Error(d.errors?.[0] || 'Не удалось загрузить');
      set('screenshot_url', d.url);
    } catch (e) {
      setError(e.message);
    } finally {
      setShotUploading(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!f.brief_id) return setError('Выбери заказ — без брифа сдать видео нельзя');
    if (!f.video_url || !f.rights_confirmed) return setError('Укажи ссылку на видео и подтверди права');
    setBusy(true);
    try {
      const res = await authFetch('/api/creator/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...f, brief_id: f.brief_id || null }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error((d.errors && d.errors[0]) || 'Ошибка');
      setF({ brief_id: '', platform: 'TikTok', video_url: '', published_at: today, screenshot_url: '', rights_confirmed: false });
      reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const guide = guideFor(f.platform);

  return (
    <form className="creator-portal__card cp-submit" onSubmit={submit}>
      <h2 className="cp-card__title">Сдать видео</h2>
      <div className="cp-field">
        <span className="cp-field__icon"><FieldIcon name="brief" /></span>
        <select aria-label="Заказ (бриф)" value={f.brief_id} onChange={(e) => set('brief_id', e.target.value)}>
          <option value="" disabled>Выбери заказ</option>
          {briefs.map((b) => (
            <option key={b.id} value={b.brief_id || b.id}>{b.title}</option>
          ))}
        </select>
      </div>
      {!briefs.length && (
        <p className="creator-portal__muted" style={{ marginTop: -4 }}>
          Нет доступных заказов — возьми заказ во вкладке «Заказы», чтобы сдать по нему видео.
        </p>
      )}
      <div className="cp-field">
        <span className="cp-field__icon"><FieldIcon name="platform" /></span>
        <select aria-label="Платформа" value={f.platform} onChange={(e) => set('platform', e.target.value)}>
          {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
        </select>
      </div>
      {/* Only when TikTok is the chosen platform — connect once so views auto-sync. */}
      {f.platform === 'TikTok' && <TikTokConnect c={c} authFetch={authFetch} reload={reload} compact />}
      <div className="cp-field">
        <span className="cp-field__icon"><FieldIcon name="link" /></span>
        <input placeholder="Ссылка на опубликованное видео" value={f.video_url} onChange={(e) => set('video_url', e.target.value)} />
      </div>
      <div className="cp-field">
        <span className="cp-field__icon"><FieldIcon name="date" /></span>
        <input type="date" value={f.published_at} onChange={(e) => set('published_at', e.target.value)} />
      </div>

      {/* Screenshot of the video's stats: upload (not a link) + a how-to guide —
          uploading it confirms the creator actually has access to the statistics. */}
      <div className="cp-shot">
        <div className="cp-shot__row">
          <input ref={shotRef} type="file" accept="image/*" hidden onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; uploadShot(file); }} />
          <button
            type="button"
            className={`btn btn--sm cp-shot__btn ${f.screenshot_url ? 'is-done' : 'btn--ghost'}`}
            onClick={() => shotRef.current?.click()}
            disabled={shotUploading}
          >
            {shotUploading ? 'Загрузка…' : f.screenshot_url ? '✓ Скриншот статистики загружен' : '📷 Загрузить скриншот статистики'}
          </button>
          <button type="button" className="creator-portal__link cp-shot__help" onClick={() => setGuideOpen((v) => !v)}>
            {guideOpen ? 'Скрыть' : 'Как снять скриншот?'}
          </button>
        </div>
        {f.screenshot_url && <img className="cp-shot__preview" src={mediaUrl(f.screenshot_url)} alt="Скриншот статистики" />}
        {guideOpen && (
          <ol className="cp-shot__guide">
            {guide.steps.map((step, i) => (
              <li key={i}>
                <span>{step.text}</span>
                {step.img && <img src={step.img} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
              </li>
            ))}
          </ol>
        )}
      </div>

      <label className="pf-check">
        <input type="checkbox" checked={f.rights_confirmed} onChange={(e) => set('rights_confirmed', e.target.checked)} /> Подтверждаю права на это видео
      </label>
      {error && <p className="creator-portal__err">{error}</p>}
      <button className="btn btn--primary btn--block" disabled={busy}>{busy ? 'Отправляю…' : 'Сдать видео →'}</button>
    </form>
  );
}
