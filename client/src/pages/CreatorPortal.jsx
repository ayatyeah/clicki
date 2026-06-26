import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Seo from '../components/Seo.jsx';
import { API_BASE } from '../lib/config.js';

const KEY = 'clicki_creator_id';
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
  const [id, setId] = useState(() => localStorage.getItem(KEY) || '');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async (cid) => {
    const res = await fetch(`${API_BASE}/api/creator/${cid}`);
    if (!res.ok) {
      localStorage.removeItem(KEY);
      setId('');
      return;
    }
    setData(await res.json());
  }, []);

  useEffect(() => {
    if (id) load(id);
  }, [id, load]);

  if (!id) return <Register onDone={(cid) => { localStorage.setItem(KEY, cid); setId(String(cid)); }} setError={setError} error={error} />;
  if (!data) return <Shell><p className="creator-portal__muted">Загрузка…</p></Shell>;

  const c = data.creator;
  if (!c.onboarding_passed) return <Onboarding id={id} onDone={() => load(id)} />;

  return <Dashboard id={id} data={data} reload={() => load(id)} onLogout={() => { localStorage.removeItem(KEY); setId(''); setData(null); }} />;
}

function Shell({ children }) {
  return (
    <main className="creator-portal">
      <Seo title="CLICKI — кабинет креатора" path="/creator" />
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

function Register({ onDone, setError, error }) {
  const [f, setF] = useState({ name: '', contact: '', socials: '', city: '' });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await fetch(`${API_BASE}/api/creator/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(f),
    });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) return setError((d.errors && d.errors[0]) || 'Ошибка');
    onDone(d.creator.id);
  };
  return (
    <Shell>
      <h1 className="creator-portal__title">Стать креатором CLICKI</h1>
      <p className="creator-portal__muted">Заполни анкету — дальше короткий тест и первые брифы.</p>
      <form className="creator-portal__card" onSubmit={submit}>
        <input placeholder="Имя" value={f.name} onChange={(e) => set('name', e.target.value)} required />
        <input placeholder="Телефон / Telegram" value={f.contact} onChange={(e) => set('contact', e.target.value)} required />
        <input placeholder="Ссылки на соцсети (TikTok, Instagram…)" value={f.socials} onChange={(e) => set('socials', e.target.value)} />
        <input placeholder="Город" value={f.city} onChange={(e) => set('city', e.target.value)} />
        {error && <p className="creator-portal__err">{error}</p>}
        <button className="btn btn--primary btn--block" disabled={busy}>{busy ? 'Отправляю…' : 'Продолжить'}</button>
      </form>
    </Shell>
  );
}

function Onboarding({ id, onDone }) {
  const [ans, setAns] = useState({});
  const [error, setError] = useState('');
  const submit = async () => {
    const correct = QUIZ.filter((q, i) => ans[i] === q.a).length;
    if (correct < 4) return setError(`Правильных ${correct} из ${QUIZ.length}. Нужно минимум 4 — перечитай и попробуй снова.`);
    await fetch(`${API_BASE}/api/creator/${id}/onboarding`, { method: 'POST' });
    onDone();
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
        <button className="btn btn--primary btn--block" onClick={submit}>Пройти тест</button>
      </div>
    </Shell>
  );
}

function Dashboard({ id, data, reload, onLogout }) {
  const { creator: c, wallet, briefs, submissions } = data;
  const pct = Math.min(100, Math.round((wallet.balance / wallet.payout_threshold) * 100));
  return (
    <Shell>
      <div className="creator-portal__top">
        <div>
          <h1 className="creator-portal__title">Привет, {c.name.split(' ')[0]} {c.founding && <span className="pf-badge">Founding</span>}</h1>
          <p className="creator-portal__muted">Стрик {c.streak}🔥 · XP {c.xp} · Trust {c.trust_score}</p>
        </div>
        <button className="btn btn--ghost btn--sm" onClick={onLogout}>Выйти</button>
      </div>

      <div className="creator-portal__card">
        <div className="creator-portal__wallet-row">
          <span>Кошелёк</span>
          <b>{Math.round(wallet.balance).toLocaleString('ru-RU')} ₸</b>
        </div>
        <div className="creator-portal__bar"><div style={{ width: `${pct}%` }} /></div>
        <p className="creator-portal__muted">До выплаты {wallet.payout_threshold.toLocaleString('ru-RU')} ₸ осталось {Math.max(0, Math.round(wallet.payout_threshold - wallet.balance)).toLocaleString('ru-RU')} ₸</p>
      </div>

      <h2 className="creator-portal__h2">Твои брифы</h2>
      {briefs.length ? (
        briefs.map((b) => (
          <div key={b.id} className="creator-portal__card">
            <div className="creator-portal__brief-head"><b>{b.title}</b><span className="pf-badge">{b.platform}</span></div>
            <p className="creator-portal__muted">{b.key_message}</p>
            <ul className="creator-portal__req">
              {b.req_hashtag && <li>Хэштег: {b.req_hashtag}</li>}
              {b.req_mention && <li>Упоминание бренда в первые 3 сек</li>}
              {b.req_cta_link && <li>CTA-ссылка: {b.req_cta_link}</li>}
              <li>Хронометраж {b.duration_min}–{b.duration_max} сек</li>
            </ul>
          </div>
        ))
      ) : (
        <p className="creator-portal__muted">Брифов пока нет — оператор скоро назначит.</p>
      )}

      <h2 className="creator-portal__h2">Сдать видео</h2>
      <SubmitForm id={id} briefs={briefs} reload={reload} />

      <h2 className="creator-portal__h2">Мои видео</h2>
      {submissions.length ? (
        <div className="creator-portal__card">
          {submissions.map((s) => (
            <div key={s.id} className="creator-portal__sub">
              <a href={s.video_url} target="_blank" rel="noreferrer">{s.platform}</a>
              <span className={`pf-status pf-status--${s.status}`}>{s.status}</span>
              <span className="creator-portal__muted">{s.views.toLocaleString('ru-RU')} просм.</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="creator-portal__muted">Пока ничего не сдано.</p>
      )}
    </Shell>
  );
}

function SubmitForm({ id, briefs, reload }) {
  const [f, setF] = useState({ brief_id: '', platform: 'TikTok', video_url: '', published_at: '', screenshot_url: '', rights_confirmed: false });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!f.video_url || !f.rights_confirmed) return setError('Укажи ссылку на видео и подтверди права');
    setBusy(true);
    const res = await fetch(`${API_BASE}/api/creator/${id}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...f, brief_id: f.brief_id || null }),
    });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) return setError((d.errors && d.errors[0]) || 'Ошибка');
    setF({ brief_id: '', platform: 'TikTok', video_url: '', published_at: '', screenshot_url: '', rights_confirmed: false });
    reload();
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
