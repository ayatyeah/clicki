import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Seo from '../components/Seo.jsx';
import Assistant from '../components/Assistant.jsx';
import { API_BASE, SITE_URL } from '../lib/config.js';

const KEY = 'clicki_creator_token';
const PLATFORMS = ['TikTok', 'Instagram Reels', 'YouTube Shorts', 'Threads', 'X (Twitter)'];
const CREATOR_QA = [
  { q: 'Когда придут деньги?', a: 'Как только баланс в кошельке достигнет порога выплаты, оператор оформит перевод на Kaspi — статус видно во вкладке «Кошелёк».' },
  { q: 'Почему видео не засчитали?', a: 'Причина отклонения указана рядом со статусом видео — обычно это несоответствие хронометражу, отсутствие хэштега/упоминания или низкое качество.' },
  { q: 'Как получить больше брифов?', a: 'Открытые заказы видны в разделе «Заказы» — берите любой активный, оператор также может назначить бриф лично.' },
  { q: 'Что даёт реферальная ссылка?', a: '+500 XP за друга, ставшего креатором, и +30 XP за каждую заявку бизнеса, пришедшую по ссылке в шапке профиля.' },
];

// Onboarding test (ТЗ §3 step 2) — filters "не по брифу" disputes before filming.
const QUIZ = [
  { q: 'Минимум просмотров, чтобы видео засчиталось?', opts: ['500', '2 000', '10 000'], a: 1 },
  { q: 'Допустимый хронометраж ролика?', opts: ['5–15 сек', '15–90 сек', '60–180 сек'], a: 1 },
  { q: 'Можно загрузить чужое видео?', opts: ['Да', 'Нет, только своё по брифу'], a: 1 },
  { q: 'Когда проверяется, удалено ли видео?', opts: ['Каждый день', 'На 30-й день после публикации'], a: 1 },
  { q: 'Хэштег из брифа обязателен?', opts: ['Да', 'На усмотрение'], a: 0 },
];

