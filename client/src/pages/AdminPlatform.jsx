import { useEffect, useState } from 'react';

/* Operator CRM views (ТЗ §13): briefs, video review, creators, payouts.
   Each view manages its own data via the passed authFetch. */

const PLATFORMS = ['TikTok', 'Instagram Reels', 'YouTube Shorts', 'Threads', 'X (Twitter)'];
const REJECT_CODES = [
  { code: 'no_hashtag', label: 'Нет хэштега' },
  { code: 'no_mention', label: 'Нет упоминания бренда' },
  { code: 'duration', label: 'Хронометраж вне диапазона' },
  { code: 'no_cta', label: 'Нет CTA-ссылки' },
  { code: 'quality', label: 'Низкое качество' },
  { code: 'other', label: 'Другое' },
];

const STAR_D = 'M12 2.6l2.85 5.77 6.37.93-4.61 4.49 1.09 6.35L12 17.77l-5.7 3l1.09-6.35-4.61-4.49 6.37-.93z';
/** 5-star rating with fractional fill (0–5). */
function Stars({ value = 0 }) {
  return (
    <span className="stars" title={`${Number(value).toFixed(1)} из 5`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const f = Math.max(0, Math.min(1, value - i));
        return (
          <span key={i} className="star">
            <svg className="star__bg" viewBox="0 0 24 24" aria-hidden="true"><path d={STAR_D} /></svg>
            <svg className="star__fg" viewBox="0 0 24 24" aria-hidden="true" style={{ clipPath: `inset(0 ${100 - f * 100}% 0 0)` }}><path d={STAR_D} /></svg>
          </span>
        );
      })}
      <span className="stars__num">{Number(value).toFixed(1)}</span>
    </span>
  );
}

/* Minimal markdown render for Gemini output (bold + bullets). */
function AiMd({ text }) {
  return (
    <div className="ai-md">
      {String(text || '')
        .split('\n')
        .map((line, i) => {
          if (!line.trim()) return <div key={i} className="ai-md__gap" />;
          const bullet = /^\s*[-*•]\s+/.test(line);
          const content = line.replace(/^\s*[-*•]\s+/, '');
          const parts = content.split(/(\*\*[^*]+\*\*)/g).map((p, j) =>
            /^\*\*[^*]+\*\*$/.test(p) ? <strong key={j}>{p.slice(2, -2)}</strong> : <span key={j}>{p}</span>
          );
          return bullet ? (
            <div key={i} className="ai-md__li">{parts}</div>
          ) : (
            <p key={i} className="ai-md__p">{parts}</p>
          );
        })}
    </div>
  );
}

/* ---------------- AI analysis (Gemini, cached) ---------------- */
export function AiAnalysisView({ authFetch }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const load = async (refresh) => {
    setLoading(true);
    try {
      const r = await (await authFetch(`/api/admin/ai-analysis${refresh ? '?refresh=1' : ''}`)).json();
      setData(r);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load(false);
  }, []); // eslint-disable-line

  return (
    <section className="admin-block">
      <div className="admin-panel__head">
        <h2 className="admin-block__title">ИИ Аналитика</h2>
        <button className="btn btn--ghost btn--sm" onClick={() => load(true)} disabled={loading}>
          {loading ? 'Анализирую…' : 'Обновить'}
        </button>
      </div>
      {!data ? (
        <p className="muted-note">Загрузка…</p>
      ) : !data.enabled ? (
        <div className="admin-placeholder">Gemini не настроен — добавьте ключи GEMINI_API_KEY в окружение сервера.</div>
      ) : (
        <>
          <div className="ai-card">
            <AiMd text={data.analysis} />
          </div>
          <p className="muted-note">
            {data.cached ? 'из кэша (экономия запросов)' : 'свежий анализ'}
            {data.at ? ` · ${new Date(data.at).toLocaleString('ru-RU')}` : ''}
          </p>
        </>
      )}
    </section>
  );
}

