import { useState, useEffect } from 'react';

const PLATFORMS = ['TikTok', 'Instagram Reels', 'YouTube Shorts', 'Threads', 'X (Twitter)'];

/* ---------------- Briefs ---------------- */
export function BriefsView({ authFetch }) {
  const [briefs, setBriefs] = useState([]);
  const [creators, setCreators] = useState([]);
  const [form, setForm] = useState({ title: '', platform: 'TikTok', duration_min: 15, duration_max: 90, slots: 5 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    const b = await (await authFetch('/api/admin/briefs')).json();
    setBriefs(b.briefs || []);
    const c = await (await authFetch('/api/admin/creators')).json();
    setCreators(c.creators || []);
  };
  useEffect(() => {
    load();
  }, []); // eslint-disable-line

  const check = async (res) => {
    if (res.ok) return true;
    const data = await res.json().catch(() => ({}));
    setError((data.errors && data.errors[0]) || 'Не удалось выполнить действие');
    return false;
  };

  const create = async () => {
    if (!form.title) return;
    setBusy(true);
    setError('');
    const res = await authFetch('/api/admin/briefs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setBusy(false);
    if (!(await check(res))) return;
    setForm({ title: '', platform: 'TikTok', duration_min: 15, duration_max: 90, slots: 5 });
    load();
  };
  const setF = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <section className="admin-block">
      <h2 className="admin-block__title">Брифы</h2>
      {error && <p className="creator-portal__err">{error}</p>}
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