export default function CreatorPortal() {
  const [token, setToken] = useState(() => sessionStorage.getItem(KEY) || '');
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
      sessionStorage.removeItem(KEY);
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
    sessionStorage.setItem(KEY, tok);
    setToken(tok);
    setData(payload);
  };
  const logout = () => {
    sessionStorage.removeItem(KEY);
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
      <Assistant accent="violet" qa={CREATOR_QA} />
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
    <form className="creator-portal__card" onSubmit={submit}>
      <input placeholder="Имя" autoComplete="name" value={f.name} onChange={(e) => set('name', e.target.value)} required />
      <input placeholder="Телефон / Telegram" value={f.contact} onChange={(e) => set('contact', e.target.value)} required />
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

      {data.forecast && <EarningsForecastCard forecast={data.forecast} />}

      <div className="creator-portal__card">
        <div className="creator-portal__wallet-row"><span>Пригласи друга</span></div>
        <p className="creator-portal__muted">
          {c.username
            ? 'Отправь эту ссылку другу. +500 XP, когда у него засчитают первое видео.'
            : 'Ссылка появится, когда оператор выдаст тебе логин.'}
        </p>
        {c.username && (
          <input
            readOnly
            value={`${SITE_URL}/friend/${c.username}`}
            onFocus={(e) => e.target.select()}
          />
        )}
      </div>

      <div className="creator-portal__card">
        <div className="creator-portal__wallet-row"><span>Ссылка в шапку профиля</span></div>
        <p className="creator-portal__muted">
          {c.username
            ? 'Помести её в шапку своего профиля в соцсетях — по ней открывается твоя мини-страница на CLICKI с брендами, с которыми ты работал, и твоими соцсетями. +30 XP за каждую заявку от бизнеса, пришедшего по этой ссылке.'
            : 'Ссылка появится, когда оператор выдаст тебе логин.'}
        </p>
        {c.username && (
          <input
            readOnly
            value={`${SITE_URL}/${c.username}`}
            onFocus={(e) => e.target.select()}
          />
        )}
      </div>

      {c.username && <ReferralLeadsCard authFetch={authFetch} />}

      <TikTokCard c={c} authFetch={authFetch} reload={reload} />

      <h2 className="creator-portal__h2">Заказы <span className="creator-portal__chip">доступны всем</span></h2>
      {openBriefs.length ? (
        openBriefs.map((b, i) => <BriefCard key={b.id} b={b} top={i === 0 && b.est_payout > 0} authFetch={authFetch} />)
      ) : (
        <p className="creator-portal__muted">Открытых заказов пока нет — менеджер скоро опубликует.</p>
      )}

      {briefs.length > 0 && (
        <>
          <h2 className="creator-portal__h2">Назначенные тебе</h2>
          {briefs.map((b) => <BriefCard key={b.id} b={b} authFetch={authFetch} />)}
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
              {(s.status === 'accepted' || s.status === 'rejected') && s.coach_feedback && (
                <p className="creator-portal__muted">🎯 AI-коуч: {s.coach_feedback}</p>
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
        В том же темпе (за 30 дней — {forecast.videos_30d} {forecast.videos_30d === 1 ? 'видео' : 'видео'}).
        {forecast.avg_per_video > 0 && (
          <> Возьми ещё 2 брифа — примерно <b>{forecast.plus_2_briefs.toLocaleString('ru-RU')} ₸</b>.</>
        )}
      </p>
    </div>
  );
}

/** Leads/clients the creator's own bio-page link has brought in. */
function ReferralLeadsCard({ authFetch }) {
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    (async () => {
      const r = await (await authFetch('/api/creator/referrals')).json();
      setData(r.referrals || null);
    })();
  }, [authFetch]);

  if (!data) return null;
  return (
    <div className="creator-portal__card">
      <div className="creator-portal__wallet-row">
        <span>Лиды и клиенты по твоей ссылке</span>
        <b>{data.total}</b>
      </div>
      <p className="creator-portal__muted">
        Заявки от бизнеса, пришедшие по ссылке в шапку профиля. +{data.xpPerLead} XP за каждую.
      </p>
      {data.total > 0 && (
        <button type="button" className="creator-portal__link" onClick={() => setOpen((o) => !o)}>
          {open ? 'Скрыть список' : 'Показать список'}
        </button>
      )}
      {open && (
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {data.leads.map((l) => (
            <li key={l.id} className="creator-portal__muted">{l.at}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Connect TikTok (Login Kit) so view counts sync automatically instead of an operator typing them in. */
function TikTokCard({ c, authFetch, reload }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get('tiktok');
    if (!status) return;
    setMsg(status === 'connected' ? 'TikTok подключён ✓' : 'Не удалось подключить TikTok — попробуй ещё раз.');
    window.history.replaceState(null, '', window.location.pathname);
    reload();
  }, []); // eslint-disable-line

  const connect = async () => {
    setBusy(true);
    try {
      const r = await (await authFetch('/api/creator/tiktok/connect', { method: 'POST' })).json();
      if (r.ok && r.url) window.location.href = r.url;
      else setMsg((r.errors && r.errors[0]) || 'Не удалось начать подключение');
    } finally {
      setBusy(false);
    }
  };
  const disconnect = async () => {
    setBusy(true);
    try {
      await authFetch('/api/creator/tiktok/disconnect', { method: 'POST' });
      reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="creator-portal__card">
      <div className="creator-portal__wallet-row"><span>TikTok</span></div>
      {c.tiktok_connected ? (
        <>
          <p className="creator-portal__muted">Подключён{c.tiktok_username ? `: @${c.tiktok_username}` : ''}. Просмотры твоих видео обновляются сами.</p>
          <button className="btn btn--ghost btn--sm" onClick={disconnect} disabled={busy}>Отключить</button>
        </>
      ) : (
        <>
          <p className="creator-portal__muted">Подключи аккаунт — просмотры видео будут подтягиваться сами, без ручного ввода.</p>
          <button className="btn btn--primary btn--sm" onClick={connect} disabled={busy}>{busy ? '…' : 'Подключить TikTok'}</button>
        </>
      )}
      {msg && <p className="creator-portal__muted">{msg}</p>}
    </div>
  );
}

function BriefCard({ b, top = false, authFetch = null }) {
  const [open, setOpen] = useState(false);
  const [prompterOpen, setPrompterOpen] = useState(false);
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
        {top && <span className="pf-badge pf-badge--accent">Топ по выгоде</span>}
      </div>
      {b.est_payout > 0 && (
        <p className="creator-portal__muted">
          Ожидаемо ~<b>{b.est_payout.toLocaleString('ru-RU')} ₸</b> за видео
          {b.est_basis === 'own' && ` (по твоим ${b.est_sample_size} видео на этой площадке)`}
          {b.est_basis === 'market' && ' (по среднему охвату на платформе)'}
          {b.est_basis === 'baseline' && ' (ориентир, данных пока нет)'}
        </p>
      )}
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
      <div className="creator-portal__brief-actions">
        <button type="button" className="creator-portal__link" onClick={() => setOpen((o) => !o)}>
          {open ? 'Свернуть ↑' : 'Читать весь бриф →'}
        </button>
        {authFetch && (
          <button type="button" className="creator-portal__link" onClick={() => setPrompterOpen(true)}>
            🎬 Сценарий и суфлёр
          </button>
        )}
      </div>
      {prompterOpen && <TeleprompterModal briefId={b.id} authFetch={authFetch} onClose={() => setPrompterOpen(false)} />}
    </div>
  );
}

/** AI Script & Teleprompter — generates a script from the brief, then scrolls
 * it at an adjustable speed so a creator can read it straight off-camera. */
function TeleprompterModal({ briefId, authFetch, onClose }) {
  const [script, setScript] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState(false);
  const [fontSize, setFontSize] = useState(28);
  const [speed, setSpeed] = useState(40); // px/sec
  const [attempt, setAttempt] = useState(0);
  const scrollRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await authFetch(`/api/creator/briefs/${briefId}/script`, { method: 'POST' });
        const j = await res.json();
        if (cancelled) return;
        if (!j.ok) setError(j.errors?.[0] || 'Не удалось сгенерировать сценарий');
        else setScript(j.script || '');
      } catch {
        if (!cancelled) setError('Не удалось сгенерировать — попробуйте позже');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [briefId, authFetch, attempt]);

  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    let last = performance.now();
    const step = (now) => {
      const dt = (now - last) / 1000;
      last = now;
      if (scrollRef.current) scrollRef.current.scrollTop += speed * dt;
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed]);

  return (
    <div className="teleprompter__backdrop" onClick={onClose}>
      <div className="teleprompter" onClick={(e) => e.stopPropagation()}>
        <div className="teleprompter__bar">
          <div className="teleprompter__group">
            <button className="btn btn--ghost btn--sm" onClick={() => setFontSize((s) => Math.max(16, s - 2))} aria-label="Уменьшить шрифт">A-</button>
            <span className="teleprompter__value">{fontSize}px</span>
            <button className="btn btn--ghost btn--sm" onClick={() => setFontSize((s) => Math.min(48, s + 2))} aria-label="Увеличить шрифт">A+</button>
          </div>
          <div className="teleprompter__group">
            <button className="btn btn--ghost btn--sm" onClick={() => setSpeed((s) => Math.max(10, s - 10))} aria-label="Медленнее">−</button>
            <span className="teleprompter__value">{speed} px/с</span>
            <button className="btn btn--ghost btn--sm" onClick={() => setSpeed((s) => Math.min(200, s + 10))} aria-label="Быстрее">+</button>
          </div>
          <button className="btn btn--primary btn--sm" onClick={() => setPlaying((p) => !p)} disabled={loading || !!error}>
            {playing ? '⏸ Пауза' : '▶ Старт'}
          </button>
          <button className="btn btn--ghost btn--sm" onClick={onClose}>Закрыть ✕</button>
        </div>
        <div className="teleprompter__scroll" ref={scrollRef}>
          {loading && <p className="creator-portal__muted">Генерирую сценарий…</p>}
          {error && (
            <div className="teleprompter__error">
              <p className="creator-portal__err">{error}</p>
              <button className="btn btn--ghost btn--sm" onClick={() => setAttempt((n) => n + 1)}>↻ Попробовать снова</button>
            </div>
          )}
          {!loading && !error && (
            <p className="teleprompter__text" style={{ fontSize: `${fontSize}px` }}>{script}</p>
          )}
        </div>
      </div>
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
