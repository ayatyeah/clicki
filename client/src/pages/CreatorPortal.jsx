import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Seo from '../components/Seo.jsx';
import { API_BASE } from '../lib/config.js';

const KEY = 'clicki_creator_token';
const PLATFORMS = ['TikTok', 'Instagram Reels', 'YouTube Shorts', 'Threads', 'X (Twitter)'];

// Onboarding test (ТЗ §3 step 2) — filters "не по брифу" disputes before filming.
const QUIZ = [
  { q: 'Минимум просмотров, чтобы видео засчиталось?', opts: ['500', '2 000', '10 000'], a: 1 },
  { q: 'Допустимый хронометраж ролика?', opts: ['5–15 сек', '15–90 сек', '60–180 сек'], a: 1 },
  { q: 'Можно загрузить чужое видео?', opts: ['Да', 'Нет, только своё по брифу'], a: 1 },
  { q: 'Когда проверяется, удалено ли видео?', opts: ['Каждый день', 'На 30-й день после публикации'], a: 1 },
  { q: 'Хэштег из брифа обязателен?', opts: ['Да', 'На усмотрение'], a: 0 },
];

export default function CreatorPortal() {
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
      const res = await authFetch('/api/creator/me');
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

  if (!token) {
    const refId = new URLSearchParams(window.location.search).get('ref');
    return <AuthScreen refId={refId} onAuthed={onAuthed} />;
  }
  if (!data) return <Shell><p className="creator-portal__muted">{loading ? 'Загрузка…' : '…'}</p></Shell>;

  const c = data.creator;
  if (!c.onboarding_passed) return <Onboarding authFetch={authFetch} onDone={loadMe} />;

  return <Dashboard data={data} authFetch={authFetch} reload={loadMe} onLogout={logout} />;
}

function Shell({ children }) {
  return (
    <main className="creator-portal page-light app-light ae-skip">
      <Seo title="CLICKI — кабинет креатора" path="/creator" description="Личный кабинет креатора CLICKI: брифы, сдача видео, кошелёк и рейтинг." noindex />
      <div className="container creator-portal__inner">
        <div className="creator-portal__head">
          <Link to="/" className="creator-portal__brand">CLICKI</Link>
          <span className="creator-portal__tag">кабинет креатора</span>
        </div>
        {children}
      </div>
    </main>
  );
}

/* ---------------- Auth: login + application tabs ---------------- */
function AuthScreen({ onAuthed, refId }) {
  const [mode, setMode] = useState('login'); // 'login' | 'apply'
  const [applied, setApplied] = useState(false);
  return (
    <Shell>
      <h1 className="creator-portal__title">Кабинет креатора</h1>
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
        <LoginForm onAuthed={onAuthed} toApply={() => setMode('apply')} />
      ) : applied ? (
        <ApplyDone onToLogin={() => { setApplied(false); setMode('login'); }} />
      ) : (
        <ApplyForm refId={refId} onDone={() => setApplied(true)} />
      )}
    </Shell>
  );
}

function LoginForm({ onAuthed, toApply }) {
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
    <form className="creator-portal__card" onSubmit={submit}>
      <input placeholder="Логин" autoComplete="username" value={f.username} onChange={(e) => set('username', e.target.value)} required />
      <input type="password" placeholder="Пароль" autoComplete="current-password" value={f.password} onChange={(e) => set('password', e.target.value)} required />
      {error && <p className="creator-portal__err">{error}</p>}
      <button className="btn btn--primary btn--block" disabled={busy}>{busy ? 'Вхожу…' : 'Войти'}</button>
      <p className="creator-portal__muted creator-portal__switch">
        Нет аккаунта?{' '}
        <button type="button" className="creator-portal__link" onClick={toApply}>Подать заявку</button>
      </p>
    </form>
  );
}

