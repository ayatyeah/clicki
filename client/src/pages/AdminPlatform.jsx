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

      <div className="admin-table-wrap" style={{ marginTop: 16 }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Бриф</th>
              <th>Платформа</th>
              <th>Требования</th>
              <th>Статус</th>
              <th>Назначить креатору</th>
            </tr>
          </thead>
          <tbody>
            {briefs.map((b) => (
              <tr key={b.id}>
                <td><b>{b.title}</b></td>
                <td>{b.platform}</td>
                <td style={{ fontSize: '0.85rem' }}>
                  {b.req_hashtag ? `${b.req_hashtag} ` : ''}
                  {b.req_mention ? '· упоминание ' : ''}
                  {b.duration_min}-{b.duration_max}с
                </td>
                <td>{b.status}</td>
                <td>
                  <select defaultValue="" onChange={(e) => assign(b.id, e.target.value)}>
                    <option value="">— выбрать —</option>
                    {creators.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
            {!briefs.length && (
              <tr><td colSpan={5} className="admin-table__empty">Брифов пока нет</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ---------------- Video review ---------------- */
export function ReviewView({ authFetch }) {
  const [subs, setSubs] = useState([]);
  const load = async () => {
    const r = await (await authFetch('/api/admin/submissions')).json();
    setSubs(r.submissions || []);
  };
  useEffect(() => {
    load();
  }, []); // eslint-disable-line

  const review = async (id, status, reject_code, checklist) => {
    await authFetch(`/api/admin/submissions/${id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, reject_code, checklist }),
    });
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
        <button className="btn btn--ghost btn--sm" onClick={exportCsv}>Экспорт CSV</button>
      </div>
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
                <td>
                  <b>{s.creator_name || `#${s.creator_id}`}</b>
                  <div style={{ color: 'var(--fog)', fontSize: '0.85rem' }}>{s.brief_title || 'без брифа'}</div>
                </td>
                <td>
                  <a href={s.video_url} target="_blank" rel="noreferrer">ссылка</a>
                  <div style={{ fontSize: '0.8rem', color: 'var(--fog)' }}>{s.platform} · {s.published_at || '—'}</div>
                  {s.rights_confirmed ? <span style={{ color: '#6ee7a8', fontSize: '0.8rem' }}>права ✓</span> : <span style={{ color: '#f59e0b', fontSize: '0.8rem' }}>права ✗</span>}
                </td>
                <td>
                  <ReviewActions
                    submission={s}
                    onAccept={(cl) => review(s.id, 'accepted', null, cl)}
                    onRework={(cl) => review(s.id, 'rework', null, cl)}
                    onReject={(code, cl) => review(s.id, 'rejected', code, cl)}
                  />
                </td>
                <td>
                  <ViewsCell submission={s} onSave={setViews} />
                </td>
                <td>
                  <span className={`pf-status pf-status--${s.status}`}>{s.status}</span>
                  {s.reject_code && <div style={{ fontSize: '0.78rem', color: 'var(--fog)' }}>{s.reject_code}</div>}
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

function ReviewActions({ submission, onAccept, onRework, onReject }) {
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
      <button className="btn btn--primary btn--sm" onClick={() => onAccept(checks)}>Принять</button>
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
  const load = async () => {
    const r = await (await authFetch('/api/admin/creators')).json();
    setCreators(r.creators || []);
  };
  useEffect(() => {
    load();
  }, []); // eslint-disable-line

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
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Креатор</th>
              <th>Контакт</th>
              <th>Онбординг</th>
              <th>XP / Trust / Стрик</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {creators.map((c) => (
              <tr key={c.id}>
                <td>
                  <b>{c.name}</b> {c.founding && <span className="pf-badge">Founding</span>}
                  <div style={{ fontSize: '0.8rem', color: 'var(--fog)' }}>{c.socials || ''}</div>
                </td>
                <td>{c.contact}</td>
                <td>{c.onboarding_passed ? '✓' : '—'}</td>
                <td>{c.xp} / {c.trust_score} / {c.streak}🔥</td>
                <td>
                  <select value={c.status} onChange={(e) => toggle(c.id, 'status', e.target.value)}>
                    <option value="active">active</option>
                    <option value="paused">paused</option>
                    <option value="banned">banned</option>
                  </select>
                </td>
              </tr>
            ))}
            {!creators.length && <tr><td colSpan={5} className="admin-table__empty">Креаторов пока нет</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
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
                <td>{p.creator_name || `#${p.creator_id}`}</td>
                <td>{Number(p.amount).toLocaleString('ru-RU')} ₸</td>
                <td><span className={`pf-status pf-status--${p.status}`}>{p.status}</span></td>
                <td>{p.status !== 'paid' && <button className="btn btn--ghost btn--sm" onClick={() => markPaid(p.id)}>Отметить оплату</button>}</td>
              </tr>
            ))}
            {!payouts.length && <tr><td colSpan={4} className="admin-table__empty">Выплат пока нет</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