/* ---------------- Briefs ---------------- */
export function BriefsView({ authFetch }) {
  const [briefs, setBriefs] = useState([]);
  const [creators, setCreators] = useState([]);
  const [form, setForm] = useState({ title: '', platform: 'TikTok', duration_min: 15, duration_max: 90, slots: 5 });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const b = await (await authFetch('/api/admin/briefs')).json();
    setBriefs(b.briefs || []);
    const c = await (await authFetch('/api/admin/creators')).json();
    setCreators(c.creators || []);
  };
  useEffect(() => {
    load();
  }, []); // eslint-disable-line

  const create = async () => {
    if (!form.title) return;
    setBusy(true);
    await authFetch('/api/admin/briefs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setForm({ title: '', platform: 'TikTok', duration_min: 15, duration_max: 90, slots: 5 });
    setBusy(false);
    load();
  };
  const assign = async (briefId, creatorId) => {
    if (!creatorId) return;
    await authFetch(`/api/admin/briefs/${briefId}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creator_id: Number(creatorId) }),
    });
    load();
  };
  const publish = async (briefId) => {
    await authFetch(`/api/admin/briefs/${briefId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    });
    load();
  };
  const setF = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <section className="admin-block">
      <h2 className="admin-block__title">Брифы</h2>
      <div className="pf-form">
        <input placeholder="Название брифа" value={form.title} onChange={(e) => setF('title', e.target.value)} />
        <select value={form.platform} onChange={(e) => setF('platform', e.target.value)}>
          {PLATFORMS.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <input placeholder="Хэштег (#...)" value={form.req_hashtag || ''} onChange={(e) => setF('req_hashtag', e.target.value)} />
        <input placeholder="CTA-ссылка" value={form.req_cta_link || ''} onChange={(e) => setF('req_cta_link', e.target.value)} />
        <input placeholder="Ключевое сообщение" value={form.key_message || ''} onChange={(e) => setF('key_message', e.target.value)} />
        <label className="pf-check">
          <input type="checkbox" checked={!!form.req_mention} onChange={(e) => setF('req_mention', e.target.checked)} /> упоминание бренда в первые 3 сек
        </label>
        <div className="pf-row">
          <input type="number" placeholder="мин сек" value={form.duration_min} onChange={(e) => setF('duration_min', +e.target.value)} />
          <input type="number" placeholder="макс сек" value={form.duration_max} onChange={(e) => setF('duration_max', +e.target.value)} />
          <input type="number" placeholder="слотов" value={form.slots} onChange={(e) => setF('slots', +e.target.value)} />
        </div>
        <button className="btn btn--primary btn--sm" onClick={create} disabled={busy}>
          {busy ? 'Создаю…' : 'Создать бриф'}
        </button>
      </div>

      <p className="muted-note" style={{ textAlign: 'left', marginTop: 16 }}>
        Бриф приходит от бизнеса «на модерацию». Прогони ИИ-анализ, затем опубликуй креаторам или верни бизнесу на доработку.
      </p>
      <div className="bp-cards" style={{ marginTop: 12 }}>
        {briefs.map((b) => (
          <BriefModCard key={b.id} b={b} authFetch={authFetch} creators={creators} onChange={load} />
        ))}
        {!briefs.length && <p className="muted-note" style={{ textAlign: 'left' }}>Брифов пока нет</p>}
      </div>
    </section>
  );
}

