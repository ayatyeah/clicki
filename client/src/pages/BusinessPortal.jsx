import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Seo from '../components/Seo.jsx';
import Icon from '../components/Icon.jsx';
import { API_BASE } from '../lib/config.js';
import { createApiClient } from '../lib/apiClient.js';
import { safeHref } from '../lib/safeHref.js';
import Guide from '../components/Guide.jsx';
import AvatarCropper from '../components/AvatarCropper.jsx';
import { BUSINESS_GUIDE } from '../content/guides.js';
import { useLang } from '../i18n.jsx';
import { bt } from '../content/businessI18n.js';

/** Compact RU/EN switch for the business cabinet. */
function LangToggle() {
  const { lang, setLang } = useLang();
  return (
    <div className="bz-lang" role="group" aria-label="Язык / Language">
      <button type="button" className={`bz-lang__btn ${lang === 'ru' ? 'is-active' : ''}`} onClick={() => setLang('ru')}>RU</button>
      <button type="button" className={`bz-lang__btn ${lang === 'en' ? 'is-active' : ''}`} onClick={() => setLang('en')}>EN</button>
    </div>
  );
}

const KEY = 'clicki_business_token';
const PLATFORMS = ['TikTok', 'Instagram Reels', 'YouTube Shorts', 'Threads', 'X (Twitter)'];

// Logos may live in Spaces (absolute URL) or Postgres (relative /api/media/:id).
const mediaUrl = (u) => (u && /^https?:\/\//i.test(u) ? u : `${API_BASE}${u}`);
// TODO: written but never rendered — no component consumes this FAQ. Either wire
// it into the cabinet or delete it. Kept so the copy isn't lost silently.
// eslint-disable-next-line no-unused-vars
const BUSINESS_QA = [
  { q: 'Как быстро проверят мой бриф?', a: 'Оператор модерирует новые брифы обычно в течение рабочего дня — статус видно в разделе «Брифы».' },
  { q: 'Как принять готовую работу?', a: 'В разделе «Приёмка» откройте видео по ссылке и нажмите «Принять работу» — после этого создателю автоматически начисляется оплата.' },
  { q: 'Как оплачивается результат?', a: 'Вы платите за реальные органические просмотры по действующим тарифам платформы — без предоплаты за показы, которых не было.' },
  { q: 'Можно исправить бриф после отправки?', a: 'Да, пока он не одобрен — просто отредактируйте его в разделе «Брифы», он снова уйдёт на модерацию.' },
];
const STYLES = [
  ['youth', 'Молодёжный'],
  ['premium', 'Премиальный'],
  ['corporate', 'Корпоративный'],
  ['entertainment', 'Развлекательный'],
];
const SUB_STATUS = {
  ai_check: 'AI-проверка',
  ai_passed: 'на проверке',
  rework: 'на доработке',
  sent_to_business: 'готово к приёмке',
  accepted: 'принято',
  rejected: 'отклонено',
  pending: 'ожидает',
};

export default function BusinessPortal() {
  // Persistent login (localStorage) so the installed PWA reopens into the cabinet.
  const [token, setToken] = useState(() => {
    const legacy = sessionStorage.getItem(KEY);
    if (legacy && !localStorage.getItem(KEY)) { localStorage.setItem(KEY, legacy); sessionStorage.removeItem(KEY); }
    return localStorage.getItem(KEY) || '';
  });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Shared client: bearer + "only 401/403 ends the session" policy (lib/apiClient.js).
  const api = useMemo(
    () => createApiClient({ tokenKey: KEY, persistent: true, onUnauthorized: () => { setToken(''); setData(null); } }),
    []
  );
  const { authFetch } = api;

  const loadMe = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/business/me');
      if (res.status === 401 || res.status === 403) return; // client already cleared the session
      if (!res.ok) throw new Error('load-failed');
      setData(await res.json());
    } catch {
      /* keep the session; retry on next mount / reload */
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (token && !data) loadMe();
  }, [token, data, loadMe]);

  const onAuthed = (tok, payload) => {
    api.setToken(tok);
    setToken(tok);
    setData(payload);
  };
  const logout = () => {
    api.clearToken();
    setToken('');
    setData(null);
  };

  if (!token) return <AuthScreen onAuthed={onAuthed} />;
  if (!data)
    return (
      <main className="creator-portal page-light app-light ae-skip">
        <div className="container creator-portal__inner">
          <p className="creator-portal__muted">{loading ? 'Загрузка…' : '…'}</p>
        </div>
      </main>
    );
  return <Dashboard data={data} authFetch={authFetch} reload={loadMe} onLogout={logout} />;
}

