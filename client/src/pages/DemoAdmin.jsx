import { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { API_BASE } from '../lib/config.js';

const DEMO_BUSINESS_EMAIL = 'business@demo.kz';
const DEMO_CREATOR_LOGIN = 'aruzhan';
const DEMO_PASS = 'demo1234';
const BUSINESS_TOKEN_KEY = 'clicki_demo_business_token';
const CREATOR_TOKEN_KEY = 'clicki_demo_creator_token';

const NAV = [
  { key: 'admin', label: 'Админ (урезанный)', icon: 'grid' },
  { key: 'business', label: 'Тест-кабинет бизнеса', icon: 'briefs' },
  { key: 'creator', label: 'Тест-кабинет креатора', icon: 'users' },
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

async function fetchJson(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, options);
  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  if (!res.ok || data.ok === false) {
    throw new Error(data.errors?.[0] || 'Не удалось выполнить запрос');
  }
  return data;
}

export default function DemoAdmin() {
  const [view, setView] = useState('admin');
  const [navOpen, setNavOpen] = useState(false);

  const current = useMemo(() => NAV.find((n) => n.key === view), [view]);

  return (
    <main className="admin page-light app-light ae-skip">
      <Helmet>
        <title>CLICKI - демо админка</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <header className="admin-topbar">
        <button className="admin-topbar__burger" onClick={() => setNavOpen(true)} aria-label="Открыть меню" aria-expanded={navOpen}>
          <span />
          <span />
          <span />
        </button>
        <span className="admin-topbar__title">{current?.label || 'CLICKI демо'}</span>
        <Link to="/" className="btn btn--ghost btn--sm">На сайт</Link>
      </header>

      <div className="admin-layout">
        {navOpen && <div className="admin-backdrop" onClick={() => setNavOpen(false)} />}
        <aside className={`admin-sidebar ${navOpen ? 'is-open' : ''}`}>
          <div className="admin-sidebar__head">
            <div className="admin-sidebar__brand">CLICKI · инвест-демо</div>
            <button className="admin-sidebar__close" onClick={() => setNavOpen(false)} aria-label="Закрыть меню">x</button>
          </div>
          <nav className="admin-nav">
            {NAV.map((n) => (
              <button
                key={n.key}
                className={`admin-nav__btn ${view === n.key ? 'is-active' : ''}`}
                onClick={() => {
                  setView(n.key);
                  setNavOpen(false);
                }}
              >
                <span className="admin-nav__icon" aria-hidden="true"><Icon name={n.icon} /></span>
                {n.label}
              </button>
            ))}
          </nav>
        </aside>

        <div className="admin-main">
          <div className="demo-banner">
            <span className="demo-pill">Реальные данные</span>
            <span>Это инвесторский режим: разделы урезаны, но аналитика и действия идут через живой API.</span>
          </div>

          {view === 'admin' && <AdminMiniSection />}
          {view === 'business' && <BusinessMiniSection />}
          {view === 'creator' && <CreatorMiniSection />}
        </div>
      </div>
    </main>
  );
}

function AdminMiniSection() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const byDay = data?.analytics?.byDay || [];
  const maxVisits = Math.max(...byDay.map((d) => d.visits), 1);

  async function load() {
    setLoading(true);
    setError('');
    try {
      setData(await fetchJson('/api/demo/analytics'));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <section className="admin-block">
      <div className="admin-panel__head">
        <h2 className="admin-block__title">Админ-раздел (урезанный)</h2>
        <button className="btn btn--ghost btn--sm" onClick={load} disabled={loading}>{loading ? 'Обновляю…' : 'Обновить'}</button>
      </div>
      <p className="muted-note" style={{ textAlign: 'left' }}>
        В этом разделе показывается реальная веб-аналитика сайта и агрегаты по платформе.
      </p>
      {error && <p className="lead-form__errors" role="alert">{error}</p>}
      {!data ? (
        <p className="muted-note">{loading ? 'Загрузка…' : 'Нет данных'}</p>
      ) : (
        <>
          <div className="kpi-grid">
            <Kpi tone="violet" icon="chart" value={(data.analytics?.totals?.visits || 0).toLocaleString('ru-RU')} label="Визиты (всего)" />
            <Kpi tone="green" icon="users" value={(data.analytics?.totals?.uniques || 0).toLocaleString('ru-RU')} label="Уникальные" />
            <Kpi tone="rose" icon="briefs" value={data.platform?.briefs || 0} label="Брифы" />
            <Kpi tone="amber" icon="check" value={data.platform?.submissions || 0} label="Отправки видео" />
          </div>

          <h3 className="admin-block__title admin-subhead">Посещаемость за 14 дней</h3>
          <div className="an-days">
            {byDay.map((d) => (
              <div key={d.day} className="an-day" title={`${d.day}: ${d.visits}`}>
                <span className="an-day__bar" style={{ height: `${Math.round((d.visits / maxVisits) * 100)}%` }} />
                <span className="an-day__label">{d.day.slice(5)}</span>
              </div>
            ))}
          </div>

          <div className="an-cols">
            <MiniTable
              title="Топ страниц"
              rows={(data.analytics?.byPage || []).map((r) => [r.path, Number(r.visits || 0).toLocaleString('ru-RU')])}
            />
            <MiniTable
              title="Источники"
              rows={(data.analytics?.bySource || []).map((r) => [String(r.source || 'прямой переход'), Number(r.visits || 0).toLocaleString('ru-RU')])}
            />
          </div>

          <p className="muted-note" style={{ textAlign: 'left' }}>
            Последнее обновление: {new Date(data.updatedAt).toLocaleString('ru-RU')}
          </p>
        </>
      )}
    </section>
  );
}

function BusinessMiniSection() {
  const [token, setToken] = useState(() => sessionStorage.getItem(BUSINESS_TOKEN_KEY) || '');
  const [data, setData] = useState(null);
  const [email, setEmail] = useState(DEMO_BUSINESS_EMAIL);
  const [password, setPassword] = useState(DEMO_PASS);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ title: '', platform: 'TikTok', key_message: '', slots: 3 });

  async function authFetch(path, options = {}) {
    return fetchJson(path, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    });
  }

  async function loadMe() {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      setData(await authFetch('/api/business/me'));
    } catch (err) {
      setError(err.message);
      if (/войдите|401|403/i.test(err.message)) {
        sessionStorage.removeItem(BUSINESS_TOKEN_KEY);
        setToken('');
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMe();
  }, [token]);

  async function login(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetchJson('/api/business/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      sessionStorage.setItem(BUSINESS_TOKEN_KEY, res.token);
      setToken(res.token);
      setData(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    sessionStorage.removeItem(BUSINESS_TOKEN_KEY);
    setToken('');
    setData(null);
  }

  async function createBrief(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await authFetch('/api/business/briefs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      setForm({ title: '', platform: 'TikTok', key_message: '', slots: 3 });
      await loadMe();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function acceptSubmission(id) {
    setLoading(true);
    setError('');
    try {
      await authFetch(`/api/business/submissions/${id}/accept`, { method: 'POST' });
      await loadMe();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!token || !data) {
    return (
      <section className="admin-block">
        <h2 className="admin-block__title">Тест-кабинет бизнеса</h2>
        <p className="muted-note" style={{ textAlign: 'left' }}>
          Реальный тестовый поток: вход, создание брифа, приёмка видео. Данные пишутся в БД.
        </p>
        <form className="lead-form" onSubmit={login}>
          <label className="lead-form__field">
            <span className="lead-form__label">Email</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </label>
          <label className="lead-form__field">
            <span className="lead-form__label">Пароль</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </label>
          {error && <p className="lead-form__errors" role="alert">{error}</p>}
          <button className="btn btn--primary btn--sm" disabled={loading}>{loading ? 'Вход…' : 'Войти в тест-кабинет'}</button>
        </form>
      </section>
    );
  }

  const briefs = data.briefs || [];
  const incoming = (data.submissions || []).filter((s) => s.status === 'sent_to_business');

  return (
    <section className="admin-block">
      <div className="admin-panel__head">
        <h2 className="admin-block__title">Тест-кабинет бизнеса</h2>
        <button className="btn btn--ghost btn--sm" onClick={logout}>Выйти</button>
      </div>

      {error && <p className="lead-form__errors" role="alert">{error}</p>}

      <div className="admin-stats">
        <Stat label="Брифов" value={briefs.length} />
        <Stat label="На приёмке" value={incoming.length} />
      </div>

      <h3 className="admin-block__title admin-subhead">Новый бриф</h3>
      <form className="pf-form" onSubmit={createBrief}>
        <input placeholder="Название брифа" value={form.title} onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))} required />
        <select value={form.platform} onChange={(e) => setForm((s) => ({ ...s, platform: e.target.value }))}>
          <option>TikTok</option>
          <option>Instagram Reels</option>
          <option>YouTube Shorts</option>
          <option>Threads</option>
          <option>X (Twitter)</option>
        </select>
        <input placeholder="Ключевое сообщение" value={form.key_message} onChange={(e) => setForm((s) => ({ ...s, key_message: e.target.value }))} />
        <input type="number" min="1" placeholder="Слотов" value={form.slots} onChange={(e) => setForm((s) => ({ ...s, slots: Number(e.target.value) }))} />
        <button className="btn btn--primary btn--sm" disabled={loading}>{loading ? 'Сохранение…' : 'Отправить бриф'}</button>
      </form>

      <h3 className="admin-block__title admin-subhead">Мои брифы</h3>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Название</th><th>Платформа</th><th>Статус</th></tr></thead>
          <tbody>
            {briefs.map((b) => (
              <tr key={b.id}>
                <td data-label="Название">{b.title}</td>
                <td data-label="Платформа">{b.platform}</td>
                <td data-label="Статус"><span className={`pf-status pf-status--${b.status === 'active' ? 'accepted' : b.status === 'revision' ? 'rework' : 'pending'}`}>{b.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="admin-block__title admin-subhead">Видео на приёмке</h3>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Бриф</th><th>Креатор</th><th>Видео</th><th></th></tr></thead>
          <tbody>
            {incoming.map((s) => (
              <tr key={s.id}>
                <td data-label="Бриф">{s.brief_title || s.platform}</td>
                <td data-label="Креатор">{s.creator_name || `#${s.creator_id}`}</td>
                <td data-label="Видео"><a href={s.video_url} target="_blank" rel="noreferrer">Открыть</a></td>
                <td data-label=""><button className="btn btn--ghost btn--sm" onClick={() => acceptSubmission(s.id)} disabled={loading}>Принять</button></td>
              </tr>
            ))}
            {!incoming.length && (
              <tr><td colSpan={4} className="muted-cell">Пока нет видео для приёмки</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CreatorMiniSection() {
  const [token, setToken] = useState(() => sessionStorage.getItem(CREATOR_TOKEN_KEY) || '');
  const [data, setData] = useState(null);
  const [username, setUsername] = useState(DEMO_CREATOR_LOGIN);
  const [password, setPassword] = useState(DEMO_PASS);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ brief_id: '', platform: 'TikTok', video_url: '' });

  async function authFetch(path, options = {}) {
    return fetchJson(path, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    });
  }

  async function loadMe() {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      setData(await authFetch('/api/creator/me'));
    } catch (err) {
      setError(err.message);
      if (/войдите|401|403/i.test(err.message)) {
        sessionStorage.removeItem(CREATOR_TOKEN_KEY);
        setToken('');
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMe();
  }, [token]);

  async function login(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetchJson('/api/creator/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      sessionStorage.setItem(CREATOR_TOKEN_KEY, res.token);
      setToken(res.token);
      setData(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    sessionStorage.removeItem(CREATOR_TOKEN_KEY);
    setToken('');
    setData(null);
  }

  async function submitVideo(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await authFetch('/api/creator/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brief_id: form.brief_id ? Number(form.brief_id) : undefined,
          platform: form.platform,
          video_url: form.video_url,
          rights_confirmed: true,
        }),
      });
      setForm((s) => ({ ...s, video_url: '' }));
      await loadMe();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!token || !data) {
    return (
      <section className="admin-block">
        <h2 className="admin-block__title">Тест-кабинет креатора</h2>
        <p className="muted-note" style={{ textAlign: 'left' }}>
          Реальный поток креатора: вход, выбор брифа, отправка видео.
        </p>
        <form className="lead-form" onSubmit={login}>
          <label className="lead-form__field">
            <span className="lead-form__label">Логин</span>
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
          </label>
          <label className="lead-form__field">
            <span className="lead-form__label">Пароль</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </label>
          {error && <p className="lead-form__errors" role="alert">{error}</p>}
          <button className="btn btn--primary btn--sm" disabled={loading}>{loading ? 'Вход…' : 'Войти в тест-кабинет'}</button>
        </form>
      </section>
    );
  }

  const openBriefs = data.openBriefs || data.available || [];
  const submissions = data.submissions || [];

  return (
    <section className="admin-block">
      <div className="admin-panel__head">
        <h2 className="admin-block__title">Тест-кабинет креатора</h2>
        <button className="btn btn--ghost btn--sm" onClick={logout}>Выйти</button>
      </div>

      {error && <p className="lead-form__errors" role="alert">{error}</p>}

      <div className="admin-stats">
        <Stat label="Открытые брифы" value={openBriefs.length} />
        <Stat label="Мои отправки" value={submissions.length} />
      </div>

      <h3 className="admin-block__title admin-subhead">Отправить видео</h3>
      <form className="pf-form" onSubmit={submitVideo}>
        <select value={form.brief_id} onChange={(e) => setForm((s) => ({ ...s, brief_id: e.target.value }))}>
          <option value="">Без привязки к брифу</option>
          {openBriefs.map((b) => (
            <option key={b.id} value={b.id}>{b.title || `Бриф #${b.id}`}</option>
          ))}
        </select>
        <select value={form.platform} onChange={(e) => setForm((s) => ({ ...s, platform: e.target.value }))}>
          <option>TikTok</option>
          <option>Instagram Reels</option>
          <option>YouTube Shorts</option>
          <option>Threads</option>
          <option>X (Twitter)</option>
        </select>
        <input placeholder="Ссылка на видео" value={form.video_url} onChange={(e) => setForm((s) => ({ ...s, video_url: e.target.value }))} required />
        <button className="btn btn--primary btn--sm" disabled={loading}>{loading ? 'Отправка…' : 'Отправить видео'}</button>
      </form>

      <h3 className="admin-block__title admin-subhead">Мои видео</h3>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Бриф</th><th>Площадка</th><th>Статус</th><th>Просмотры</th></tr></thead>
          <tbody>
            {submissions.map((s) => (
              <tr key={s.id}>
                <td data-label="Бриф">{s.brief_title || `#${s.brief_id || '-'}`}</td>
                <td data-label="Площадка">{s.platform}</td>
                <td data-label="Статус"><span className={`pf-status pf-status--${s.status}`}>{SUB_STATUS[s.status] || s.status}</span></td>
                <td data-label="Просмотры">{Number(s.views || 0).toLocaleString('ru-RU')}</td>
              </tr>
            ))}
            {!submissions.length && (
              <tr><td colSpan={4} className="muted-cell">Пока нет отправленных видео</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MiniTable({ title, rows }) {
  return (
    <div>
      <h3 className="admin-block__title admin-subhead">{title}</h3>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <tbody>
            {rows.map(([name, value]) => (
              <tr key={`${name}-${value}`}>
                <td data-label={title}>{name}</td>
                <td className="muted-cell" data-label="Значение">{value}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td className="muted-cell">Нет данных</td><td /></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="admin-stat">
      <div className="admin-stat__value">{value}</div>
      <div className="admin-stat__label">{label}</div>
    </div>
  );
}

function Kpi({ tone = 'violet', icon, value, label }) {
  return (
    <div className={`kpi kpi--${tone}`}>
      <span className="kpi__icon"><Icon name={icon} /></span>
      <div className="kpi__value">{value}</div>
      <div className="kpi__label">{label}</div>
    </div>
  );
}
