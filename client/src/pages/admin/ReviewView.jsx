import { useState, useEffect, useRef } from 'react';
import { safeHref } from '../../lib/safeHref.js';

const REJECT_CODES = [
  { code: 'no_hashtag', label: 'Нет хэштега' },
  { code: 'no_mention', label: 'Нет упоминания бренда' },
  { code: 'duration', label: 'Хронометраж вне диапазона' },
  { code: 'no_cta', label: 'Нет CTA-ссылки' },
  { code: 'quality', label: 'Низкое качество' },
  { code: 'other', label: 'Другое' },
];

/* ---------------- Video review ---------------- */
export function ReviewView({ authFetch }) {
  const [subs, setSubs] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [error, setError] = useState('');
  const load = async () => {
    const r = await (await authFetch('/api/admin/submissions')).json();
    setSubs(r.submissions || []);
  };
  useEffect(() => {
    load();
    const id = setInterval(load, 20000); // live: picks up TikTok auto-sync without a manual refresh
    return () => clearInterval(id);
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

  // Every mutation below shares this: check res.ok, surface the server's
  // error message instead of silently reloading as if nothing went wrong.
  const post = async (url, body) => {
    setError('');
    const res = await authFetch(url, {
      method: 'POST',
      ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
      setError((data.errors && data.errors[0]) || 'Не удалось выполнить действие');
      return false;
    }
    return true;
  };

  const review = async (id, status, reject_code, checklist) => {
    if (await post(`/api/admin/submissions/${id}/review`, { status, reject_code, checklist })) load();
  };
  const sendToBusiness = async (id, checklist) => {
    if (await post(`/api/admin/submissions/${id}/send-to-business`, checklist ? { checklist } : undefined)) load();
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
    if (await post(`/api/admin/submissions/${id}/views`, { views: Number(views) || 0, final })) load();
  };
  const [coachBusyId, setCoachBusyId] = useState(null);
  const regenerateCoach = async (id) => {
    setCoachBusyId(id);
    try {
      await post(`/api/admin/submissions/${id}/coach`);
      load();
    } finally {
      setCoachBusyId(null);
    }
  };

  return (
    <section className="admin-block">
      <div className="admin-panel__head">
        <h2 className="admin-block__title">Видео на проверке <span className="an-live">● live</span></h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn--ghost btn--sm" onClick={syncTikTok} disabled={syncing}>{syncing ? 'Синхронизирую…' : 'Синхронизировать TikTok'}</button>
          <button className="btn btn--ghost btn--sm" onClick={exportCsv}>Экспорт CSV</button>
        </div>
      </div>
      {error && <p className="lead-form__errors" role="alert">{error}</p>}
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
                  <a href={safeHref(s.video_url)} target="_blank" rel="noreferrer">ссылка</a>
                  <div style={{ fontSize: '0.8rem', color: 'var(--fog)' }}>{s.platform} · {s.published_at || '—'}</div>
                  {s.rights_confirmed ? <span style={{ color: '#6ee7a8', fontSize: '0.8rem' }}>права ✓</span> : <span style={{ color: '#f59e0b', fontSize: '0.8rem' }}>права ✗</span>}
                </td>
                <td data-label="Чек-лист">
                  <ReviewActions
                    submission={s}
                    onSend={(cl) => sendToBusiness(s.id, cl)}
                    onRework={(cl) => review(s.id, 'rework', null, cl)}
                    onReject={(code, cl) => review(s.id, 'rejected', code, cl)}
                  />
                </td>
                <td data-label="Просмотры">
                  <ViewsCell submission={s} onSave={setViews} />
                  <ViewSparkline history={s.views_history} />
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
                  {(s.status === 'accepted' || s.status === 'rejected') && (
                    <div style={{ marginTop: 6 }}>
                      {s.coach_feedback ? (
                        <div style={{ fontSize: '0.76rem', color: 'var(--fog)' }}>🎯 {s.coach_feedback}</div>
                      ) : (
                        <div style={{ fontSize: '0.76rem', color: 'var(--fog)' }}>🎯 AI-коуч не сгенерирован</div>
                      )}
                      <button
                        className="btn btn--ghost btn--sm"
                        style={{ marginTop: 4 }}
                        disabled={coachBusyId === s.id}
                        onClick={() => regenerateCoach(s.id)}
                      >
                        {coachBusyId === s.id ? 'Генерирую…' : '↻ Пересоздать AI-коуч'}
                      </button>
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

  // Once a video is accepted or rejected, the server rejects further
  // transitions anyway (send-to-business is guarded) — hide the actions here
  // too so an operator can't even try to re-queue an already-paid submission.
  if (submission.status === 'accepted' || submission.status === 'rejected') {
    return <p className="muted-note" style={{ margin: 0, textAlign: 'left' }}>Решение принято, действия недоступны.</p>;
  }

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
  const focused = useRef(false);
  // Pick up server-side changes (manual save, TikTok auto-sync, live poll) — but
  // never clobber a value the operator is actively typing.
  useEffect(() => {
    if (focused.current) return;
    setViews(submission.views || 0);
    setFinal(!!submission.views_final);
  }, [submission.views, submission.views_final]);
  return (
    <div className="pf-actions">
      <input
        type="number"
        value={views}
        onFocus={() => { focused.current = true; }}
        onBlur={() => { focused.current = false; }}
        onChange={(e) => setViews(e.target.value)}
        style={{ width: 90 }}
      />
      <label className="pf-check" style={{ fontSize: '0.78rem' }}>
        <input type="checkbox" checked={final} onChange={(e) => setFinal(e.target.checked)} /> 30-дн финал
      </label>
      <button className="btn btn--ghost btn--sm" onClick={() => onSave(submission.id, views, final)}>Сохранить</button>
    </div>
  );
}

/** Compact live trend of a single video's view-count history (from view_snapshots). */
function ViewSparkline({ history }) {
  if (!history || history.length < 2) {
    return <div className="view-spark view-spark--empty">пока нет истории</div>;
  }
  const W = 110, H = 28, PAD = 4;
  const maxV = Math.max(...history.map((p) => p.views), 1);
  const x = (i) => PAD + ((W - PAD * 2) * i) / (history.length - 1);
  const y = (v) => PAD + (H - PAD * 2) - ((H - PAD * 2) * v) / maxV;
  const path = history.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.views).toFixed(1)}`).join(' ');
  const last = history[history.length - 1];
  return (
    <svg className="view-spark" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Динамика просмотров, сейчас ${last.views.toLocaleString('ru-RU')}`}>
      <title>{history.map((p) => `${p.at}: ${p.views.toLocaleString('ru-RU')}`).join('\n')}</title>
      <path d={path} className="view-spark__line" />
      <circle cx={x(history.length - 1)} cy={y(last.views)} r="2.5" className="view-spark__dot" />
    </svg>
  );
}
