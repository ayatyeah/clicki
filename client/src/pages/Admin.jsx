import { useEffect, useState, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { API_BASE } from '../lib/config.js';

const TOKEN_KEY = 'clicki_admin_token';
const EMPTY = { showcase: [], devices: { iphone: { image: '' }, laptop: { image: '' } } };

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
      setContent({ showcase: data.showcase || [], devices: { iphone: { image: data?.devices?.iphone?.image || '' }, laptop: { image: data?.devices?.laptop?.image || '' } } });
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
      <main className="admin">
        <Helmet>
          <title>CLICKI — админка</title>
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
    { key: 'dashboard', label: 'Дашборд', icon: '▦' },
    { key: 'ai', label: 'ИИ Аналитика', icon: '✦' },
    { key: 'analytics', label: 'Аналитика', icon: '📈' },
    { key: 'leads-business', label: 'Заявки Бизнеса', icon: '🟣' },
    { key: 'leads-creators', label: 'Заявки Креаторов', icon: '🟢' },
    { key: 'videos', label: 'Загрузка видео', icon: '🎬' },
    { key: 'content', label: 'Контент сайта', icon: '🖼' },
  ];

  return (
    <main className="admin">
      <Helmet>
        <title>CLICKI — админка</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="admin-layout">
        <aside className="admin-sidebar">
          <div className="admin-sidebar__brand">CLICKI · админка</div>
          <nav className="admin-nav">
            {NAV.map((n) => (
              <button
                key={n.key}
                className={`admin-nav__btn ${view === n.key ? 'is-active' : ''}`}
                onClick={() => setView(n.key)}
              >
                <span className="admin-nav__icon" aria-hidden="true">{n.icon}</span>
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
              <div className="admin-stats">
                <Stat label="Всего заявок" value={leads.length} />
                <Stat label="Заявки бизнеса" value={businessLeads.length} />
                <Stat label="Заявки креаторов" value={creatorLeads.length} />
                <Stat label="Видео в ленте" value={content.showcase.length} />
              </div>
            </section>
          )}

          {view === 'ai' && (
            <section className="admin-block">
              <h2 className="admin-block__title">ИИ Аналитика</h2>
              <div className="admin-placeholder">
                Раздел в разработке. Здесь появится ИИ-аналитика заявок: сегментация аудитории,
                прогноз конверсии и подсказки по контенту.
              </div>
            </section>
          )}

          {view === 'analytics' && (
            <section className="admin-block">
              <h2 className="admin-block__title">Аналитика</h2>
              <div className="admin-stats">
                <Stat label="Всего заявок" value={leads.length} />
                <Stat label="Бизнес" value={businessLeads.length} />
                <Stat label="Креаторы" value={creatorLeads.length} />
              </div>
              <AnalyticsByPage leads={leads} />
            </section>
          )}

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
                <td>
                  {Object.entries(lead.fields || {}).map(([k, v]) => (
                    <div key={k}>
                      <b>{k}:</b> {v}
                    </div>
                  ))}
                </td>
                <td>{lead.page || '—'}</td>
                <td>{new Date(lead.createdAt).toLocaleString('ru-RU')}</td>
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
    const p = l.page || '—';
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
              <td>{page}</td>
              <td>{n}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