/* ---------------- Auth ---------------- */
function AuthScreen({ onAuthed }) {
  const { lang } = useLang();
  const t = (s) => bt(lang, s);
  const [mode, setMode] = useState('login');
  return (
    <main className="creator-portal page-light app-light ae-skip">
      <Seo title="CLICKI — кабинет бизнеса" path="/business-cabinet" description="Личный кабинет бренда CLICKI." noindex />
      <div className="container creator-portal__inner">
        <div className="creator-portal__head">
          <Link to="/" className="creator-portal__brand"><img className="brand-mark" src="/logo-mark.png" alt="" />CLICKI</Link>
          <span className="creator-portal__tag">{t('кабинет бизнеса')}</span>
          <LangToggle />
        </div>
        <div className="mascot-avatar"><img src="/mascot-hood.jpg" alt="CLICKI" /></div>
        <h1 className="creator-portal__title">{t('Кабинет бизнеса')}</h1>
        <p className="creator-portal__muted">
          {mode === 'login' ? t('Войдите, чтобы создавать брифы и принимать работы.') : t('Создайте аккаунт бренда за минуту.')}
        </p>
        <div className="creator-portal__tabs">
          <button className={`creator-portal__tab ${mode === 'login' ? 'is-active' : ''}`} onClick={() => setMode('login')}>{t('Вход')}</button>
          <button className={`creator-portal__tab ${mode === 'register' ? 'is-active' : ''}`} onClick={() => setMode('register')}>{t('Регистрация')}</button>
        </div>
        {mode === 'login' ? (
          <AuthForm endpoint="/api/business/login" onAuthed={onAuthed} register={false} toRegister={() => setMode('register')} />
        ) : (
          <AuthForm endpoint="/api/business/register" onAuthed={onAuthed} register toRegister={() => setMode('login')} />
        )}
      </div>
    </main>
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function AuthForm({ endpoint, onAuthed, register, toRegister }) {
  const { lang } = useLang();
  const t = (s) => bt(lang, s);
  const [f, setF] = useState({ name: '', company: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    // Validate ourselves (form has noValidate) so a bad value — including one the
    // browser autofilled, e.g. a saved login that isn't actually an email — always
    // produces a visible message instead of the browser silently blocking submit
    // with a native tooltip that's easy to miss.
    if (register && !f.name.trim()) return setError(t('Укажите имя'));
    if (!EMAIL_RE.test(f.email)) return setError(t('Введите настоящий email (проверьте, не подставил ли браузер что-то другое)'));
    if (register && f.password.length < 8) return setError(t('Пароль не короче 8 символов'));
    else if (!register && !f.password) return setError(t('Введите пароль'));
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(f),
      });
      const d = await res.json();
      if (!res.ok) throw new Error((d.errors && d.errors[0]) || t('Ошибка'));
      onAuthed(d.token, d);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="creator-portal__card" onSubmit={submit} noValidate>
      {register && (
        <>
          <input name="name" placeholder={t('Имя')} autoComplete="name" value={f.name} onChange={(e) => set('name', e.target.value)} />
          <input name="organization" placeholder={t('Компания / бренд')} autoComplete="organization" value={f.company} onChange={(e) => set('company', e.target.value)} />
        </>
      )}
      <input name="email" type="email" placeholder={t('Email')} autoComplete="email" value={f.email} onChange={(e) => set('email', e.target.value)} />
      <input name="password" type="password" placeholder={t('Пароль')} autoComplete={register ? 'new-password' : 'current-password'} value={f.password} onChange={(e) => set('password', e.target.value)} />
      {error && <p className="creator-portal__err">{error}</p>}
      <button className="btn btn--primary btn--block" disabled={busy}>{busy ? '…' : register ? t('Создать аккаунт') : t('Войти')}</button>
      <p className="creator-portal__muted creator-portal__switch">
        {register ? t('Уже есть аккаунт? ') : t('Нет аккаунта? ')}
        <button type="button" className="creator-portal__link" onClick={toRegister}>{register ? t('Войти') : t('Создать')}</button>
      </p>
    </form>
  );
}

/* ---------------- Dashboard shell ---------------- */
const NAV = [
  { key: 'home', label: 'Главная', short: 'Главная', icon: 'home' },
  { key: 'briefs', label: 'Брифы', short: 'Брифы', icon: 'briefs' },
  { key: 'review', label: 'Приёмка', short: 'Приёмка', icon: 'check' },
  { key: 'analytics', label: 'Аналитика', short: 'Стата', icon: 'chart' },
  { key: 'guide', label: 'Как это работает', short: 'Гайд', icon: 'help' },
  { key: 'profile', label: 'Профиль', short: 'Профиль', icon: 'user' },
];

function Dashboard({ data, authFetch, reload, onLogout }) {
  const { lang } = useLang();
  const t = (s) => bt(lang, s);
  const [view, setView] = useState('home');
  const b = data.business;
  const briefs = data.briefs || [];
  const submissions = data.submissions || [];
  const incoming = submissions.filter((s) => s.status === 'sent_to_business');
  const accepted = submissions.filter((s) => s.status === 'accepted');
  const go = (key) => setView(key);

  const logoNode = b.logo_url
    ? <img src={mediaUrl(b.logo_url)} alt="" />
    : <span>{(b.company || b.name || '?').charAt(0).toUpperCase()}</span>;

  return (
    <main className="creator-portal page-light app-light ae-skip">
      <Seo title="CLICKI — кабинет бизнеса" path="/business-cabinet" description="Личный кабинет бренда CLICKI." noindex />
      <div className="container creator-portal__inner creator-portal__inner--wide">
        <div className="cp-shell">
          {/* Desktop sidebar (hidden on mobile — the bottom nav takes over there) */}
          <aside className="cp-side">
            <Link to="/" className="cp-side__brand"><img className="brand-mark" src="/logo-mark.png" alt="" />CLICKI</Link>
            <nav className="cp-side__nav" aria-label={t('Меню')}>
              {NAV.map((n) => (
                <button key={n.key} type="button" className={`cp-side__link ${view === n.key ? 'is-active' : ''}`} onClick={() => go(n.key)}>
                  <span className="cp-side__icon" aria-hidden="true"><Icon name={n.icon} size={20} /></span>
                  {t(n.label)}
                </button>
              ))}
            </nav>
            <button type="button" className="cp-side__user" onClick={() => go('profile')}>
              <span className="bp-logo bp-logo--xs">{logoNode}</span>
              <span className="cp-side__user-text">
                <b>{b.company || b.name}</b>
                <span className="creator-portal__muted">{t('Профиль')}</span>
              </span>
            </button>
          </aside>

          <div className="cp-shell__main">
            <div className="creator-portal__top">
              <button type="button" className="cp-greeting" onClick={() => go('profile')} title={t('Профиль')}>
                <span className="bp-logo bp-logo--sm">{logoNode}</span>
                <span className="cp-greeting__text">
                  <span className="creator-portal__title cp-greeting__title">{t('Привет')}, {b.name}</span>
                  <span className="creator-portal__muted">{b.company || t('Бренд')}</span>
                </span>
              </button>
              <div className="bp-topactions">
                <LangToggle />
                <button className="btn btn--ghost btn--sm" onClick={onLogout}>{t('Выйти')}</button>
              </div>
            </div>

            {/* Mobile bottom navigation */}
            <nav className="cp-bottomnav" aria-label={t('Меню')}>
              {NAV.map((n) => (
                <button key={n.key} type="button" aria-current={view === n.key ? 'page' : undefined} className={`cp-bottomnav__btn ${view === n.key ? 'is-active' : ''}`} onClick={() => go(n.key)}>
                  <span className="cp-bottomnav__icon" aria-hidden="true"><Icon name={n.icon} size={22} /></span>
                  <span className="cp-bottomnav__label">{t(n.short || n.label)}</span>
                </button>
              ))}
            </nav>

            {view === 'home' && (
              <Home briefs={briefs} submissions={submissions} incoming={incoming} accepted={accepted} go={go} />
            )}
            {view === 'briefs' && <BriefsView briefs={briefs} authFetch={authFetch} reload={reload} />}
            {view === 'review' && <ReviewView incoming={incoming} accepted={accepted} authFetch={authFetch} reload={reload} />}
            {view === 'analytics' && <Analytics accepted={accepted} authFetch={authFetch} b={b} />}
            {view === 'guide' && (
              <section className="admin-block">
                <h2 className="admin-block__title">{t('Как это работает')}</h2>
                <Guide content={BUSINESS_GUIDE[lang] || BUSINESS_GUIDE.ru} />
              </section>
            )}
            {view === 'profile' && <Profile b={b} authFetch={authFetch} reload={reload} onLogout={onLogout} />}
          </div>
        </div>
      </div>
    </main>
  );
}

function Stat({ label, value, hint }) {
  return (
    <div className="admin-stat">
      <div className="admin-stat__value">{value}</div>
      <div className="admin-stat__label">{label}</div>
      {hint && <div className="bp-stat__hint">{hint}</div>}
    </div>
  );
}

const sumViews = (subs) => subs.reduce((a, s) => a + (s.views || 0), 0);

/* ---------------- Home ---------------- */
function Home({ briefs, submissions, incoming, accepted, go }) {
  const { lang } = useLang();
  const t = (s) => bt(lang, s);
  const activeBriefs = briefs.filter((x) => x.status === 'active').length;
  const recent = submissions.slice(0, 6);
  return (
    <section className="admin-block">
      <p className="muted-note" style={{ textAlign: 'left', marginTop: 0 }}>
        {t('запускайте брифы и принимайте готовые работы.')}
      </p>

      <div className="cp-kpis">
        <div className="cp-kpi">
          <div className="cp-kpi__label">{t('Активные брифы')}</div>
          <div className="cp-kpi__value">{activeBriefs}</div>
          <div className="cp-kpi__sub">{t('всего')} {briefs.length}</div>
        </div>
        <div className="cp-kpi">
          <div className="cp-kpi__label">{t('На приёмке')}</div>
          <div className="cp-kpi__value">{incoming.length}</div>
          {incoming.length > 0 && <button className="btn btn--primary btn--sm cp-kpi__btn" onClick={() => go('review')}>{t('Открыть приёмку')}</button>}
        </div>
        <div className="cp-kpi">
          <div className="cp-kpi__label">{t('Принято работ')}</div>
          <div className="cp-kpi__value">{accepted.length}</div>
        </div>
        <div className="cp-kpi">
          <div className="cp-kpi__label">{t('Суммарный охват')}</div>
          <div className="cp-kpi__value">{sumViews(accepted).toLocaleString('ru-RU')}</div>
          <div className="cp-kpi__sub">{t('просмотров')}</div>
        </div>
      </div>

      <h3 className="admin-block__title admin-subhead">{t('Быстрый доступ')}</h3>
      <div className="bp-quick">
        <button className="bp-quick__tile" onClick={() => go('briefs')}>
          <span className="bp-quick__icon" aria-hidden="true"><Icon name="briefs" /></span>
          <span><b>{t('Создать бриф')}</b><span className="bp-quick__sub">{t('структурированное ТЗ')}</span></span>
        </button>
        <button className="bp-quick__tile" onClick={() => go('review')}>
          <span className="bp-quick__icon" aria-hidden="true"><Icon name="check" /></span>
          <span><b>{t('Приёмка')}</b><span className="bp-quick__sub">{incoming.length} {t('на проверке')}</span></span>
        </button>
        <button className="bp-quick__tile" onClick={() => go('analytics')}>
          <span className="bp-quick__icon" aria-hidden="true"><Icon name="chart" /></span>
          <span><b>{t('Аналитика')}</b><span className="bp-quick__sub">{t('охваты и площадки')}</span></span>
        </button>
      </div>

      <h3 className="admin-block__title admin-subhead">{t('Последние работы')}</h3>
      {recent.length ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>{t('Бриф')}</th><th>{t('Креатор')}</th><th>{t('Статус')}</th><th>{t('Просмотры')}</th></tr></thead>
            <tbody>
              {recent.map((s) => (
                <tr key={s.id}>
                  <td data-label={t('Бриф')}>{s.brief_title || s.platform}</td>
                  <td className="muted-cell" data-label={t('Креатор')}>{s.creator_name || `#${s.creator_id}`}</td>
                  <td data-label={t('Статус')}><span className={`pf-status pf-status--${s.status}`}>{t(SUB_STATUS[s.status] || s.status)}</span></td>
                  <td className="muted-cell" data-label={t('Просмотры')}>{(s.views || 0).toLocaleString('ru-RU')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted-note" style={{ textAlign: 'left' }}>{t('Работ пока нет — создайте бриф, и они появятся здесь.')}</p>
      )}
    </section>
  );
}

/* ---------------- Briefs ---------------- */
const BRIEF_STATUS = {
  active: ['опубликован', 'accepted'],
  revision: ['на доработке', 'rework'],
  new: ['на модерации', 'pending'],
};

function BriefsView({ briefs, authFetch, reload }) {
  const { lang } = useLang();
  const t = (s) => bt(lang, s);
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState(null);
  const applyDraft = (d) => {
    setEditing(null);
    setDraft(d);
  };
  return (
    <>
      {!editing && <BriefConstructor authFetch={authFetch} onUseDraft={applyDraft} />}

      <section className="admin-block">
        <h2 className="admin-block__title">{editing ? t('Редактировать бриф') : t('Создать бриф')}</h2>
        {editing && (
          <p className="muted-note" style={{ textAlign: 'left', marginTop: 0 }}>
            {t('После сохранения бриф снова уйдёт к нам на модерацию.')}{' '}
            <button className="creator-portal__link" onClick={() => setEditing(null)}>{t('Отмена')}</button>
          </p>
        )}
        <BriefForm key={editing?.id || draft?.title || 'new'} authFetch={authFetch} reload={reload} brief={editing} draft={draft} onDone={() => { setEditing(null); setDraft(null); }} />
      </section>

      <section className="admin-block">
        <h2 className="admin-block__title">{t('Мои брифы')} ({briefs.length})</h2>
        {briefs.length ? (
          <div className="bp-cards">
            {briefs.map((br) => {
              const [label, cls] = BRIEF_STATUS[br.status] || [br.status, 'pending'];
              return (
                <div key={br.id} className="bp-card">
                  <div className="bp-card__head">
                    <b>{br.title}</b>
                    <span className={`pf-status pf-status--${cls}`}>{t(label)}</span>
                  </div>
                  <p className="creator-portal__muted" style={{ margin: 0 }}>
                    {br.platform} · {br.spec?.orientation === 'horizontal' ? t('горизонтальное') : t('вертикальное')} · {t('до')} {br.duration_max}{lang === 'en' ? 's' : 'с'}
                    {br.spec?.style ? ` · ${t(STYLES.find((s) => s[0] === br.spec.style)?.[1] || br.spec.style)}` : ''}
                  </p>
                  {br.status === 'revision' && (
                    <>
                      {br.revision_note && <div className="mod-note" style={{ marginTop: 10 }}>{t('На доработку: ')}{br.revision_note}</div>}
                      <button className="btn btn--primary btn--sm" style={{ marginTop: 10 }} onClick={() => setEditing(br)}>
                        {t('Исправить и отправить снова')}
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="muted-note" style={{ textAlign: 'left' }}>{t('Брифов пока нет — создайте первый выше.')}</p>
        )}
      </section>
    </>
  );
}

/* ---------------- AI Brief Constructor 2.0 ---------------- */
function BriefConstructor({ authFetch, onUseDraft }) {
  const { lang } = useLang();
  const t = (s) => bt(lang, s);
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [platform, setPlatform] = useState('TikTok');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const generate = async () => {
    if (!url.trim() && !description.trim()) return setError(t('Укажите ссылку на сайт/соцсеть или опишите продукт'));
    setError('');
    setBusy(true);
    setResult(null);
    try {
      const res = await authFetch('/api/business/brief-constructor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() || undefined, description: description.trim() || undefined, platform }),
      });
      const j = await res.json();
      if (!j.ok) return setError(j.errors?.[0] || t('Не удалось сгенерировать брифы'));
      setResult(j);
    } catch {
      setError(t('Не удалось сгенерировать — попробуйте позже'));
    } finally {
      setBusy(false);
    }
  };

  const applyDraft = (d) => {
    onUseDraft({
      title: d.title,
      platform,
      key_message: [d.hook, d.key_message].filter(Boolean).join(' — '),
      dos: d.dos,
      donts: d.donts,
    });
  };

  return (
    <section className="admin-block">
      <div className="admin-panel__head">
        <h2 className="admin-block__title">{t('AI-конструктор брифа')}</h2>
        <button className="btn btn--ghost btn--sm" onClick={() => setOpen((v) => !v)}>{open ? t('Свернуть') : t('Открыть')}</button>
      </div>
      {open && (
        <>
          <p className="muted-note" style={{ textAlign: 'left' }}>
            {t('Укажите ссылку на сайт/соцсеть продукта и/или опишите его словами — AI предложит 3 готовых варианта брифа.')}
          </p>
          <div className="bp-calc" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <input placeholder={t('https://ваш-сайт.kz или ссылка на профиль')} value={url} onChange={(e) => setUrl(e.target.value)} />
            <textarea rows={3} placeholder={t('Опишите продукт/акцию своими словами (необязательно, если указана ссылка)')} value={description} onChange={(e) => setDescription(e.target.value)} />
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
                {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
              </select>
              <button className="btn btn--primary btn--sm" onClick={generate} disabled={busy}>{busy ? t('Генерирую…') : t('Сгенерировать 3 варианта')}</button>
            </div>
          </div>
          {error && (
            <div className="creator-portal__err" style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
              <span>{error}</span>
              <button className="btn btn--ghost btn--sm" onClick={generate}>{t('↻ Попробовать снова')}</button>
            </div>
          )}
          {busy && (
            <div className="bp-cards">
              {[0, 1, 2].map((i) => <div key={i} className="bp-card bp-card--skeleton" aria-hidden="true" />)}
            </div>
          )}
          {result && (
            <>
              <p className="creator-portal__muted" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {t('Понятность входных данных')}: <ScorePill score={result.score} />
                {result.tips && <span>{result.tips}</span>}
              </p>
              <div className="bp-cards">
                {result.drafts.map((d, i) => (
                  <div key={i} className="bp-card">
                    <div className="bp-card__head"><b>{d.title || `${t('Вариант')} ${i + 1}`}</b></div>
                    {d.hook && <p className="creator-portal__muted"><i>«{d.hook}»</i></p>}
                    {d.key_message && <p className="creator-portal__muted">{d.key_message}</p>}
                    {d.tone && <p className="creator-portal__muted">{t('Тон:')} {d.tone}</p>}
                    {d.dos && <p className="creator-portal__muted">✓ {d.dos}</p>}
                    {d.donts && <p className="creator-portal__muted">✗ {d.donts}</p>}
                    <button className="btn btn--ghost btn--sm" style={{ marginTop: 8 }} onClick={() => applyDraft(d)}>{t('Использовать этот вариант')}</button>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}

/* ---------------- Acceptance ---------------- */
function ReviewView({ incoming, accepted, authFetch, reload }) {
  const { lang } = useLang();
  const t = (s) => bt(lang, s);
  const [acceptingId, setAcceptingId] = useState(null);
  const [error, setError] = useState('');
  const accept = async (id) => {
    if (acceptingId) return; // one in flight at a time — blocks a rapid double-click double-accept
    setAcceptingId(id);
    setError('');
    try {
      const res = await authFetch(`/api/business/submissions/${id}/accept`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data.errors && data.errors[0]) || t('Не удалось принять работу'));
        return;
      }
      reload();
    } finally {
      setAcceptingId(null);
    }
  };
  return (
    <>
      <section className="admin-block">
        <h2 className="admin-block__title">{t('На приёмку')} ({incoming.length})</h2>
        {error && <p className="creator-portal__err">{error}</p>}
        {incoming.length ? (
          <div className="bp-cards">
            {incoming.map((s) => (
              <div key={s.id} className="bp-card">
                <div className="bp-card__head">
                  <b>{s.brief_title || s.platform}</b>
                  <span className="pf-status pf-status--sent_to_business">{t('готово к приёмке')}</span>
                </div>
                <p className="creator-portal__muted" style={{ margin: '0 0 12px' }}>
                  {t('Креатор')}: {s.creator_name || `#${s.creator_id}`} · {s.platform}
                  {s.ai_score != null ? ` · AI ${s.ai_score}/100` : ''}
                </p>
                <div className="creator-portal__row-actions">
                  <a className="btn btn--ghost btn--sm" href={safeHref(s.video_url)} target="_blank" rel="noreferrer">{t('Смотреть видео')}</a>
                  <button className="btn btn--primary btn--sm" onClick={() => accept(s.id)} disabled={acceptingId === s.id}>
                    {acceptingId === s.id ? t('Принимаю…') : t('Принять работу')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted-note" style={{ textAlign: 'left' }}>{t('Работ на приёмке пока нет.')}</p>
        )}
      </section>

      <section className="admin-block">
        <h2 className="admin-block__title">{t('Принятые')} ({accepted.length})</h2>
        {accepted.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>{t('Бриф')}</th><th>{t('Креатор')}</th><th>{t('Видео')}</th><th>{t('Просмотры')}</th></tr></thead>
              <tbody>
                {accepted.map((s) => (
                  <tr key={s.id}>
                    <td data-label={t('Бриф')}>{s.brief_title || s.platform}</td>
                    <td className="muted-cell" data-label={t('Креатор')}>{s.creator_name || `#${s.creator_id}`}</td>
                    <td data-label={t('Видео')}><a href={safeHref(s.video_url)} target="_blank" rel="noreferrer">{t('ссылка')}</a></td>
                    <td className="muted-cell" data-label={t('Просмотры')}>{(s.views || 0).toLocaleString('ru-RU')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted-note" style={{ textAlign: 'left' }}>{t('Принятых работ пока нет.')}</p>
        )}
      </section>
    </>
  );
}

/* ---------------- Analytics ---------------- */
function Analytics({ accepted, authFetch, b }) {
  const { lang } = useLang();
  const t = (s) => bt(lang, s);
  const total = sumViews(accepted);
  const byPlatform = {};
  for (const s of accepted) byPlatform[s.platform] = (byPlatform[s.platform] || 0) + (s.views || 0);
  const rows = Object.entries(byPlatform).sort((a, b) => b[1] - a[1]);
  const top = [...accepted].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 5);

  return (
    <section className="admin-block">
      <div className="admin-panel__head">
        <h2 className="admin-block__title">{t('Аналитика')} <span className="an-live">● live</span></h2>
      </div>
      <GrowthChart authFetch={authFetch} />

      <ViewCalculator authFetch={authFetch} />

      <PrintableReport authFetch={authFetch} business={b} />

      <h3 className="admin-block__title admin-subhead">{t('Сводка')}</h3>
      <div className="admin-stats">
        <Stat label={t('Принято работ')} value={accepted.length} />
        <Stat label={t('Суммарный охват')} value={total.toLocaleString('ru-RU')} hint={t('просмотров')} />
        <Stat label={t('Площадок')} value={rows.length} />
      </div>

      <h3 className="admin-block__title admin-subhead">{t('Просмотры по платформам')}</h3>
      {rows.length ? (
        <div className="bp-bars">
          {rows.map(([p, v]) => (
            <div key={p} className="bp-bar">
              <span className="bp-bar__label">{p}</span>
              <span className="bp-bar__track"><span className="bp-bar__fill" style={{ width: `${total ? Math.round((v / total) * 100) : 0}%` }} /></span>
              <span className="bp-bar__val">{v.toLocaleString('ru-RU')}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted-note" style={{ textAlign: 'left' }}>{t('Данных пока нет — появятся после принятых работ.')}</p>
      )}

      <h3 className="admin-block__title admin-subhead">{t('Топ видео')}</h3>
      {top.length ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>{t('Бриф')}</th><th>{t('Платформа')}</th><th>{t('Просмотры')}</th></tr></thead>
            <tbody>
              {top.map((s) => (
                <tr key={s.id}>
                  <td data-label={t('Бриф')}><a href={safeHref(s.video_url)} target="_blank" rel="noreferrer">{s.brief_title || t('видео')}</a></td>
                  <td className="muted-cell" data-label={t('Платформа')}>{s.platform}</td>
                  <td className="muted-cell" data-label={t('Просмотры')}>{(s.views || 0).toLocaleString('ru-RU')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted-note" style={{ textAlign: 'left' }}>{t('Пока нет данных.')}</p>
      )}
    </section>
  );
}

/* ---------------- Printable campaign performance report ---------------- */
function PrintableReport({ authFetch, business }) {
  const { lang } = useLang();
  const t = (s) => bt(lang, s);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await (await authFetch('/api/business/report')).json();
      if (r.ok !== false) setReport(r);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line

  return (
    <>
      <h3 className="admin-block__title admin-subhead">{t('Отчёт по кампании')}</h3>
      <p className="muted-note" style={{ textAlign: 'left' }}>{t('Сводка по всем принятым работам — просмотры, расходы и стоимость охвата по платформам.')}</p>
      <button className="btn btn--ghost btn--sm" onClick={() => window.print()} disabled={loading || !report}>
        🖨 {t('Печать / сохранить PDF')}
      </button>

      {report && (
        <div id="printable-report" className="report-print">
          <div className="report-print__head">
            <div className="report-print__brand">CLICKI</div>
            <div>
              <h2>{t('Отчёт по кампании')} — {business?.company || business?.name}</h2>
              <p className="creator-portal__muted">{t('Сформирован')} {new Date(report.generated_at).toLocaleString(lang === 'en' ? 'en-US' : 'ru-RU')}</p>
            </div>
          </div>

          <div className="admin-stats">
            <Stat label={t('Принято видео')} value={report.totals.videos} />
            <Stat label={t('Суммарный охват')} value={report.totals.views.toLocaleString('ru-RU')} />
            <Stat label={t('Потрачено')} value={`${report.totals.spend.toLocaleString('ru-RU')} ₸`} />
          </div>

          <table className="admin-table" style={{ marginTop: 16 }}>
            <thead><tr><th>{t('Платформа')}</th><th>{t('Видео')}</th><th>{t('Просмотры')}</th><th>{t('Расход')}</th><th>{t('Цена за 1000 просм.')}</th></tr></thead>
            <tbody>
              {report.byPlatform.map((p) => (
                <tr key={p.platform}>
                  <td data-label={t('Платформа')}>{p.platform}</td>
                  <td data-label={t('Видео')}>{p.videos}</td>
                  <td data-label={t('Просмотры')}>{p.views.toLocaleString('ru-RU')}</td>
                  <td data-label={t('Расход')}>{p.spend.toLocaleString('ru-RU')} ₸</td>
                  <td data-label={t('Цена за 1000 просм.')}>{p.cost_per_1k_views.toLocaleString('ru-RU')} ₸</td>
                </tr>
              ))}
              {!report.byPlatform.length && <tr><td colSpan={5} className="admin-table__empty">{t('Пока нет принятых работ')}</td></tr>}
            </tbody>
          </table>

          {report.topVideos.length > 0 && (
            <>
              <h3 className="admin-block__title admin-subhead">{t('Топ видео')}</h3>
              <table className="admin-table">
                <thead><tr><th>{t('Бриф')}</th><th>{t('Платформа')}</th><th>{t('Просмотры')}</th></tr></thead>
                <tbody>
                  {report.topVideos.map((v) => (
                    <tr key={v.id}>
                      <td data-label={t('Бриф')}>{v.brief_title || t('видео')}</td>
                      <td data-label={t('Платформа')}>{v.platform}</td>
                      <td data-label={t('Просмотры')}>{v.views.toLocaleString('ru-RU')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </>
  );
}

/* ---------------- Predictive View Calculator ---------------- */
function ViewCalculator({ authFetch }) {
  const { lang } = useLang();
  const t = (s) => bt(lang, s);
  const [budget, setBudget] = useState('');
  const [platform, setPlatform] = useState('');
  const [estimate, setEstimate] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const calc = async () => {
    const b = Number(budget);
    if (!b || b <= 0) return setError(t('Введите бюджет'));
    setError('');
    setBusy(true);
    try {
      const params = new URLSearchParams({ budget: String(b) });
      if (platform) params.set('platform', platform);
      const res = await authFetch(`/api/business/view-calculator?${params}`);
      const j = await res.json();
      if (!j.ok) return setError(j.errors?.[0] || t('Не удалось посчитать'));
      setEstimate(j.estimate || []);
    } catch {
      setError(t('Не удалось посчитать — попробуйте позже'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h3 className="admin-block__title admin-subhead">{t('Калькулятор охвата')}</h3>
      <p className="muted-note" style={{ textAlign: 'left' }}>{t('Введите бюджет — получите оценку охвата и числа видео на основе реальной статистики CLICKI.')}</p>
      <div className="bp-calc">
        <input
          type="number"
          placeholder={t('Бюджет, ₸')}
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
        />
        <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
          <option value="">{t('Все платформы')}</option>
          {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <button className="btn btn--primary btn--sm" onClick={calc} disabled={busy}>{busy ? t('Считаю…') : t('Рассчитать')}</button>
      </div>
      {error && <p className="creator-portal__err">{error}</p>}
      {estimate && (
        estimate.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>{t('Платформа')}</th><th>{t('Охват')}</th><th>{t('Видео')}</th><th>{t('Ср. охват/видео')}</th><th>{t('Достоверность')}</th></tr></thead>
              <tbody>
                {estimate.map((e) => (
                  <tr key={e.platform}>
                    <td data-label={t('Платформа')}>{e.platform}</td>
                    <td data-label={t('Охват')}>{e.total_views.toLocaleString('ru-RU')}</td>
                    <td data-label={t('Видео')}>~{e.est_videos}</td>
                    <td className="muted-cell" data-label={t('Ср. охват/видео')}>{e.avg_views_per_video.toLocaleString('ru-RU')}</td>
                    <td data-label={t('Достоверность')}><BasisPill basis={e.basis} sampleSize={e.sample_size} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted-note" style={{ textAlign: 'left' }}>{t('Нет тарифа для расчёта.')}</p>
        )
      )}
    </>
  );
}

/** Shared confidence indicator for any AI-ish estimate built off historical
 * data: distinguishes "enough of our own data", "a couple data points, take
 * with a grain of salt", and "no data at all, this is a flat guess" — so a
 * business doesn't mistake a 1-video average for a reliable number. */
function BasisPill({ basis, sampleSize }) {
  const { lang } = useLang();
  const t = (s) => bt(lang, s);
  if (basis === 'own') return <span className="pf-status pf-status--accepted">{t('по')} {sampleSize} {t('видео')}</span>;
  if (basis === 'limited') return <span className="pf-status pf-status--rework">{t('мало данных')} ({sampleSize})</span>;
  return <span className="pf-status pf-status--pending">{t('ориентир, данных нет')}</span>;
}

/** 0-100 quality/clarity score → color pill, so a number carries its own
 * verdict at a glance instead of requiring the reader to interpret it. */
function ScorePill({ score }) {
  const cls = score >= 70 ? 'pf-status--accepted' : score >= 40 ? 'pf-status--rework' : 'pf-status--rejected';
  return <span className={`pf-status ${cls}`}>{score}/100</span>;
}

/* ---------------- Live growth chart ---------------- */
const fmtN = (n) => Math.round(n).toLocaleString('ru-RU');
const fmtDay = (d) => `${d.slice(8, 10)}.${d.slice(5, 7)}`;

/** Cumulative campaign views over time — real, not self-reported: it's built
 * from the same view-count entries the operator records for payouts. */
function GrowthChart({ authFetch }) {
  const { lang } = useLang();
  const t = (s) => bt(lang, s);
  const [series, setSeries] = useState(null);
  const [hover, setHover] = useState(null); // index into series, or null
  const [showTable, setShowTable] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await (await authFetch('/api/business/growth')).json();
      setSeries(r.growth || []);
    } catch {
      /* keep previous render on a failed poll */
    }
  }, [authFetch]);

  useEffect(() => {
    load();
    const id = setInterval(load, 15000); // live: refresh without a page reload
    return () => clearInterval(id);
  }, [load]);

  if (series === null) return <p className="muted-note" style={{ textAlign: 'left' }}>{t('Загрузка…')}</p>;
  if (series.length < 2) {
    return (
      <div className="growth-chart">
        <p className="muted-note" style={{ textAlign: 'left' }}>
          {t('Пока недостаточно данных для графика роста — он появится, как только по вашим работам зафиксируют просмотры хотя бы дважды.')}
        </p>
      </div>
    );
  }

  const W = 640, H = 200, PAD_L = 44, PAD_B = 22, PAD_T = 12, PAD_R = 12;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;
  const maxV = Math.max(...series.map((p) => p.views), 1) * 1.1;
  const x = (i) => PAD_L + (innerW * i) / (series.length - 1);
  const y = (v) => PAD_T + innerH - (innerH * v) / maxV;

  const linePath = series.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.views).toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${x(series.length - 1).toFixed(1)} ${PAD_T + innerH} L ${x(0).toFixed(1)} ${PAD_T + innerH} Z`;
  const gridSteps = 4;
  const active = hover != null ? series[hover] : series[series.length - 1];
  const last = series[series.length - 1];

  return (
    <div className="growth-chart">
      <div className="growth-chart__hero">
        <div className="growth-chart__hero-value">{fmtN(last.views)}</div>
        <div className="growth-chart__hero-label">{t('просмотров всего')} · {t('по данным на')} {fmtDay(last.day)}</div>
      </div>

      <svg
        className="growth-chart__svg"
        viewBox={`0 0 ${W} ${H}`}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - rect.left) / rect.width) * W;
          let nearest = 0, best = Infinity;
          series.forEach((_, i) => {
            const d = Math.abs(x(i) - px);
            if (d < best) { best = d; nearest = i; }
          });
          setHover(nearest);
        }}
      >
        {Array.from({ length: gridSteps + 1 }, (_, i) => {
          const v = (maxV * i) / gridSteps;
          const gy = y(v);
          return (
            <g key={i}>
              <line x1={PAD_L} y1={gy} x2={W - PAD_R} y2={gy} className="growth-chart__grid" />
              <text x={PAD_L - 8} y={gy + 3} className="growth-chart__axis" textAnchor="end">{fmtN(v)}</text>
            </g>
          );
        })}

        <path d={areaPath} className="growth-chart__area" />
        <path d={linePath} className="growth-chart__line" />

        {hover != null && <line x1={x(hover)} y1={PAD_T} x2={x(hover)} y2={PAD_T + innerH} className="growth-chart__crosshair" />}

        {[0, series.length - 1].map((i) => (
          <circle key={i} cx={x(i)} cy={y(series[i].views)} r="4" className="growth-chart__dot" />
        ))}
        {hover != null && <circle cx={x(hover)} cy={y(series[hover].views)} r="5" className="growth-chart__dot growth-chart__dot--hover" />}

        <text x={x(0)} y={H - 4} className="growth-chart__axis" textAnchor="start">{fmtDay(series[0].day)}</text>
        <text x={x(series.length - 1)} y={H - 4} className="growth-chart__axis" textAnchor="end">{fmtDay(series[series.length - 1].day)}</text>
      </svg>

      <div className="growth-chart__tooltip">
        <b>{fmtN(active.views)}</b> {t('просмотров на')} {fmtDay(active.day)}
      </div>

      <button className="creator-portal__link" onClick={() => setShowTable((s) => !s)} style={{ fontSize: '0.85rem' }}>
        {showTable ? t('Скрыть таблицу') : t('Показать таблицей')}
      </button>
      {showTable && (
        <div className="admin-table-wrap" style={{ marginTop: 8 }}>
          <table className="admin-table">
            <thead><tr><th>{t('Дата')}</th><th>{t('Просмотров всего')}</th></tr></thead>
            <tbody>
              {series.map((p) => (
                <tr key={p.day}><td data-label={t('Дата')}>{p.day}</td><td className="muted-cell" data-label={t('Просмотров всего')}>{fmtN(p.views)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------------- Profile ---------------- */
function Profile({ b, authFetch, reload, onLogout }) {
  const { lang } = useLang();
  const t = (s) => bt(lang, s);
  const fileRef = useRef(null);
  const [logo, setLogo] = useState(b.logo_url || '');
  const [name, setName] = useState(b.name || '');
  const [company, setCompany] = useState(b.company || '');
  const [uploading, setUploading] = useState(false);
  const [cropFile, setCropFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const pickLogo = (file) => {
    if (!file) return;
    setErr('');
    if (!file.type.startsWith('image/')) return setErr(t('Нужно изображение (JPG или PNG).'));
    if (file.size > 20 * 1024 * 1024) return setErr(t('Слишком большой файл — до 20 МБ.'));
    setCropFile(file);
  };

  const uploadLogo = async (blob) => {
    setCropFile(null);
    setErr('');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', blob, 'logo.jpg');
      const res = await authFetch('/api/business/logo', { method: 'POST', body: fd });
      const d = await res.json();
      if (!res.ok || d.ok === false) throw new Error(d.errors?.[0] || t('Не удалось загрузить'));
      setLogo(d.business.logo_url);
      reload();
      setMsg(`${t('Логотип обновлён')} ✓`);
      setTimeout(() => setMsg(''), 2500);
    } catch (e) {
      setErr(e.message);
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setBusy(true);
    setMsg('');
    setErr('');
    try {
      const res = await authFetch('/api/business/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, company }),
      });
      const d = await res.json();
      if (!res.ok || d.ok === false) throw new Error(d.errors?.[0] || t('Ошибка'));
      reload();
      setMsg(`${t('Сохранено')} ✓`);
      setTimeout(() => setMsg(''), 2500);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="admin-block">
      <h2 className="admin-block__title">{t('Профиль компании')}</h2>

      {cropFile && <AvatarCropper file={cropFile} round={false} onCancel={() => setCropFile(null)} onConfirm={uploadLogo} />}

      <div className="bp-card" style={{ maxWidth: 520 }}>
        <div className="bp-account__head">
          <div className="bp-logo">
            {logo ? <img src={mediaUrl(logo)} alt="" /> : <span>{(company || name || '?').charAt(0).toUpperCase()}</span>}
          </div>
          <div className="bp-account__id">
            <b>{company || name}</b>
            <span className="creator-portal__muted" style={{ margin: 0 }}>{t('Логотип видят креаторы в заказах и профиле бренда.')}</span>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; pickLogo(f); }} />
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? t('Загрузка…') : logo ? t('Сменить логотип') : t('Загрузить логотип')}
            </button>
          </div>
        </div>

        <label className="cp-field-label">{t('Имя')}
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="cp-field-label">{t('Компания')}
          <input value={company} onChange={(e) => setCompany(e.target.value)} />
        </label>
        <div className="bp-profile__row"><span className="bp-profile__k">{t('Email')}</span><span>{b.email}</span></div>

        {err && <p className="creator-portal__err">{err}</p>}
        <button className="btn btn--primary btn--block" onClick={save} disabled={busy}>{busy ? t('Сохраняю…') : t('Сохранить')}</button>
        {msg && <p className="creator-portal__muted" style={{ textAlign: 'center', color: '#15803d' }}>{msg}</p>}
        <button className="btn btn--ghost btn--sm" style={{ marginTop: 6 }} onClick={onLogout}>{t('Выйти')}</button>
      </div>
    </section>
  );
}

/* ---------------- Brief builder (structured) ---------------- */
const EMPTY_BRIEF = {
  title: '',
  platform: 'TikTok',
  key_message: '',
  dos: '',
  donts: '',
  req_hashtag: '',
  req_cta_link: '',
  orientation: 'vertical',
  max_duration: 25,
  cta_required: true,
  logo_first5: true,
  brand_spoken: false,
  product_in_frame: true,
  style: 'youth',
};

function BriefForm({ authFetch, reload, brief = null, draft = null, onDone }) {
  const { lang } = useLang();
  const t = (s) => bt(lang, s);
  const src = brief || draft;
  const initial = src
    ? {
        title: src.title || '',
        platform: src.platform || 'TikTok',
        key_message: src.key_message || '',
        dos: src.dos || '',
        donts: src.donts || '',
        req_hashtag: src.req_hashtag || '',
        req_cta_link: src.req_cta_link || '',
        orientation: src.spec?.orientation || 'vertical',
        max_duration: src.spec?.max_duration || src.duration_max || 25,
        cta_required: src.spec?.cta_required ?? true,
        logo_first5: src.spec?.logo_first5 ?? true,
        brand_spoken: src.spec?.brand_spoken ?? false,
        product_in_frame: src.spec?.product_in_frame ?? true,
        style: src.spec?.style || 'youth',
      }
    : EMPTY_BRIEF;
  const [f, setF] = useState(initial);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setMsg('');
    if (!f.title.trim()) return setError(t('Укажите название брифа'));
    setBusy(true);
    try {
      const payload = {
        title: f.title,
        platform: f.platform,
        key_message: f.key_message,
        dos: f.dos,
        donts: f.donts,
        req_hashtag: f.req_hashtag,
        req_cta_link: f.req_cta_link,
        duration_max: Number(f.max_duration) || 25,
        tone: STYLES.find((s) => s[0] === f.style)?.[1] || f.style,
        spec: {
          orientation: f.orientation,
          max_duration: Number(f.max_duration) || 25,
          cta_required: f.cta_required,
          logo_first5: f.logo_first5,
          brand_spoken: f.brand_spoken,
          product_in_frame: f.product_in_frame,
          style: f.style,
        },
      };
      const res = await authFetch(brief ? `/api/business/briefs/${brief.id}` : '/api/business/briefs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (!res.ok) throw new Error((d.errors && d.errors[0]) || t('Ошибка'));
      setF(EMPTY_BRIEF);
      setMsg(brief ? `${t('Отправлено на модерацию')} ✓` : `${t('Бриф создан')} ✓`);
      reload();
      onDone?.();
      setTimeout(() => setMsg(''), 2500);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="creator-portal__card bp-form" onSubmit={submit}>
      <div className="creator-portal__q">
        <div className="creator-portal__q-title">{t('Название брифа')} *</div>
        <input placeholder={t('Например: Запуск нового аромата')} value={f.title} onChange={(e) => set('title', e.target.value)} />
      </div>

      <div className="creator-portal__q">
        <div className="creator-portal__q-title">{t('Платформа')}</div>
        <select value={f.platform} onChange={(e) => set('platform', e.target.value)}>
          {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
        </select>
      </div>

      <div className="bp-block">
        <div className="bp-block__title">{t('Видео')}</div>
        <div className="creator-portal__q">
          <div className="creator-portal__q-title">{t('Ориентация')}</div>
          <label className="creator-portal__opt"><input type="radio" name="orientation" checked={f.orientation === 'vertical'} onChange={() => set('orientation', 'vertical')} /> {t('Вертикальное')}</label>
          <label className="creator-portal__opt"><input type="radio" name="orientation" checked={f.orientation === 'horizontal'} onChange={() => set('orientation', 'horizontal')} /> {t('Горизонтальное')}</label>
        </div>
        <div className="creator-portal__q">
          <div className="creator-portal__q-title">{t('Максимальная длительность, сек')}</div>
          <input type="number" min="5" max="180" value={f.max_duration} onChange={(e) => set('max_duration', e.target.value)} />
        </div>
        <div className="creator-portal__q">
          <div className="creator-portal__q-title">CTA</div>
          <label className="pf-check"><input type="checkbox" checked={f.cta_required} onChange={(e) => set('cta_required', e.target.checked)} /> {t('Обязательно')}</label>
        </div>
        <div className="creator-portal__q">
          <div className="creator-portal__q-title">{t('Ссылка для CTA (по желанию)')}</div>
          <input placeholder={t('https://ваш-сайт.kz/акция')} value={f.req_cta_link} onChange={(e) => set('req_cta_link', e.target.value)} />
        </div>
        <div className="creator-portal__q">
          <div className="creator-portal__q-title">{t('Логотип')}</div>
          <label className="pf-check"><input type="checkbox" checked={f.logo_first5} onChange={(e) => set('logo_first5', e.target.checked)} /> {t('Первые 5 секунд')}</label>
        </div>
        <div className="creator-portal__q">
          <div className="creator-portal__q-title">{t('Название бренда')}</div>
          <label className="pf-check"><input type="checkbox" checked={f.brand_spoken} onChange={(e) => set('brand_spoken', e.target.checked)} /> {t('Обязательно произнести')}</label>
        </div>
        <div className="creator-portal__q">
          <div className="creator-portal__q-title">{t('Продукт в кадре')}</div>
          <label className="pf-check"><input type="checkbox" checked={f.product_in_frame} onChange={(e) => set('product_in_frame', e.target.checked)} /> {t('Да')}</label>
        </div>
      </div>

      <div className="bp-block">
        <div className="bp-block__title">{t('Стиль')}</div>
        <div className="creator-portal__q">
          {STYLES.map(([val, label]) => (
            <label key={val} className="creator-portal__opt">
              <input type="radio" name="style" checked={f.style === val} onChange={() => set('style', val)} /> {t(label)}
            </label>
          ))}
        </div>
      </div>

      <div className="creator-portal__q">
        <div className="creator-portal__q-title">{t('Ключевое сообщение')}</div>
        <input placeholder={t('Что должен донести ролик')} value={f.key_message} onChange={(e) => set('key_message', e.target.value)} />
      </div>

      <div className="creator-portal__q">
        <div className="creator-portal__q-title">{t('Хэштег (по желанию)')}</div>
        <input placeholder={t('#бренд')} value={f.req_hashtag} onChange={(e) => set('req_hashtag', e.target.value)} />
      </div>

      <div className="creator-portal__q">
        <div className="creator-portal__q-title">{t('Что делать (по желанию)')}</div>
        <textarea rows={2} placeholder={t('Например: показать продукт крупным планом')} value={f.dos} onChange={(e) => set('dos', e.target.value)} />
      </div>

      <div className="creator-portal__q">
        <div className="creator-portal__q-title">{t('Чего не делать (по желанию)')}</div>
        <textarea rows={2} placeholder={t('Например: не упоминать конкурентов')} value={f.donts} onChange={(e) => set('donts', e.target.value)} />
      </div>

      {error && <p className="creator-portal__err">{error}</p>}
      <button className="btn btn--primary btn--block" disabled={busy}>
        {busy ? t('Отправляю…') : brief ? t('Отправить на модерацию') : t('Создать бриф')}
      </button>
      {msg && <p className="creator-portal__muted" style={{ textAlign: 'center', color: '#15803d' }}>{msg}</p>}
    </form>
  );
}