function ApplyForm({ refId, onDone }) {
  const [f, setF] = useState({ name: '', contact: '', socials: '', city: '' });
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
    <form className="creator-portal__card" onSubmit={submit}>
      <input placeholder="Имя" autoComplete="name" value={f.name} onChange={(e) => set('name', e.target.value)} required />
      <input placeholder="Телефон / Telegram" value={f.contact} onChange={(e) => set('contact', e.target.value)} required />
      <input placeholder="Ссылки на соцсети (TikTok, Instagram…)" value={f.socials} onChange={(e) => set('socials', e.target.value)} />
      <input placeholder="Город" value={f.city} onChange={(e) => set('city', e.target.value)} />
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
  const [ans, setAns] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const correct = QUIZ.filter((q, i) => ans[i] === q.a).length;
    if (correct < 4) return setError(`Правильных ${correct} из ${QUIZ.length}. Нужно минимум 4 — перечитай и попробуй снова.`);
    setBusy(true);
    setError('');
    try {
      const res = await authFetch('/api/creator/onboarding', { method: 'POST' });
      if (!res.ok) throw new Error('Не удалось сохранить — попробуйте ещё раз');
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Shell>
      <h1 className="creator-portal__title">Короткий тест</h1>
      <p className="creator-portal__muted">5 вопросов о правилах — чтобы видео не отклонялись потом.</p>
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
        <button className="btn btn--primary btn--block" onClick={submit} disabled={busy}>{busy ? 'Сохраняю…' : 'Пройти тест'}</button>
      </div>
    </Shell>
  );
}

