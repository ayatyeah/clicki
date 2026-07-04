import { useEffect, useState, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { API_BASE } from '../lib/config.js';
import Icon from '../components/Icon.jsx';
import { AiAnalysisView, AutopilotView, BriefsView, ReviewView, CreatorsView, PayoutsView, DecisionJournalView, BriefViewsView, MonthlyReportView } from './AdminPlatform.jsx';

const TOKEN_KEY = 'clicki_admin_token';
const EMPTY = { showcase: [], devices: { iphone: { image: '' }, laptop: { image: '' } }, creatorVideo: '', hubVideo: '' };

export default function Admin() {
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY) || '');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [leads, setLeads] = useState([]);
  const [content, setContent] = useState(EMPTY);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null); // null = idle, 0–100 = uploading
  const [view, setView] = useState('dashboard');
  const [navOpen, setNavOpen] = useState(false); // mobile drawer

  const authFetch = useCallback(
    (url, opts = {}) => fetch(`${API_BASE}${url}`, { ...opts, headers: { ...(opts.headers || {}), Authorization: `Bearer ${token}` } }),
    [token]
  );

  const loadLeads = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await authFetch('/api/admin/leads');
      const data = await res.json();
      if (!res.ok) throw new Error((data.errors && data.errors[0]) || 'Ошибка');
      setLeads(data.leads || []);
    } catch (e) {
      sessionStorage.removeItem(TOKEN_KEY);
      setToken('');
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  const loadContent = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/content`);
      const data = await res.json();
      setContent({ showcase: data.showcase || [], devices: { iphone: { image: data?.devices?.iphone?.image || '' }, laptop: { image: data?.devices?.laptop?.image || '' } }, creatorVideo: data?.creatorVideo || '', hubVideo: data?.hubVideo || '' });
    } catch {
      /* keep empty */
    }
  }, []);

  useEffect(() => {
    if (token) {
      loadLeads();
      loadContent();
    }
  }, [token, loadLeads, loadContent]);

  async function onLogin(e) {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error((data.errors && data.errors[0]) || 'Ошибка входа');
      sessionStorage.setItem(TOKEN_KEY, data.token);
      setToken(data.token);
    } catch (e) {
      setError(e.message);
    }
  }

  function logout() {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken('');
    setLeads([]);
  }

  // XHR (not fetch) so we can report real upload progress for large videos.
  function uploadFile(file) {
    setProgress(0);
    return new Promise((resolve, reject) => {
      const fd = new FormData();
      fd.append('file', file);
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE}/api/admin/upload`);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        setProgress(null);
        let data = {};
        try {
          data = JSON.parse(xhr.responseText);
        } catch {
          /* non-JSON response */
        }
        if (xhr.status >= 200 && xhr.status < 300) resolve(data.url);
        else reject(new Error((data.errors && data.errors[0]) || 'Ошибка загрузки'));
      };
      xhr.onerror = () => {
        setProgress(null);
        reject(new Error('Ошибка сети при загрузке'));
      };
      xhr.send(fd);
    });
  }

  async function addShowcase(file) {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const url = await uploadFile(file);
      const type = file.type.startsWith('image') ? 'image' : 'video';
      setContent((c) => ({ ...c, showcase: [...c.showcase, { type, src: url }] }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function removeShowcase(i) {
    setContent((c) => ({ ...c, showcase: c.showcase.filter((_, idx) => idx !== i) }));
  }
  function moveShowcase(i, dir) {
    setContent((c) => {
      const arr = [...c.showcase];
      const j = i + dir;
      if (j < 0 || j >= arr.length) return c;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return { ...c, showcase: arr };
    });
  }

  async function setDevice(which, file) {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const url = await uploadFile(file);
      setContent((c) => ({ ...c, devices: { ...c.devices, [which]: { image: url } } }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function setCreatorVideo(file) {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const url = await uploadFile(file);
      setContent((c) => ({ ...c, creatorVideo: url }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function setHubVideo(file) {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const url = await uploadFile(file);
      setContent((c) => ({ ...c, hubVideo: url }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveContent() {
    setBusy(true);
    setError('');
    setMsg('');
    try {
      const res = await authFetch('/api/admin/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(content),
      });
      const data = await res.json();
      if (!res.ok) throw new Error((data.errors && data.errors[0]) || 'Ошибка сохранения');
      setMsg('Сохранено ✓');
      setTimeout(() => setMsg(''), 2500);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <main className="admin page-light app-light ae-skip">
        <Helmet>
          <title>CLICKI - админка</title>
          <meta name="robots" content="noindex, nofollow" />
        </Helmet>
        <form className="admin-login lead-form" onSubmit={onLogin}>
          <h1 className="admin-login__title">Вход в админку</h1>
          <label className="lead-form__field">
            <span className="lead-form__label">Логин</span>
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus />
          </label>
          <label className="lead-form__field">
            <span className="lead-form__label">Пароль</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </label>
          {error && <p className="lead-form__errors" role="alert">{error}</p>}
          <button type="submit" className="btn btn--primary btn--block">Войти</button>
          <Link to="/" className="admin-login__back">← На сайт</Link>
        </form>
      </main>
    );
  }

  const businessLeads = leads.filter((l) => l.funnel === 'client');
  const creatorLeads = leads.filter((l) => l.funnel === 'creator');
  const NAV = [
    { key: 'dashboard', label: 'Дашборд', icon: 'grid' },
    { key: 'ai', label: 'ИИ Аналитика', icon: 'sparkle' },
    { key: 'autopilot', label: 'Автопилот кампаний', icon: 'sparkle' },
    { key: 'analytics', label: 'Аналитика', icon: 'chart' },
    { key: 'referrals', label: 'Рефералы', icon: 'link' },
    { key: 'leads-business', label: 'Заявки Бизнеса', icon: 'inbox' },
    { key: 'leads-creators', label: 'Заявки Креаторов', icon: 'users' },
    { key: 'briefs', label: 'Брифы', icon: 'briefs' },
    { key: 'brief-views', label: 'Просмотры по брифам', icon: 'eye' },
    { key: 'monthly-report', label: 'Отчёт за месяц', icon: 'chart' },
    { key: 'review', label: 'Проверка видео', icon: 'check' },
    { key: 'decisions', label: 'Дневник решений', icon: 'briefs' },
    { key: 'creators', label: 'Креаторы', icon: 'user' },
    { key: 'payouts', label: 'Выплаты', icon: 'wallet' },
    { key: 'videos', label: 'Загрузка видео', icon: 'video' },
    { key: 'hub-video', label: 'Видео на главной', icon: 'home' },
    { key: 'creator-page', label: 'Видео креаторов', icon: 'film' },
    { key: 'content', label: 'Контент сайта', icon: 'image' },
  ];

  return (
    <main className="admin page-light app-light ae-skip">
      <Helmet>
        <title>CLICKI - админка</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <header className="admin-topbar">
        <button
          className="admin-topbar__burger"
          onClick={() => setNavOpen(true)}
          aria-label="Открыть меню"
          aria-expanded={navOpen}
        >
          <span />
          <span />
          <span />
        </button>
        <span className="admin-topbar__title">{NAV.find((n) => n.key === view)?.label || 'CLICKI'}</span>
        <button className="btn btn--ghost btn--sm" onClick={logout}>
          Выйти
        </button>
      </header>

      <div className="admin-layout">
        {navOpen && <div className="admin-backdrop" onClick={() => setNavOpen(false)} />}
        <aside className={`admin-sidebar ${navOpen ? 'is-open' : ''}`}>
          <div className="admin-sidebar__head">
            <div className="admin-sidebar__brand">CLICKI · админка</div>
            <button
              className="admin-sidebar__close"
              onClick={() => setNavOpen(false)}
              aria-label="Закрыть меню"
            >
              ✕
            </button>
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
          <button className="btn btn--ghost btn--sm admin-sidebar__logout" onClick={logout}>
            Выйти
          </button>
        </aside>

        <div className="admin-main">
          {error && <p className="lead-form__errors">{error}</p>}

          {progress !== null && (
            <div className="admin-upload" role="status" aria-live="polite">
              <div className="admin-upload__row">
                <span>Загрузка файла…</span>
                <span>{progress}%</span>
              </div>
              <div className="admin-upload__track">
                <div className="admin-upload__bar" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {view === 'dashboard' && (
            <section className="admin-block">
              <div className="admin-panel__head">
                <h2 className="admin-block__title">Дашборд</h2>
                <button className="btn btn--ghost btn--sm" onClick={loadLeads} disabled={loading}>
                  {loading ? 'Обновляю…' : 'Обновить'}
                </button>
              </div>
              <div className="kpi-grid">
                <Kpi tone="rose" icon="inbox" value={leads.length} label="Всего заявок" />
                <Kpi tone="violet" icon="user" value={businessLeads.length} label="Заявки бизнеса" />
                <Kpi tone="green" icon="users" value={creatorLeads.length} label="Заявки креаторов" />
                <Kpi tone="amber" icon="video" value={content.showcase.length} label="Видео в ленте" />
              </div>

              <h3 className="admin-block__title admin-subhead">Последние заявки</h3>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Воронка</th>
                      <th>Данные</th>
                      <th>Страница</th>
                      <th>Время</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.slice(0, 6).map((l, i) => (
                      <tr key={i}>
                        <td data-label="Воронка">
                          <span className={`lead-pill lead-pill--${l.funnel === 'client' ? 'biz' : 'creator'}`}>
                            {l.funnel === 'client' ? 'Бизнес' : 'Креатор'}
                          </span>
                        </td>
                        <td data-label="Данные">
                          {Object.entries(l.fields || {})
                            .slice(0, 2)
                            .map(([k, v]) => `${v}`)
                            .join(' · ') || '-'}
                        </td>
                        <td className="muted-cell" data-label="Страница">{l.page || '-'}</td>
                        <td className="muted-cell" data-label="Время">{new Date(l.createdAt).toLocaleString('ru-RU')}</td>
                      </tr>
                    ))}
                    {!leads.length && (
                      <tr>
                        <td colSpan={4} className="admin-table__empty">Заявок пока нет</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {view === 'ai' && <AiAnalysisView authFetch={authFetch} />}
          {view === 'autopilot' && <AutopilotView authFetch={authFetch} />}

          {view === 'analytics' && (
            <AnalyticsView authFetch={authFetch} leads={leads} businessLeads={businessLeads} creatorLeads={creatorLeads} />
          )}

          {view === 'referrals' && <ReferralsView authFetch={authFetch} />}

          {view === 'leads-business' && (
            <LeadsSection title="Заявки Бизнеса" leads={businessLeads} loading={loading} onReload={loadLeads} />
          )}

          {view === 'leads-creators' && (
            <LeadsSection title="Заявки Креаторов" leads={creatorLeads} loading={loading} onReload={loadLeads} />
          )}

          {view === 'videos' && (
            <section className="admin-block">
              <h2 className="admin-block__title">Загрузка видео</h2>
              <p className="muted-note" style={{ textAlign: 'left', marginTop: 0 }}>
                Видео и фото для блока «Лента нашей рекламы». Формат 9:16. Перетаскивайте порядок стрелками.
              </p>
              <div className="admin-media-grid">
                {content.showcase.map((it, i) => (
                  <div className="admin-media" key={it.src}>
                    {it.type === 'image' ? <img src={it.src} alt="" /> : <video src={it.src} muted loop playsInline />}
                    <div className="admin-media__bar">
                      <button onClick={() => moveShowcase(i, -1)} title="Влево">←</button>
                      <button onClick={() => moveShowcase(i, 1)} title="Вправо">→</button>
                      <button onClick={() => removeShowcase(i)} title="Удалить" className="admin-media__del">✕</button>
                    </div>
                  </div>
                ))}
                <label className="admin-media admin-media--add">
                  <input type="file" accept="image/*,video/*" hidden onChange={(e) => addShowcase(e.target.files?.[0])} />
                  <span>＋ Добавить</span>
                </label>
              </div>
              <div className="admin-save">
                <button className="btn btn--primary" onClick={saveContent} disabled={busy}>
                  {busy ? 'Сохраняю…' : 'Сохранить изменения'}
                </button>
                {msg && <span className="admin-save__msg">{msg}</span>}
              </div>
            </section>
          )}

          {view === 'briefs' && <BriefsView authFetch={authFetch} />}
          {view === 'brief-views' && <BriefViewsView authFetch={authFetch} />}
          {view === 'monthly-report' && <MonthlyReportView authFetch={authFetch} />}
          {view === 'review' && <ReviewView authFetch={authFetch} />}
          {view === 'decisions' && <DecisionJournalView authFetch={authFetch} />}
          {view === 'creators' && <CreatorsView authFetch={authFetch} />}
          {view === 'payouts' && <PayoutsView authFetch={authFetch} />}

          {view === 'hub-video' && (
            <section className="admin-block">
              <h2 className="admin-block__title">Видео на главной (вертикальное, 9:16)</h2>
              <p className="muted-note" style={{ textAlign: 'left', marginTop: 0 }}>
                Центральная видео-карточка на стартовом экране. Загрузи вертикальный ролик и нажми «Сохранить».
              </p>
              <div className="admin-device" style={{ marginTop: 8, maxWidth: 320 }}>
                <div className="admin-device__preview" style={{ height: 'auto', aspectRatio: '9 / 16' }}>
                  {content.hubVideo ? (
                    <video src={content.hubVideo} muted loop playsInline controls style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span className="admin-device__empty">не задано</span>
                  )}
                </div>
                <div className="admin-device__actions">
                  <label className="btn btn--ghost btn--sm">
                    Загрузить видео
                    <input type="file" accept="video/*" hidden onChange={(e) => setHubVideo(e.target.files?.[0])} />
                  </label>
                  {content.hubVideo && (
                    <button className="btn btn--ghost btn--sm" onClick={() => setContent((c) => ({ ...c, hubVideo: '' }))}>
                      Сбросить
                    </button>
                  )}
                </div>
              </div>
              <div className="admin-save">
                <button className="btn btn--primary" onClick={saveContent} disabled={busy}>
                  {busy ? 'Сохраняю…' : 'Сохранить'}
                </button>
                {msg && <span className="admin-save__msg">{msg}</span>}
              </div>
            </section>
          )}

          {view === 'creator-page' && (
            <section className="admin-block">
              <h2 className="admin-block__title">Видео на странице креаторов (16:9)</h2>
              <p className="muted-note" style={{ textAlign: 'left', marginTop: 0 }}>
                Широкоформатное видео в hero страницы /creators. Загрузи и нажми «Сохранить».
              </p>
              <div className="admin-device" style={{ marginTop: 8, maxWidth: 640 }}>
                <div className="admin-device__preview" style={{ height: 'auto', aspectRatio: '16 / 9' }}>
                  {content.creatorVideo ? (
                    <video src={content.creatorVideo} muted loop playsInline controls style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  ) : (
                    <span className="admin-device__empty">не задано</span>
                  )}
                </div>
                <div className="admin-device__actions">
                  <label className="btn btn--ghost btn--sm">
                    Загрузить видео
                    <input type="file" accept="video/*" hidden onChange={(e) => setCreatorVideo(e.target.files?.[0])} />
                  </label>
                  {content.creatorVideo && (
                    <button className="btn btn--ghost btn--sm" onClick={() => setContent((c) => ({ ...c, creatorVideo: '' }))}>
                      Сбросить
                    </button>
                  )}
                </div>
              </div>
              <div className="admin-save">
                <button className="btn btn--primary" onClick={saveContent} disabled={busy}>
                  {busy ? 'Сохраняю…' : 'Сохранить'}
                </button>
                {msg && <span className="admin-save__msg">{msg}</span>}
              </div>
            </section>
          )}

          {view === 'content' && (
            <section className="admin-block">
              <h2 className="admin-block__title">Контент сайта</h2>
              <p className="muted-note" style={{ textAlign: 'left', marginTop: 0 }}>
                Экраны устройств в героях страниц.
              </p>
              <div className="admin-devices">
                <DeviceField label="Экран iPhone (креаторы)" image={content.devices.iphone.image} onPick={(f) => setDevice('iphone', f)} onClear={() => setContent((c) => ({ ...c, devices: { ...c.devices, iphone: { image: '' } } }))} />
                <DeviceField label="Экран ноутбука (бизнес)" image={content.devices.laptop.image} onPick={(f) => setDevice('laptop', f)} onClear={() => setContent((c) => ({ ...c, devices: { ...c.devices, laptop: { image: '' } } }))} />
              </div>

              <div className="admin-device" style={{ marginTop: 16 }}>
                <div className="admin-device__label">Видео для креаторов (широкоформат, 16:9)</div>
                <div className="admin-device__preview" style={{ height: 'auto', aspectRatio: '16 / 9' }}>
                  {content.creatorVideo ? (
                    <video src={content.creatorVideo} muted loop playsInline controls style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  ) : (
                    <span className="admin-device__empty">не задано</span>
                  )}
                </div>
                <div className="admin-device__actions">
                  <label className="btn btn--ghost btn--sm">
                    Загрузить видео
                    <input type="file" accept="video/*" hidden onChange={(e) => setCreatorVideo(e.target.files?.[0])} />
                  </label>
                  {content.creatorVideo && (
                    <button className="btn btn--ghost btn--sm" onClick={() => setContent((c) => ({ ...c, creatorVideo: '' }))}>
                      Сбросить
                    </button>
                  )}
                </div>
              </div>

              <div className="admin-save">
                <button className="btn btn--primary" onClick={saveContent} disabled={busy}>
                  {busy ? 'Сохраняю…' : 'Сохранить изменения'}
                </button>
                {msg && <span className="admin-save__msg">{msg}</span>}
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
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

function Kpi({ tone = 'violet', icon, value, label, hint }) {
  return (
    <div className={`kpi kpi--${tone}`}>
      <span className="kpi__icon"><Icon name={icon} /></span>
      <div className="kpi__value">{value}</div>
      <div className="kpi__label">{label}</div>
      {hint && <div className="kpi__hint">{hint}</div>}
    </div>
  );
}

function LeadsSection({ title, leads, loading, onReload }) {
  return (
    <section className="admin-block">
      <div className="admin-panel__head">
        <h2 className="admin-block__title">
          {title} ({leads.length})
        </h2>
        <button className="btn btn--ghost btn--sm" onClick={onReload} disabled={loading}>
          {loading ? 'Обновляю…' : 'Обновить'}
        </button>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Данные</th>
              <th>Страница</th>
              <th>Время</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead, i) => (
              <tr key={i}>
                <td data-label="Данные">
                  {Object.entries(lead.fields || {}).map(([k, v]) => (
                    <div key={k}>
                      <b>{k}:</b> {v}
                    </div>
                  ))}
                </td>
                <td data-label="Страница">{lead.page || '-'}</td>
                <td data-label="Время">{new Date(lead.createdAt).toLocaleString('ru-RU')}</td>
              </tr>
            ))}
            {!leads.length && !loading && (
              <tr>
                <td colSpan={3} className="admin-table__empty">
                  Пока нет заявок
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AnalyticsByPage({ leads }) {
  const byPage = {};
  for (const l of leads) {
    const p = l.page || '-';
    byPage[p] = (byPage[p] || 0) + 1;
  }
  const rows = Object.entries(byPage).sort((a, b) => b[1] - a[1]);
  if (!rows.length) return null;
  return (
    <div className="admin-table-wrap" style={{ marginTop: 16 }}>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Страница</th>
            <th>Заявок</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([page, n]) => (
            <tr key={page}>
              <td data-label="Страница">{page}</td>
              <td data-label="Заявок">{n}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AnalyticsView({ authFetch, leads, businessLeads, creatorLeads }) {
  const [a, setA] = useState(null);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await (await authFetch('/api/admin/analytics')).json();
      setA(r.analytics || null);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);
  useEffect(() => {
    load();
    const id = setInterval(load, 12000); // live: refresh every 12s
    return () => clearInterval(id);
  }, [load]);

  const maxDay = a && a.byDay.length ? Math.max(1, ...a.byDay.map((d) => d.visits)) : 1;
  const dev = a?.device || { mobile: 0, desktop: 0 };
  const devTotal = (dev.mobile || 0) + (dev.desktop || 0);
  const mobilePct = devTotal ? Math.round((dev.mobile / devTotal) * 100) : 0;

  return (
    <section className="admin-block">
      <div className="admin-panel__head">
        <h2 className="admin-block__title">Аналитика посещаемости <span className="an-live">● live</span></h2>
        <button className="btn btn--ghost btn--sm" onClick={load} disabled={loading}>{loading ? 'Обновляю…' : 'Обновить'}</button>
      </div>

      {!a ? (
        <p className="muted-note" style={{ textAlign: 'left' }}>Загрузка…</p>
      ) : (
        <>
          <div className="admin-stats">
            <Stat label="Всего визитов" value={a.totals.visits.toLocaleString('ru-RU')} />
            <Stat label="Уникальных" value={a.totals.uniques.toLocaleString('ru-RU')} />
            <Stat label="Сегодня" value={a.today.visits.toLocaleString('ru-RU')} />
            <Stat label="Мобильных" value={`${mobilePct}%`} />
          </div>

          <h3 className="admin-block__title admin-subhead">Визиты за 14 дней</h3>
          {a.byDay.length ? (
            <div className="an-days">
              {a.byDay.map((d) => (
                <div key={d.day} className="an-day" title={`${d.day}: ${d.visits} визитов`}>
                  <span className="an-day__bar" style={{ height: `${Math.round((d.visits / maxDay) * 100)}%` }} />
                  <span className="an-day__label">{d.day.slice(5)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted-note" style={{ textAlign: 'left' }}>Данных пока нет — цифры появятся по мере посещений.</p>
          )}

          <div className="an-cols">
            <div>
              <h3 className="admin-block__title admin-subhead">Топ страниц</h3>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead><tr><th>Страница</th><th>Визитов</th></tr></thead>
                  <tbody>
                    {a.byPage.map((p) => (
                      <tr key={p.path}><td data-label="Страница">{p.path}</td><td className="muted-cell" data-label="Визитов">{p.visits}</td></tr>
                    ))}
                    {!a.byPage.length && <tr><td colSpan={2} className="admin-table__empty">—</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <h3 className="admin-block__title admin-subhead">Источники трафика</h3>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead><tr><th>Источник</th><th>Визитов</th></tr></thead>
                  <tbody>
                    {a.bySource.map((s) => (
                      <tr key={s.source}><td data-label="Источник">{s.source}</td><td className="muted-cell" data-label="Визитов">{s.visits}</td></tr>
                    ))}
                    {!a.bySource.length && <tr><td colSpan={2} className="admin-table__empty">—</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <h3 className="admin-block__title admin-subhead">Устройства</h3>
          <div className="bp-bars">
            <div className="bp-bar">
              <span className="bp-bar__label">Мобильные</span>
              <span className="bp-bar__track"><span className="bp-bar__fill" style={{ width: `${mobilePct}%` }} /></span>
              <span className="bp-bar__val">{dev.mobile}</span>
            </div>
            <div className="bp-bar">
              <span className="bp-bar__label">Десктоп</span>
              <span className="bp-bar__track"><span className="bp-bar__fill" style={{ width: `${100 - mobilePct}%` }} /></span>
              <span className="bp-bar__val">{dev.desktop}</span>
            </div>
          </div>

          <h3 className="admin-block__title admin-subhead">Куда нажимают (кнопки и переходы)</h3>
          {a.topClicks && a.topClicks.length ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Действие</th><th>Нажатий</th></tr></thead>
                <tbody>
                  {a.topClicks.map((c) => (
                    <tr key={c.label}><td data-label="Действие">{c.label}</td><td className="muted-cell" data-label="Нажатий">{c.clicks}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted-note" style={{ textAlign: 'left' }}>Пока нет данных о нажатиях.</p>
          )}
        </>
      )}

      <h3 className="admin-block__title admin-subhead">Заявки</h3>
      <div className="admin-stats">
        <Stat label="Всего заявок" value={leads.length} />
        <Stat label="Бизнес" value={businessLeads.length} />
        <Stat label="Креаторы" value={creatorLeads.length} />
      </div>
      <AnalyticsByPage leads={leads} />
    </section>
  );
}

function ReferralsView({ authFetch }) {
  const [r, setR] = useState(null);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await (await authFetch('/api/admin/referrals')).json();
      setR(res.referrals || null);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <section className="admin-block">
      <div className="admin-panel__head">
        <h2 className="admin-block__title">Рефералы</h2>
        <button className="btn btn--ghost btn--sm" onClick={load} disabled={loading}>
          {loading ? 'Обновляю…' : 'Обновить'}
        </button>
      </div>
      <p className="muted-note" style={{ textAlign: 'left', marginTop: 0 }}>
        Заявки бизнеса, пришедшие по персональной ссылке креатора (та, что он размещает у себя в шапке профиля). За каждую такую заявку креатор получает {r?.xpPerLead ?? 30} XP.
      </p>
      {!r ? (
        <p className="muted-note" style={{ textAlign: 'left' }}>Загрузка…</p>
      ) : (
        <>
          <div className="kpi-grid">
            <Kpi tone="violet" icon="link" value={r.total} label="Заявок по рефералам" />
            <Kpi tone="green" icon="users" value={r.byCreator.length} label="Креаторов привели заявки" />
          </div>
          <div className="admin-table-wrap" style={{ marginTop: 16 }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Креатор</th>
                  <th>Логин</th>
                  <th>Заявок</th>
                  <th>XP от рефералов</th>
                </tr>
              </thead>
              <tbody>
                {r.byCreator.map((c) => (
                  <tr key={c.id}>
                    <td data-label="Креатор">{c.name}</td>
                    <td className="muted-cell" data-label="Логин">{c.username || '-'}</td>
                    <td data-label="Заявок">{c.leads}</td>
                    <td className="muted-cell" data-label="XP от рефералов">{c.leads * r.xpPerLead}</td>
                  </tr>
                ))}
                {!r.byCreator.length && (
                  <tr>
                    <td colSpan={4} className="admin-table__empty">Пока нет заявок по рефералам</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function DeviceField({ label, image, onPick, onClear }) {
  return (
    <div className="admin-device">
      <div className="admin-device__label">{label}</div>
      <div className="admin-device__preview">
        {image ? <img src={image} alt="" /> : <span className="admin-device__empty">по умолчанию</span>}
      </div>
      <div className="admin-device__actions">
        <label className="btn btn--ghost btn--sm">
          Загрузить
          <input type="file" accept="image/*" hidden onChange={(e) => onPick(e.target.files?.[0])} />
        </label>
        {image && (
          <button className="btn btn--ghost btn--sm" onClick={onClear}>
            Сбросить
          </button>
        )}
      </div>
    </div>
  );
}
