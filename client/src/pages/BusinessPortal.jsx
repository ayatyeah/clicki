import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Seo from '../components/Seo.jsx';
import { API_BASE } from '../lib/config.js';

const KEY = 'clicki_business_token';
const PLATFORMS = ['TikTok', 'Instagram Reels', 'YouTube Shorts', 'Threads', 'X (Twitter)'];
const STYLES = [
  ['youth', 'Молодёжный'],
  ['premium', 'Премиальный'],
  ['corporate', 'Корпоративный'],
  ['entertainment', 'Развлекательный'],
];

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
  if (!data) return <Shell><p className="creator-portal__muted">{loading ? 'Загрузка…' : '…'}</p></Shell>;
  return <Dashboard data={data} authFetch={authFetch} reload={loadMe} onLogout={logout} />;
}

function Shell({ children }) {
  return (
    <main className="creator-portal page-light app-light">
      <Seo title="CLICKI — кабинет бизнеса" path="/business-cabinet" description="Личный кабинет бренда CLICKI: создавайте брифы и запускайте кампании." noindex />
      <div className="container creator-portal__inner">
        <div className="creator-portal__head">
          <Link to="/" className="creator-portal__brand">CLICKI</Link>
          <span className="creator-portal__tag">кабинет бизнеса</span>
        </div>
        {children}
      </div>
    </main>
  );
}

/* ---------------- Auth ---------------- */
function AuthScreen({ onAuthed }) {
  const [mode, setMode] = useState('login');
  return (
    <Shell>
      <h1 className="creator-portal__title">Кабинет бизнеса</h1>
      <p className="creator-portal__muted">
        {mode === 'login' ? 'Войдите, чтобы создавать брифы и запускать кампании.' : 'Создайте аккаунт бренда за минуту.'}
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
    </Shell>
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

/* ---------------- Dashboard ---------------- */
function Dashboard({ data, authFetch, reload, onLogout }) {
  const b = data.business;
  const briefs = data.briefs || [];
  const submissions = data.submissions || [];
  const incoming = submissions.filter((s) => s.status === 'sent_to_business');
  const accepted = submissions.filter((s) => s.status === 'accepted');

  const accept = async (id) => {
    await authFetch(`/api/business/submissions/${id}/accept`, { method: 'POST' });
    reload();
  };

  return (
    <Shell>
      <div className="creator-portal__top">
        <div>
          <h1 className="creator-portal__title">Привет, {b.name}</h1>
          <p className="creator-portal__muted">{b.company || 'Бренд'} · {b.email}</p>
        </div>
        <button className="btn btn--ghost btn--sm" onClick={onLogout}>Выйти</button>
      </div>

      <h2 className="creator-portal__h2">На приёмку</h2>
      {incoming.length ? (
        incoming.map((s) => (
          <div key={s.id} className="creator-portal__card">
            <div className="creator-portal__brief-head">
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
        ))
      ) : (
        <p className="creator-portal__muted">Работ на приёмке пока нет.</p>
      )}

      {accepted.length > 0 && (
        <>
          <h2 className="creator-portal__h2">Принятые работы</h2>
          {accepted.map((s) => (
            <div key={s.id} className="creator-portal__card">
              <div className="creator-portal__brief-head">
                <b>{s.brief_title || s.platform}</b>
                <span className="pf-status pf-status--accepted">принято</span>
              </div>
              <p className="creator-portal__muted" style={{ margin: 0 }}>
                <a href={s.video_url} target="_blank" rel="noreferrer">Видео</a> · {s.creator_name || `#${s.creator_id}`}
              </p>
            </div>
          ))}
        </>
      )}

      <h2 className="creator-portal__h2">Создать бриф</h2>
      <BriefForm authFetch={authFetch} reload={reload} />

      <h2 className="creator-portal__h2">Мои брифы</h2>
      {briefs.length ? (
        briefs.map((br) => (
          <div key={br.id} className="creator-portal__card">
            <div className="creator-portal__brief-head">
              <b>{br.title}</b>
              <span className={`pf-status pf-status--${br.status === 'active' ? 'accepted' : 'pending'}`}>
                {br.status === 'active' ? 'в работе' : 'на модерации'}
              </span>
            </div>
            <p className="creator-portal__muted" style={{ margin: 0 }}>
              {br.platform} · {(br.spec?.orientation === 'horizontal' ? 'горизонтальное' : 'вертикальное')} · до {br.duration_max}с
              {br.spec?.style ? ` · ${STYLES.find((s) => s[0] === br.spec.style)?.[1] || br.spec.style}` : ''}
            </p>
          </div>
        ))
      ) : (
        <p className="creator-portal__muted">Брифов пока нет — создайте первый выше.</p>
      )}
    </Shell>
  );
}

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

function BriefForm({ authFetch, reload }) {
  const [f, setF] = useState(EMPTY_BRIEF);
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
      const res = await authFetch('/api/business/briefs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (!res.ok) throw new Error((d.errors && d.errors[0]) || 'Ошибка');
      setF(EMPTY_BRIEF);
      setMsg('Бриф создан ✓');
      reload();
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
      <button className="btn btn--primary btn--block" disabled={busy}>{busy ? 'Создаю…' : 'Создать бриф'}</button>
      {msg && <p className="creator-portal__muted" style={{ textAlign: 'center', color: '#15803d' }}>{msg}</p>}
    </form>
  );
}