function BriefModCard({ b, authFetch, creators, onChange }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [showNote, setShowNote] = useState(false);
  const call = async (url, body) => {
    setBusy(true);
    try {
      await authFetch(url, { method: 'POST', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
      onChange();
    } finally {
      setBusy(false);
    }
  };
  const statusLabel =
    b.status === 'active' ? 'опубликован креаторам'
      : b.status === 'revision' ? 'у бизнеса на доработке'
      : b.status === 'new' ? 'на модерации'
      : b.status;
  const statusCls = b.status === 'active' ? 'accepted' : b.status === 'revision' ? 'rework' : 'pending';

  return (
    <div className="bp-card">
      <div className="bp-card__head">
        <b>{b.title}</b>
        <span className={`pf-status pf-status--${statusCls}`}>{statusLabel}</span>
      </div>
      <p className="creator-portal__muted" style={{ margin: 0 }}>
        {b.platform} · до {b.duration_max}с
        {b.req_hashtag ? ` · ${b.req_hashtag}` : ''}
        {b.spec?.style ? ` · ${b.spec.style}` : ''}
      </p>
      <div className="mod-panel">
        {b.ai_score != null && (
          <div className="mod-ai"><span className="mod-ai__score">ИИ: {b.ai_score}/100.</span> {b.ai_feedback}</div>
        )}
        {b.revision_note && <div className="mod-note">Возвращён бизнесу: {b.revision_note}</div>}
        <div className="mod-actions">
          <button className="btn btn--ghost btn--sm" disabled={busy} onClick={() => call(`/api/admin/briefs/${b.id}/ai`)}>ИИ-анализ</button>
          {b.status !== 'active' && (
            <button className="btn btn--primary btn--sm" disabled={busy} onClick={() => call(`/api/admin/briefs/${b.id}/status`, { status: 'active' })}>
              Опубликовать креаторам
            </button>
          )}
          <button className="btn btn--ghost btn--sm" disabled={busy} onClick={() => setShowNote((s) => !s)}>Вернуть бизнесу</button>
          <select defaultValue="" onChange={(e) => { if (e.target.value) { call(`/api/admin/briefs/${b.id}/assign`, { creator_id: Number(e.target.value) }); e.target.value = ''; } }}>
            <option value="">— назначить вручную —</option>
            {creators.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        {showNote && (
          <div className="mod-actions">
            <input placeholder="Что исправить бизнесу" value={note} onChange={(e) => setNote(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
            <button className="btn btn--primary btn--sm" disabled={busy || !note.trim()} onClick={() => { call(`/api/admin/briefs/${b.id}/revision`, { note }); setShowNote(false); setNote(''); }}>
              Отправить на доработку
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Video review ---------------- */
export function ReviewView({ authFetch }) {
  const [subs, setSubs] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const load = async () => {
    const r = await (await authFetch('/api/admin/submissions')).json();
    setSubs(r.submissions || []);
  };
  useEffect(() => {
    load();
  }, []); // eslint-disable-line

  const syncTikTok = async () => {
    setSyncing(true);
    setSyncMsg('');
    try {
      const r = await (await authFetch('/api/admin/tiktok/sync', { method: 'POST' })).json();
      setSyncMsg(r.ok ? `Обновлено видео: ${r.synced} (креаторов с TikTok: ${r.creators})` : (r.errors && r.errors[0]) || 'Не удалось синхронизировать');
      load();
    } finally {
      setSyncing(false);
    }
  };

  const review = async (id, status, reject_code, checklist) => {
    await authFetch(`/api/admin/submissions/${id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, reject_code, checklist }),
    });
    load();
  };
  const sendToBusiness = async (id) => {
    await authFetch(`/api/admin/submissions/${id}/send-to-business`, { method: 'POST' });
    load();
  };
  const exportCsv = async () => {
    const res = await authFetch('/api/admin/submissions/export');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'submissions.csv';
    a.click();
    URL.revokeObjectURL(url);
  };
  const setViews = async (id, views, final) => {
    await authFetch(`/api/admin/submissions/${id}/views`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ views: Number(views) || 0, final }),
    });
    load();
  };

  return (
    <section className="admin-block">
      <div className="admin-panel__head">
        <h2 className="admin-block__title">Видео на проверке</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn--ghost btn--sm" onClick={syncTikTok} disabled={syncing}>{syncing ? 'Синхронизирую…' : 'Синхронизировать TikTok'}</button>
          <button className="btn btn--ghost btn--sm" onClick={exportCsv}>Экспорт CSV</button>
        </div>
      </div>
      {syncMsg && <p className="muted-note" style={{ textAlign: 'left' }}>{syncMsg}</p>}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Креатор / бриф</th>
              <th>Видео</th>
              <th>Чек-лист</th>
              <th>Просмотры</th>
              <th>Решение</th>
            </tr>
          </thead>
          <tbody>
            {subs.map((s) => (
              <tr key={s.id}>
                <td data-label="Креатор / бриф">
                  <b>{s.creator_name || `#${s.creator_id}`}</b>
                  <div style={{ color: 'var(--fog)', fontSize: '0.85rem' }}>{s.brief_title || 'без брифа'}</div>
                </td>
                <td data-label="Видео">
                  <a href={s.video_url} target="_blank" rel="noreferrer">ссылка</a>
                  <div style={{ fontSize: '0.8rem', color: 'var(--fog)' }}>{s.platform} · {s.published_at || '—'}</div>
                  {s.rights_confirmed ? <span style={{ color: '#6ee7a8', fontSize: '0.8rem' }}>права ✓</span> : <span style={{ color: '#f59e0b', fontSize: '0.8rem' }}>права ✗</span>}
                </td>
                <td data-label="Чек-лист">
                  <ReviewActions
                    submission={s}
                    onSend={() => sendToBusiness(s.id)}
                    onRework={(cl) => review(s.id, 'rework', null, cl)}
                    onReject={(code, cl) => review(s.id, 'rejected', code, cl)}
                  />
                </td>
                <td data-label="Просмотры">
                  <ViewsCell submission={s} onSave={setViews} />
                </td>
                <td data-label="Решение">
                  <span className={`pf-status pf-status--${s.status}`}>{STATUS_RU[s.status] || s.status}</span>
                  {s.ai_score != null && <div className="ai-score">AI: {s.ai_score}/100</div>}
                  {s.ai_feedback && <div style={{ fontSize: '0.76rem', color: 'var(--fog)', marginTop: 2 }}>{s.ai_feedback}</div>}
                  {s.reject_code && <div style={{ fontSize: '0.78rem', color: 'var(--fog)' }}>{s.reject_code}</div>}
                  {s.fraud?.suspicious && (
                    <div className="fraud-flag" title={s.fraud.reasons.join('; ')}>
                      ⚠️ Подозрительный рост
                      <div className="fraud-flag__reasons">{s.fraud.reasons.join('; ')}</div>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {!subs.length && <tr><td colSpan={5} className="admin-table__empty">Нет сдач видео</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const STATUS_RU = {
  ai_check: 'AI-проверка',
  ai_passed: 'прошло AI',
  rework: 'на доработку',
  sent_to_business: 'у бизнеса',
  accepted: 'принято',
  rejected: 'отклонено',
  pending: 'ожидает',
  paid: 'оплачено',
};

function ReviewActions({ submission, onSend, onRework, onReject }) {
  // Structured checklist from the brief's binary requirements (ТЗ §9.2)
  const reqs = [];
  if (submission.req_hashtag) reqs.push(['hashtag', `Хэштег ${submission.req_hashtag}`]);
  if (submission.req_mention) reqs.push(['mention', 'Упоминание в 3 сек']);
  if (submission.req_cta_link) reqs.push(['cta', 'CTA-ссылка']);
  reqs.push(['duration', `Хронометраж ${submission.duration_min}-${submission.duration_max}с`]);

  const [checks, setChecks] = useState({});
  const [code, setCode] = useState('no_hashtag');
  const toggle = (k) => setChecks((c) => ({ ...c, [k]: !c[k] }));

  return (
    <div className="pf-actions">
      <div className="pf-checklist">
        {reqs.map(([k, label]) => (
          <label key={k} className="pf-check">
            <input type="checkbox" checked={!!checks[k]} onChange={() => toggle(k)} /> {label}
          </label>
        ))}
      </div>
      <button className="btn btn--primary btn--sm" onClick={() => onSend(checks)}>Отправить бизнесу</button>
      <button className="btn btn--ghost btn--sm" onClick={() => onRework(checks)}>Доработка</button>
      <div className="pf-row">
        <select value={code} onChange={(e) => setCode(e.target.value)}>
          {REJECT_CODES.map((r) => (
            <option key={r.code} value={r.code}>{r.label}</option>
          ))}
        </select>
        <button className="btn btn--ghost btn--sm" onClick={() => onReject(code, checks)}>Отклонить</button>
      </div>
    </div>
  );
}

function ViewsCell({ submission, onSave }) {
  const [views, setViews] = useState(submission.views || 0);
  const [final, setFinal] = useState(!!submission.views_final);
  return (
    <div className="pf-actions">
      <input type="number" value={views} onChange={(e) => setViews(e.target.value)} style={{ width: 90 }} />
      <label className="pf-check" style={{ fontSize: '0.78rem' }}>
        <input type="checkbox" checked={final} onChange={(e) => setFinal(e.target.checked)} /> 30-дн финал
      </label>
      <button className="btn btn--ghost btn--sm" onClick={() => onSave(submission.id, views, final)}>Сохранить</button>
    </div>
  );
}

/* ---------------- Creators ---------------- */
export function CreatorsView({ authFetch }) {
  const [creators, setCreators] = useState([]);
  const [form, setForm] = useState({ name: '', contact: '', username: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = async () => {
    const r = await (await authFetch('/api/admin/creators')).json();
    setCreators(r.creators || []);
  };
  useEffect(() => {
    load();
  }, []); // eslint-disable-line
  const setF = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  const create = async () => {
    if (!form.name) return;
    setBusy(true);
    setError('');
    const res = await authFetch('/api/admin/creators', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) return setError((d.errors && d.errors[0]) || 'Ошибка');
    setForm({ name: '', contact: '', username: '', password: '' });
    load();
  };

  const toggle = async (id, field, value) => {
    await authFetch(`/api/admin/creators/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    });
    load();
  };

  return (
    <section className="admin-block">
      <h2 className="admin-block__title">Креаторы ({creators.length})</h2>
      <p className="muted-note" style={{ textAlign: 'left', marginTop: 0 }}>
        Создай аккаунт креатору (выдай логин и пароль) — под этими данными он войдёт в кабинет.
        Заявки с сайта приходят со статусом <b>pending</b>: выдай им доступ кнопкой «Выдать».
      </p>
      <div className="pf-form">
        <input placeholder="Имя" value={form.name} onChange={(e) => setF('name', e.target.value)} />
        <input placeholder="Телефон / Telegram" value={form.contact} onChange={(e) => setF('contact', e.target.value)} />
        <div className="pf-row">
          <input placeholder="Логин (мин. 3)" value={form.username} onChange={(e) => setF('username', e.target.value)} />
          <input placeholder="Пароль (мин. 6)" value={form.password} onChange={(e) => setF('password', e.target.value)} />
        </div>
        {error && <p className="creator-portal__err" style={{ margin: 0 }}>{error}</p>}
        <button className="btn btn--primary btn--sm" onClick={create} disabled={busy}>
          {busy ? 'Создаю…' : 'Создать креатора'}
        </button>
      </div>

      <div className="admin-table-wrap" style={{ marginTop: 16 }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Креатор</th>
              <th>Рейтинг</th>
              <th>Контакт</th>
              <th>Доступ (логин)</th>
              <th>XP / Trust / Стрик</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {creators.map((c) => (
              <tr key={c.id}>
                <td data-label="Креатор">
                  <b>{c.name}</b> {c.founding && <span className="pf-badge">Founding</span>}
                  <div style={{ fontSize: '0.8rem', color: 'var(--fog)' }}>{c.socials || ''}</div>
                </td>
                <td data-label="Рейтинг"><Stars value={c.rating || 0} /></td>
                <td data-label="Контакт">{c.contact}</td>
                <td data-label="Доступ">
                  <Credentials creator={c} authFetch={authFetch} onSaved={load} />
                </td>
                <td data-label="XP / Trust / Стрик">{c.xp} / {c.trust_score} / {c.streak}</td>
                <td data-label="Статус">
                  <select value={c.status} onChange={(e) => toggle(c.id, 'status', e.target.value)}>
                    <option value="pending">pending</option>
                    <option value="active">active</option>
                    <option value="paused">paused</option>
                    <option value="banned">banned</option>
                  </select>
                </td>
              </tr>
            ))}
            {!creators.length && <tr><td colSpan={6} className="admin-table__empty">Креаторов пока нет</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Credentials({ creator, authFetch, onSaved }) {
  const [open, setOpen] = useState(false);
  const [u, setU] = useState(creator.username || '');
  const [p, setP] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const save = async () => {
    setBusy(true);
    setErr('');
    const res = await authFetch(`/api/admin/creators/${creator.id}/credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p }),
    });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) return setErr((d.errors && d.errors[0]) || 'Ошибка');
    setP('');
    setOpen(false);
    onSaved();
  };

  if (!open) {
    return (
      <div className="pf-actions">
        {creator.username ? (
          <span style={{ fontSize: '0.85rem' }}>{creator.username}</span>
        ) : (
          <span style={{ fontSize: '0.82rem', color: 'var(--fog)' }}>нет доступа</span>
        )}
        <button className="btn btn--ghost btn--sm" onClick={() => setOpen(true)}>
          {creator.username ? 'Сменить пароль' : 'Выдать'}
        </button>
      </div>
    );
  }
  return (
    <div className="pf-actions">
      <input placeholder="Логин" value={u} onChange={(e) => setU(e.target.value)} />
      <input type="text" placeholder="Новый пароль" value={p} onChange={(e) => setP(e.target.value)} />
      {err && <span className="creator-portal__err" style={{ fontSize: '0.78rem' }}>{err}</span>}
      <div className="pf-row">
        <button className="btn btn--primary btn--sm" onClick={save} disabled={busy}>{busy ? '…' : 'Сохранить'}</button>
        <button className="btn btn--ghost btn--sm" onClick={() => setOpen(false)}>Отмена</button>
      </div>
    </div>
  );
}

/* ---------------- Payouts ---------------- */
export function PayoutsView({ authFetch }) {
  const [payouts, setPayouts] = useState([]);
  const [creators, setCreators] = useState([]);
  const [form, setForm] = useState({ creator_id: '', amount: '' });
  const load = async () => {
    const p = await (await authFetch('/api/admin/payouts')).json();
    setPayouts(p.payouts || []);
    const c = await (await authFetch('/api/admin/creators')).json();
    setCreators(c.creators || []);
  };
  useEffect(() => {
    load();
  }, []); // eslint-disable-line

  const create = async () => {
    if (!form.creator_id || !form.amount) return;
    await authFetch('/api/admin/payouts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creator_id: Number(form.creator_id), amount: Number(form.amount) }),
    });
    setForm({ creator_id: '', amount: '' });
    load();
  };
  const markPaid = async (id) => {
    await authFetch(`/api/admin/payouts/${id}/paid`, { method: 'POST' });
    load();
  };

  return (
    <section className="admin-block">
      <h2 className="admin-block__title">Выплаты (Kaspi, вручную)</h2>
      <div className="pf-form pf-form--row">
        <select value={form.creator_id} onChange={(e) => setForm((f) => ({ ...f, creator_id: e.target.value }))}>
          <option value="">— креатор —</option>
          {creators.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <input type="number" placeholder="Сумма ₸" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
        <button className="btn btn--primary btn--sm" onClick={create}>Создать выплату</button>
      </div>
      <div className="admin-table-wrap" style={{ marginTop: 16 }}>
        <table className="admin-table">
          <thead>
            <tr><th>Креатор</th><th>Сумма</th><th>Статус</th><th></th></tr>
          </thead>
          <tbody>
            {payouts.map((p) => (
              <tr key={p.id}>
                <td data-label="Креатор">{p.creator_name || `#${p.creator_id}`}</td>
                <td data-label="Сумма">{Number(p.amount).toLocaleString('ru-RU')} ₸</td>
                <td data-label="Статус"><span className={`pf-status pf-status--${p.status}`}>{p.status}</span></td>
                <td data-label="">{p.status !== 'paid' && <button className="btn btn--ghost btn--sm" onClick={() => markPaid(p.id)}>Отметить оплату</button>}</td>
              </tr>
            ))}
            {!payouts.length && <tr><td colSpan={4} className="admin-table__empty">Выплат пока нет</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ---------------- Decision journal ----------------
   Not AI itself — the raw log every accept/reject/rework call writes, one row
   per decision: what happened, why, how many views it had, how long it took.
   The foundation any future "smart" model would need to learn from. */
function formatSeconds(s) {
  if (s == null) return '—';
  if (s < 3600) return `${Math.round(s / 60)} мин`;
  if (s < 86400) return `${(s / 3600).toFixed(1)} ч`;
  return `${(s / 86400).toFixed(1)} дн`;
}
const DECISION_RU = { accepted: 'принято', rejected: 'отклонено', rework: 'на доработку' };
export function DecisionJournalView({ authFetch }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const load = async () => {
    setLoading(true);
    try {
      const r = await (await authFetch('/api/admin/decisions')).json();
      setRows(r.decisions || []);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []); // eslint-disable-line

  return (
    <section className="admin-block">
      <div className="admin-panel__head">
        <h2 className="admin-block__title">Дневник решений</h2>
        <button className="btn btn--ghost btn--sm" onClick={load} disabled={loading}>{loading ? 'Обновляю…' : 'Обновить'}</button>
      </div>
      <p className="muted-note" style={{ textAlign: 'left', marginTop: 0 }}>
        Каждое решение по видео записывается сюда автоматически: что было, почему, сколько просмотров, как быстро. Это ещё не ИИ — это данные, на которых он однажды сможет учиться.
      </p>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Креатор / бриф</th>
              <th>Решение</th>
              <th>Причина</th>
              <th>Просмотры на момент решения</th>
              <th>Время до решения</th>
              <th>Когда</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id}>
                <td data-label="Креатор / бриф">
                  <b>{d.creator_name || `#${d.creator_id}`}</b>
                  <div style={{ color: 'var(--fog)', fontSize: '0.85rem' }}>{d.brief_title || 'без брифа'}</div>
                </td>
                <td data-label="Решение"><span className={`pf-status pf-status--${d.status}`}>{DECISION_RU[d.status] || d.status}</span></td>
                <td className="muted-cell" data-label="Причина">{d.reject_code || '—'}</td>
                <td className="muted-cell" data-label="Просмотры на момент решения">{(d.views_at_decision || 0).toLocaleString('ru-RU')}</td>
                <td className="muted-cell" data-label="Время до решения">{formatSeconds(d.seconds_to_decision)}</td>
                <td className="muted-cell" data-label="Когда">{new Date(d.decided_at).toLocaleString('ru-RU')}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={6} className="admin-table__empty">Пока нет решений</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