function Dashboard({ data, authFetch, reload, onLogout }) {
  const { creator: c, wallet, briefs, openBriefs = [], submissions, level } = data;
  // A published brief is an open order for every creator; anyone can submit to it.
  const submitBriefs = openBriefs.length ? openBriefs : briefs;
  const threshold = wallet.payout_threshold || 0;
  const pct = threshold ? Math.min(100, Math.round((wallet.balance / threshold) * 100)) : 0;
  const firstName = (c.name || '').split(' ')[0] || c.name;
  return (
    <Shell>
      <div className="creator-portal__top">
        <div>
          <h1 className="creator-portal__title">Привет, {firstName} {c.founding && <span className="pf-badge">Founding</span>}</h1>
          <p className="creator-portal__muted">{level} · Стрик {c.streak} дн · XP {c.xp} · Trust {c.trust_score}</p>
        </div>
        <button className="btn btn--ghost btn--sm" onClick={onLogout}>Выйти</button>
      </div>

      <div className="creator-portal__card">
        <div className="creator-portal__wallet-row">
          <span>Кошелёк</span>
          <b>{Math.round(wallet.balance).toLocaleString('ru-RU')} ₸</b>
        </div>
        <div className="creator-portal__bar"><div style={{ width: `${pct}%` }} /></div>
        <p className="creator-portal__muted">До выплаты {threshold.toLocaleString('ru-RU')} ₸ осталось {Math.max(0, Math.round(threshold - wallet.balance)).toLocaleString('ru-RU')} ₸</p>
      </div>

      <div className="creator-portal__card">
        <div className="creator-portal__wallet-row"><span>Пригласи друга</span></div>
        <p className="creator-portal__muted">
          {c.username
            ? 'Твоя персональная ссылка. Бонус +500 XP, когда у приглашённого засчитают первое видео.'
            : 'Ссылка появится, когда оператор выдаст тебе логин. Пока действует ссылка ниже.'}
        </p>
        <input
          readOnly
          value={c.username ? `${window.location.origin}/${c.username}` : `${window.location.origin}/creator?ref=${c.id}`}
          onFocus={(e) => e.target.select()}
        />
      </div>

      <h2 className="creator-portal__h2">Заказы <span className="creator-portal__chip">доступны всем</span></h2>
      {openBriefs.length ? (
        openBriefs.map((b) => <BriefCard key={b.id} b={b} />)
      ) : (
        <p className="creator-portal__muted">Открытых заказов пока нет — менеджер скоро опубликует.</p>
      )}

      {briefs.length > 0 && (
        <>
          <h2 className="creator-portal__h2">Назначенные тебе</h2>
          {briefs.map((b) => <BriefCard key={b.id} b={b} />)}
        </>
      )}

      <h2 className="creator-portal__h2">Сдать видео</h2>
      <SubmitForm authFetch={authFetch} briefs={submitBriefs} reload={reload} />

      <h2 className="creator-portal__h2">Мои видео</h2>
      {submissions.length ? (
        <div className="creator-portal__card creator-portal__subs">
          {submissions.map((s) => (
            <div key={s.id} className="creator-portal__sub-row">
              <div className="creator-portal__sub">
                <a href={s.video_url} target="_blank" rel="noreferrer">{s.brief_title || s.platform}</a>
                <span className={`pf-status pf-status--${s.status}`}>{SUB_STATUS_RU[s.status] || s.status}</span>
                <span className="creator-portal__muted">{(s.views || 0).toLocaleString('ru-RU')} просм.</span>
                {s.ai_score != null && <span className="ai-score">AI {s.ai_score}/100</span>}
              </div>
              {s.status === 'rework' && s.ai_feedback && (
                <p className="creator-portal__rework">↻ На доработку: {s.ai_feedback}</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="creator-portal__muted">Пока ничего не сдано.</p>
      )}

      <h2 className="creator-portal__h2">Лидерборд</h2>
      <Leaderboard meId={c.id} />
    </Shell>
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

function BriefCard({ b }) {
  const [open, setOpen] = useState(false);
  const spec = b.spec || {};
  const rows = [];
  if (b.goal) rows.push(['Цель', b.goal]);
  if (b.audience) rows.push(['Аудитория', b.audience]);
  if (spec.orientation) rows.push(['Ориентация', spec.orientation === 'horizontal' ? 'Горизонтальное' : 'Вертикальное']);
  rows.push(['Хронометраж', `${b.duration_min}–${b.duration_max} сек`]);
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

  return (
    <div className="creator-portal__card">
      <div className="creator-portal__brief-head">
        <b>{b.title}</b>
        <span className="pf-badge">{b.platform}</span>
      </div>
      {b.key_message && <p className="creator-portal__muted">{b.key_message}</p>}
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
      <button type="button" className="creator-portal__link" onClick={() => setOpen((o) => !o)}>
        {open ? 'Свернуть ↑' : 'Читать весь бриф →'}
      </button>
    </div>
  );
}

function Leaderboard({ meId }) {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    fetch(`${API_BASE}/api/leaderboard`)
      .then((r) => r.json())
      .then((d) => setRows(d.leaderboard || []))
      .catch(() => {});
  }, []);
  if (!rows.length) return <p className="creator-portal__muted">Рейтинг пока пуст.</p>;
  return (
    <div className="creator-portal__card">
      {rows.map((r, i) => (
        <div key={r.id} className={`creator-portal__lb${r.id === meId ? ' is-me' : ''}`}>
          <span className="creator-portal__lb-rank">#{i + 1}</span>
          <b>{r.name}</b>
          <span className="pf-badge">{r.level}</span>
          <span className="creator-portal__muted">{r.xp} XP · стрик {r.streak}</span>
        </div>
      ))}
    </div>
  );
}

function SubmitForm({ authFetch, briefs, reload }) {
  const [f, setF] = useState({ brief_id: '', platform: 'TikTok', video_url: '', published_at: '', screenshot_url: '', rights_confirmed: false });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const submit = async (e) => {
    e.preventDefault();
    setError('');
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
      setF({ brief_id: '', platform: 'TikTok', video_url: '', published_at: '', screenshot_url: '', rights_confirmed: false });
      reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="creator-portal__card" onSubmit={submit}>
      <select value={f.brief_id} onChange={(e) => set('brief_id', e.target.value)}>
        <option value="">Без брифа</option>
        {briefs.map((b) => (
          <option key={b.id} value={b.brief_id || b.id}>{b.title}</option>
        ))}
      </select>
      <select value={f.platform} onChange={(e) => set('platform', e.target.value)}>
        {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
      </select>
      <input placeholder="Ссылка на опубликованное видео" value={f.video_url} onChange={(e) => set('video_url', e.target.value)} />
      <input type="date" value={f.published_at} onChange={(e) => set('published_at', e.target.value)} />
      <input placeholder="Ссылка на скриншот (статистика)" value={f.screenshot_url} onChange={(e) => set('screenshot_url', e.target.value)} />
      <label className="pf-check">
        <input type="checkbox" checked={f.rights_confirmed} onChange={(e) => set('rights_confirmed', e.target.checked)} /> Подтверждаю права на это видео
      </label>
      {error && <p className="creator-portal__err">{error}</p>}
      <button className="btn btn--primary btn--block" disabled={busy}>{busy ? 'Отправляю…' : 'Сдать видео'}</button>
    </form>
  );
}
