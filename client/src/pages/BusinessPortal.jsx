import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Seo from '../components/Seo.jsx';
import Icon from '../components/Icon.jsx';
import { API_BASE } from '../lib/config.js';

const KEY = 'clicki_business_token';
const PLATFORMS = ['TikTok', 'Instagram Reels', 'YouTube Shorts', 'Threads', 'X (Twitter)'];
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
  const [token, setToken] = useState(() => localStorage.getItem(KEY) || '');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const authFetch = useCallback(
    (url, opts = {}) =>
      fetch(`${API_BASE}${url}`, { ...opts, headers: { ...(opts.headers || {}), Authorization: `Bearer ${token}` } }),
    [token]
  );

  const loadMe = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/business/me');
      if (!res.ok) throw new Error('unauth');
      setData(await res.json());
    } catch {
      localStorage.removeItem(KEY);
      setToken('');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (token && !data) loadMe();
  }, [token, data, loadMe]);

  const onAuthed = (tok, payload) => {
    localStorage.setItem(KEY, tok);
    setToken(tok);
    setData(payload);
  };
  const logout = () => {
    localStorage.removeItem(KEY);
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
  const [mode, setMode] = useState('login');
  return (
    <main className="creator-portal page-light app-light ae-skip">
      <Seo title="CLICKI — кабинет бизнеса" path="/business-cabinet" description="Личный кабинет бренда CLICKI." noindex />
      <div className="container creator-portal__inner">
        <div className="creator-portal__head">
          <Link to="/" className="creator-portal__brand">CLICKI</Link>
          <span className="creator-portal__tag">кабинет бизнеса</span>
        </div>
        <h1 className="creator-portal__title">Кабинет бизнеса</h1>
        <p className="creator-portal__muted">
          {mode === 'login' ? 'Войдите, чтобы создавать брифы и принимать работы.' : 'Создайте аккаунт бренда за минуту.'}
        </p>
        <div className="creator-portal__tabs">
          <button className={`creator-portal__tab ${mode === 'login' ? 'is-active' : ''}`} onClick={() => setMode('login')}>Вход</button>
          <button className={`creator-portal__tab ${mode === 'register' ? 'is-active' : ''}`} onClick={() => setMode('register')}>Регистрация</button>
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

function AuthForm({ endpoint, onAuthed, register, toRegister }) {
  const [f, setF] = useState({ name: '', company: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(f),
      });
      const d = await res.json();
      if (!res.ok) throw new Error((d.errors && d.errors[0]) || 'Ошибка');
      onAuthed(d.token, d);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="creator-portal__card" onSubmit={submit}>
      {register && (
        <>
          <input placeholder="Имя" autoComplete="name" value={f.name} onChange={(e) => set('name', e.target.value)} required />
          <input placeholder="Компания / бренд" value={f.company} onChange={(e) => set('company', e.target.value)} />
        </>
      )}
      <input type="email" placeholder="Email" autoComplete="email" value={f.email} onChange={(e) => set('email', e.target.value)} required />
      <input type="password" placeholder="Пароль" autoComplete={register ? 'new-password' : 'current-password'} value={f.password} onChange={(e) => set('password', e.target.value)} required />
      {error && <p className="creator-portal__err">{error}</p>}
      <button className="btn btn--primary btn--block" disabled={busy}>{busy ? '…' : register ? 'Создать аккаунт' : 'Войти'}</button>
      <p className="creator-portal__muted creator-portal__switch">
        {register ? 'Уже есть аккаунт? ' : 'Нет аккаунта? '}
        <button type="button" className="creator-portal__link" onClick={toRegister}>{register ? 'Войти' : 'Создать'}</button>
      </p>
    </form>
  );
}

/* ---------------- Dashboard shell ---------------- */
const NAV = [
  { key: 'home', label: 'Главная', icon: 'home' },
  { key: 'briefs', label: 'Брифы', icon: 'briefs' },
  { key: 'review', label: 'Приёмка', icon: 'check' },
  { key: 'analytics', label: 'Аналитика', icon: 'chart' },
  { key: 'profile', label: 'Профиль', icon: 'user' },
];

function Dashboard({ data, authFetch, reload, onLogout }) {
  const [view, setView] = useState('home');
  const [navOpen, setNavOpen] = useState(false);
  const b = data.business;
  const briefs = data.briefs || [];
  const submissions = data.submissions || [];
  const incoming = submissions.filter((s) => s.status === 'sent_to_business');
  const accepted = submissions.filter((s) => s.status === 'accepted');

  const go = (key) => {
    setView(key);
    setNavOpen(false);
  };

  return (
    <main className="admin page-light app-light ae-skip">
      <Seo title="CLICKI — кабинет бизнеса" path="/business-cabinet" description="Личный кабинет бренда CLICKI." noindex />
      <header className="admin-topbar">
        <button className="admin-topbar__burger" onClick={() => setNavOpen(true)} aria-label="Меню" aria-expanded={navOpen}>
          <span /><span /><span />
        </button>
        <span className="admin-topbar__title">{NAV.find((n) => n.key === view)?.label}</span>
        <button className="btn btn--ghost btn--sm" onClick={onLogout}>Выйти</button>
      </header>

      <div className="admin-layout">
        {navOpen && <div className="admin-backdrop" onClick={() => setNavOpen(false)} />}
        <aside className={`admin-sidebar ${navOpen ? 'is-open' : ''}`}>
          <div className="admin-sidebar__head">
            <div className="admin-sidebar__brand">CLICKI · бизнес</div>
            <button className="admin-sidebar__close" onClick={() => setNavOpen(false)} aria-label="Закрыть">✕</button>
          </div>
          <nav className="admin-nav">
            {NAV.map((n) => (
              <button key={n.key} className={`admin-nav__btn ${view === n.key ? 'is-active' : ''}`} onClick={() => go(n.key)}>
                <span className="admin-nav__icon" aria-hidden="true"><Icon name={n.icon} /></span>
                {n.label}
              </button>
            ))}
          </nav>
          <button className="btn btn--ghost btn--sm admin-sidebar__logout" onClick={onLogout}>Выйти</button>
        </aside>

        <div className="admin-main">
          {view === 'home' && (
            <Home b={b} briefs={briefs} submissions={submissions} incoming={incoming} accepted={accepted} go={go} />
          )}
          {view === 'briefs' && <BriefsView briefs={briefs} authFetch={authFetch} reload={reload} />}
          {view === 'review' && <ReviewView incoming={incoming} accepted={accepted} authFetch={authFetch} reload={reload} />}
          {view === 'analytics' && <Analytics accepted={accepted} />}
          {view === 'profile' && <Profile b={b} onLogout={onLogout} />}
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
function Home({ b, briefs, submissions, incoming, accepted, go }) {
  const activeBriefs = briefs.filter((x) => x.status === 'active').length;
  const recent = submissions.slice(0, 6);
  return (
    <section className="admin-block">
      <h2 className="admin-block__title">Привет, {b.name}</h2>
      <p className="muted-note" style={{ textAlign: 'left', marginTop: 0 }}>
        {b.company || 'Бренд'} — запускайте брифы и принимайте готовые работы.
      </p>

      <div className="admin-stats">
        <Stat label="Активные брифы" value={activeBriefs} hint={`всего ${briefs.length}`} />
        <Stat label="На приёмке" value={incoming.length} />
        <Stat label="Принято работ" value={accepted.length} />
        <Stat label="Суммарный охват" value={sumViews(accepted).toLocaleString('ru-RU')} hint="просмотров" />
      </div>

      <h3 className="admin-block__title admin-subhead">Быстрый доступ</h3>
      <div className="bp-quick">
        <button className="bp-quick__tile" onClick={() => go('briefs')}>
          <span className="bp-quick__icon" aria-hidden="true"><Icon name="briefs" /></span>
          <span><b>Создать бриф</b><span className="bp-quick__sub">структурированное ТЗ</span></span>
        </button>
        <button className="bp-quick__tile" onClick={() => go('review')}>
          <span className="bp-quick__icon" aria-hidden="true"><Icon name="check" /></span>
          <span><b>Приёмка</b><span className="bp-quick__sub">{incoming.length} на проверке</span></span>
        </button>
        <button className="bp-quick__tile" onClick={() => go('analytics')}>
          <span className="bp-quick__icon" aria-hidden="true"><Icon name="chart" /></span>
          <span><b>Аналитика</b><span className="bp-quick__sub">охваты и площадки</span></span>
        </button>
      </div>

      <h3 className="admin-block__title admin-subhead">Последние работы</h3>
      {recent.length ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Бриф</th><th>Креатор</th><th>Статус</th><th>Просмотры</th></tr></thead>
            <tbody>
              {recent.map((s) => (
                <tr key={s.id}>
                  <td data-label="Бриф">{s.brief_title || s.platform}</td>
                  <td className="muted-cell" data-label="Креатор">{s.creator_name || `#${s.creator_id}`}</td>
                  <td data-label="Статус"><span className={`pf-status pf-status--${s.status}`}>{SUB_STATUS[s.status] || s.status}</span></td>
                  <td className="muted-cell" data-label="Просмотры">{(s.views || 0).toLocaleString('ru-RU')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted-note" style={{ textAlign: 'left' }}>Работ пока нет — создайте бриф, и они появятся здесь.</p>
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
  const [editing, setEditing] = useState(null);
  return (
    <>
      <section className="admin-block">
        <h2 className="admin-block__title">{editing ? 'Редактировать бриф' : 'Создать бриф'}</h2>
        {editing && (
          <p className="muted-note" style={{ textAlign: 'left', marginTop: 0 }}>
            После сохранения бриф снова уйдёт к нам на модерацию.{' '}
            <button className="creator-portal__link" onClick={() => setEditing(null)}>Отмена</button>
          </p>
        )}
        <BriefForm key={editing?.id || 'new'} authFetch={authFetch} reload={reload} brief={editing} onDone={() => setEditing(null)} />
      </section>

      <section className="admin-block">
        <h2 className="admin-block__title">Мои брифы ({briefs.length})</h2>
        {briefs.length ? (
          <div className="bp-cards">
            {briefs.map((br) => {
              const [label, cls] = BRIEF_STATUS[br.status] || [br.status, 'pending'];
              return (
                <div key={br.id} className="bp-card">
                  <div className="bp-card__head">
                    <b>{br.title}</b>
                    <span className={`pf-status pf-status--${cls}`}>{label}</span>
                  </div>
                  <p className="creator-portal__muted" style={{ margin: 0 }}>
                    {br.platform} · {br.spec?.orientation === 'horizontal' ? 'горизонтальное' : 'вертикальное'} · до {br.duration_max}с
                    {br.spec?.style ? ` · ${STYLES.find((s) => s[0] === br.spec.style)?.[1] || br.spec.style}` : ''}
                  </p>
                  {br.status === 'revision' && (
                    <>
                      {br.revision_note && <div className="mod-note" style={{ marginTop: 10 }}>На доработку: {br.revision_note}</div>}
                      <button className="btn btn--primary btn--sm" style={{ marginTop: 10 }} onClick={() => setEditing(br)}>
                        Исправить и отправить снова
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="muted-note" style={{ textAlign: 'left' }}>Брифов пока нет — создайте первый выше.</p>
        )}
      </section>
    </>
  );
}

/* ---------------- Acceptance ---------------- */
function ReviewView({ incoming, accepted, authFetch, reload }) {
  const accept = async (id) => {
    await authFetch(`/api/business/submissions/${id}/accept`, { method: 'POST' });
    reload();
  };
  return (
    <>
      <section className="admin-block">
        <h2 className="admin-block__title">На приёмку ({incoming.length})</h2>
        {incoming.length ? (
          <div className="bp-cards">
            {incoming.map((s) => (
              <div key={s.id} className="bp-card">
                <div className="bp-card__head">
                  <b>{s.brief_title || s.platform}</b>
                  <span className="pf-status pf-status--sent_to_business">готово к приёмке</span>
                </div>
                <p className="creator-portal__muted" style={{ margin: '0 0 12px' }}>
                  Креатор: {s.creator_name || `#${s.creator_id}`} · {s.platform}
                  {s.ai_score != null ? ` · AI ${s.ai_score}/100` : ''}
                </p>
                <div className="creator-portal__row-actions">
                  <a className="btn btn--ghost btn--sm" href={s.video_url} target="_blank" rel="noreferrer">Смотреть видео</a>
                  <button className="btn btn--primary btn--sm" onClick={() => accept(s.id)}>Принять работу</button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted-note" style={{ textAlign: 'left' }}>Работ на приёмке пока нет.</p>
        )}
      </section>

      <section className="admin-block">
        <h2 className="admin-block__title">Принятые ({accepted.length})</h2>
        {accepted.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Бриф</th><th>Креатор</th><th>Видео</th><th>Просмотры</th></tr></thead>
              <tbody>
                {accepted.map((s) => (
                  <tr key={s.id}>
                    <td data-label="Бриф">{s.brief_title || s.platform}</td>
                    <td className="muted-cell" data-label="Креатор">{s.creator_name || `#${s.creator_id}`}</td>
                    <td data-label="Видео"><a href={s.video_url} target="_blank" rel="noreferrer">ссылка</a></td>
                    <td className="muted-cell" data-label="Просмотры">{(s.views || 0).toLocaleString('ru-RU')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted-note" style={{ textAlign: 'left' }}>Принятых работ пока нет.</p>
        )}
      </section>
    </>
  );
}

/* ---------------- Analytics ---------------- */
function Analytics({ accepted }) {
  const total = sumViews(accepted);
  const byPlatform = {};
  for (const s of accepted) byPlatform[s.platform] = (byPlatform[s.platform] || 0) + (s.views || 0);
  const rows = Object.entries(byPlatform).sort((a, b) => b[1] - a[1]);
  const top = [...accepted].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 5);

  return (
    <section className="admin-block">
      <h2 className="admin-block__title">Аналитика</h2>
      <div className="admin-stats">
        <Stat label="Принято работ" value={accepted.length} />
        <Stat label="Суммарный охват" value={total.toLocaleString('ru-RU')} hint="просмотров" />
        <Stat label="Площадок" value={rows.length} />
      </div>

      <h3 className="admin-block__title admin-subhead">Просмотры по платформам</h3>
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
        <p className="muted-note" style={{ textAlign: 'left' }}>Данных пока нет — появятся после принятых работ.</p>
      )}

      <h3 className="admin-block__title admin-subhead">Топ видео</h3>
      {top.length ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Бриф</th><th>Платформа</th><th>Просмотры</th></tr></thead>
            <tbody>
              {top.map((s) => (
                <tr key={s.id}>
                  <td data-label="Бриф"><a href={s.video_url} target="_blank" rel="noreferrer">{s.brief_title || 'видео'}</a></td>
                  <td className="muted-cell" data-label="Платформа">{s.platform}</td>
                  <td className="muted-cell" data-label="Просмотры">{(s.views || 0).toLocaleString('ru-RU')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted-note" style={{ textAlign: 'left' }}>Пока нет данных.</p>
      )}
    </section>
  );
}

/* ---------------- Profile ---------------- */
function Profile({ b, onLogout }) {
  return (
    <section className="admin-block">
      <h2 className="admin-block__title">Профиль</h2>
      <div className="bp-card" style={{ maxWidth: 460 }}>
        <div className="bp-profile__row"><span className="bp-profile__k">Имя</span><span>{b.name}</span></div>
        <div className="bp-profile__row"><span className="bp-profile__k">Компания</span><span>{b.company || '—'}</span></div>
        <div className="bp-profile__row"><span className="bp-profile__k">Email</span><span>{b.email}</span></div>
        <button className="btn btn--ghost btn--sm" style={{ marginTop: 14 }} onClick={onLogout}>Выйти</button>
      </div>
    </section>
  );
}

/* ---------------- Brief builder (structured) ---------------- */
const EMPTY_BRIEF = {
  title: '',
  platform: 'TikTok',
  key_message: '',
  req_hashtag: '',
  orientation: 'vertical',
  max_duration: 25,
  cta_required: true,
  logo_first5: true,
  brand_spoken: false,
  product_in_frame: true,
  style: 'youth',
};

function BriefForm({ authFetch, reload, brief = null, onDone }) {
  const initial = brief
    ? {
        title: brief.title || '',
        platform: brief.platform || 'TikTok',
        key_message: brief.key_message || '',
        req_hashtag: brief.req_hashtag || '',
        orientation: brief.spec?.orientation || 'vertical',
        max_duration: brief.spec?.max_duration || brief.duration_max || 25,
        cta_required: brief.spec?.cta_required ?? true,
        logo_first5: brief.spec?.logo_first5 ?? true,
        brand_spoken: brief.spec?.brand_spoken ?? false,
        product_in_frame: brief.spec?.product_in_frame ?? true,
        style: brief.spec?.style || 'youth',
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
    if (!f.title.trim()) return setError('Укажите название брифа');
    setBusy(true);
    try {
      const payload = {
        title: f.title,
        platform: f.platform,
        key_message: f.key_message,
        req_hashtag: f.req_hashtag,
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
      if (!res.ok) throw new Error((d.errors && d.errors[0]) || 'Ошибка');
      setF(EMPTY_BRIEF);
      setMsg(brief ? 'Отправлено на модерацию ✓' : 'Бриф создан ✓');
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
        <div className="creator-portal__q-title">Название брифа *</div>
        <input placeholder="Например: Запуск нового аромата" value={f.title} onChange={(e) => set('title', e.target.value)} />
      </div>

      <div className="creator-portal__q">
        <div className="creator-portal__q-title">Платформа</div>
        <select value={f.platform} onChange={(e) => set('platform', e.target.value)}>
          {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
        </select>
      </div>

      <div className="bp-block">
        <div className="bp-block__title">Видео</div>
        <div className="creator-portal__q">
          <div className="creator-portal__q-title">Ориентация</div>
          <label className="creator-portal__opt"><input type="radio" name="orientation" checked={f.orientation === 'vertical'} onChange={() => set('orientation', 'vertical')} /> Вертикальное</label>
          <label className="creator-portal__opt"><input type="radio" name="orientation" checked={f.orientation === 'horizontal'} onChange={() => set('orientation', 'horizontal')} /> Горизонтальное</label>
        </div>
        <div className="creator-portal__q">
          <div className="creator-portal__q-title">Максимальная длительность, сек</div>
          <input type="number" min="5" max="180" value={f.max_duration} onChange={(e) => set('max_duration', e.target.value)} />
        </div>
        <div className="creator-portal__q">
          <div className="creator-portal__q-title">CTA</div>
          <label className="pf-check"><input type="checkbox" checked={f.cta_required} onChange={(e) => set('cta_required', e.target.checked)} /> Обязательно</label>
        </div>
        <div className="creator-portal__q">
          <div className="creator-portal__q-title">Логотип</div>
          <label className="pf-check"><input type="checkbox" checked={f.logo_first5} onChange={(e) => set('logo_first5', e.target.checked)} /> Первые 5 секунд</label>
        </div>
        <div className="creator-portal__q">
          <div className="creator-portal__q-title">Название бренда</div>
          <label className="pf-check"><input type="checkbox" checked={f.brand_spoken} onChange={(e) => set('brand_spoken', e.target.checked)} /> Обязательно произнести</label>
        </div>
        <div className="creator-portal__q">
          <div className="creator-portal__q-title">Продукт в кадре</div>
          <label className="pf-check"><input type="checkbox" checked={f.product_in_frame} onChange={(e) => set('product_in_frame', e.target.checked)} /> Да</label>
        </div>
      </div>

      <div className="bp-block">
        <div className="bp-block__title">Стиль</div>
        <div className="creator-portal__q">
          {STYLES.map(([val, label]) => (
            <label key={val} className="creator-portal__opt">
              <input type="radio" name="style" checked={f.style === val} onChange={() => set('style', val)} /> {label}
            </label>
          ))}
        </div>
      </div>

      <div className="creator-portal__q">
        <div className="creator-portal__q-title">Ключевое сообщение</div>
        <input placeholder="Что должен донести ролик" value={f.key_message} onChange={(e) => set('key_message', e.target.value)} />
      </div>

      <div className="creator-portal__q">
        <div className="creator-portal__q-title">Хэштег (по желанию)</div>
        <input placeholder="#бренд" value={f.req_hashtag} onChange={(e) => set('req_hashtag', e.target.value)} />
      </div>

      {error && <p className="creator-portal__err">{error}</p>}
      <button className="btn btn--primary btn--block" disabled={busy}>
        {busy ? 'Отправляю…' : brief ? 'Отправить на модерацию' : 'Создать бриф'}
      </button>
      {msg && <p className="creator-portal__muted" style={{ textAlign: 'center', color: '#15803d' }}>{msg}</p>}
    </form>
  );
}
