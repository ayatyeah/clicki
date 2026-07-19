import { useState, useEffect, useMemo } from 'react';
import { safeHref } from '../../lib/safeHref.js';
import StatScreenshots from '../../components/StatScreenshots.jsx';

/**
 * Brief-centric video review (Проверка по брифам). A three-level drill-down the
 * operator asked for:
 *   1. list of briefs → 2. everyone who took that brief → 3. one creator's video(s)
 *      for it, with summed views, a view-trend, on-demand AI analysis, and the
 *      daily stats screenshots.
 *
 * It's an inspection surface (view + count + AI + screenshots), separate from the
 * accept/reject pipeline in «Проверка видео». All data comes from endpoints that
 * already exist — /api/admin/briefs, /api/admin/submissions, the per-brief takers
 * list, and the new /submissions/:id/ai re-run.
 */
const SUB_STATUS_RU = {
  ai_check: 'AI-проверка', ai_passed: 'на проверке', rework: 'на доработку',
  sent_to_business: 'у бизнеса', accepted: 'принято', rejected: 'отклонено',
  pending: 'ожидает', paid: 'оплачено',
};

/** Seconds → "2 ч 15 мин" / "40 мин" / "30 сек" — take→submit time. */
function humanDuration(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  if (s < 60) return `${s} сек`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h} ч ${rem} мин` : `${h} ч`;
}

/** Compact live trend of one video's views (from view_snapshots). */
function ViewSparkline({ history }) {
  if (!history || history.length < 2) return <span className="view-spark view-spark--empty">нет истории</span>;
  const W = 120, H = 30, PAD = 4;
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

export function BriefReviewView({ authFetch }) {
  const [briefs, setBriefs] = useState([]);
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [selBriefId, setSelBriefId] = useState(null);
  const [selCreatorId, setSelCreatorId] = useState(null);
  const [takers, setTakers] = useState(null);
  const [takersLoading, setTakersLoading] = useState(false);
  const [aiBusy, setAiBusy] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [bR, sR] = await Promise.all([
        authFetch('/api/admin/briefs').then((r) => r.json()),
        authFetch('/api/admin/submissions').then((r) => r.json()),
      ]);
      if (bR.ok === false || sR.ok === false) throw new Error(bR.errors?.[0] || sR.errors?.[0] || 'Ошибка');
      setBriefs(bR.briefs || []);
      setSubs(sR.submissions || []);
      setErr('');
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line

  // Load the takers list only when a brief is opened.
  useEffect(() => {
    if (selBriefId == null) { setTakers(null); return; }
    let alive = true;
    setTakersLoading(true);
    authFetch(`/api/admin/briefs/${selBriefId}/takers`)
      .then((r) => r.json())
      .then((d) => { if (alive) setTakers(d.takers || []); })
      .catch(() => { if (alive) setTakers([]); })
      .finally(() => { if (alive) setTakersLoading(false); });
    return () => { alive = false; };
  }, [selBriefId, authFetch]);

  // brief_id → its submissions
  const subsByBrief = useMemo(() => {
    const m = new Map();
    for (const s of subs) {
      if (s.brief_id == null) continue;
      if (!m.has(s.brief_id)) m.set(s.brief_id, []);
      m.get(s.brief_id).push(s);
    }
    return m;
  }, [subs]);

  const selBrief = briefs.find((b) => b.id === selBriefId) || null;

  const runAi = async (submissionId) => {
    setAiBusy(submissionId);
    try {
      const r = await authFetch(`/api/admin/submissions/${submissionId}/ai`, { method: 'POST' });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.submission) {
        setSubs((prev) => prev.map((s) => (s.id === submissionId
          ? { ...s, ai_score: d.submission.ai_score, ai_feedback: d.submission.ai_feedback }
          : s)));
      }
    } finally {
      setAiBusy(null);
    }
  };

  // ---- Level 3: one creator's videos for the selected brief ----
  if (selBrief && selCreatorId != null) {
    const mine = (subsByBrief.get(selBriefId) || []).filter((s) => s.creator_id === selCreatorId);
    const creatorName = mine[0]?.creator_name
      || (takers || []).find((t) => t.creator_id === selCreatorId)?.creator_name
      || `#${selCreatorId}`;
    const totalViews = mine.reduce((sum, s) => sum + (s.views || 0), 0);
    return (
      <section className="admin-block">
        <Breadcrumb
          trail={[
            { label: 'Брифы', onClick: () => { setSelBriefId(null); setSelCreatorId(null); } },
            { label: selBrief.title, onClick: () => setSelCreatorId(null) },
            { label: creatorName },
          ]}
        />
        <h2 className="admin-block__title">{creatorName}</h2>
        <p className="muted-note" style={{ textAlign: 'left', marginTop: 0 }}>
          По брифу «{selBrief.title}» · видео: {mine.length} · всего просмотров: <b>{totalViews.toLocaleString('ru-RU')}</b>
        </p>
        {!mine.length && <p className="admin-table__empty">Этот креатор ещё не сдал видео по брифу.</p>}
        {mine.map((s) => (
          <div className="br-video" key={s.id}>
            <div className="br-video__head">
              <div>
                {safeHref(s.video_url)
                  ? <a href={safeHref(s.video_url)} target="_blank" rel="noreferrer" className="br-video__link">▶ Смотреть видео</a>
                  : <span className="creator-portal__muted">ссылка недоступна</span>}
                <div className="creator-portal__muted" style={{ fontSize: '0.82rem' }}>
                  {s.platform}{s.published_at ? ` · опубликовано ${s.published_at}` : ''}
                  {s.rights_confirmed ? ' · права ✓' : ' · права ✗'}
                </div>
              </div>
              <span className={`pf-status pf-status--${s.status}`}>{SUB_STATUS_RU[s.status] || s.status}</span>
            </div>

            <div className="br-video__grid">
              <div className="br-metric">
                <span className="br-metric__label">Просмотры</span>
                <span className="br-metric__value">{(s.views || 0).toLocaleString('ru-RU')}{s.views_final ? ' · финал' : ''}</span>
                <ViewSparkline history={s.views_history} />
              </div>
              <div className="br-metric">
                <span className="br-metric__label">ИИ-анализ</span>
                {s.ai_score != null
                  ? <span className="br-metric__value">{s.ai_score}/100</span>
                  : <span className="creator-portal__muted" style={{ fontSize: '0.85rem' }}>не запускался</span>}
                {s.ai_feedback && <span className="br-metric__ai">{s.ai_feedback}</span>}
                <button className="btn btn--ghost btn--sm" disabled={aiBusy === s.id} onClick={() => runAi(s.id)} style={{ marginTop: 6 }}>
                  {aiBusy === s.id ? 'Анализирую…' : s.ai_score != null ? '↻ Перезапустить ИИ' : '🤖 Запустить ИИ'}
                </button>
              </div>
            </div>

            {s.fraud?.suspicious && (
              <div className="fraud-flag" title={s.fraud.reasons?.join('; ')}>
                ⚠️ Подозрительный рост просмотров
                <div className="fraud-flag__reasons">{s.fraud.reasons?.join('; ')}</div>
              </div>
            )}

            <div className="br-video__shots">
              <span className="br-metric__label">Скриншоты статистики (по дням)</span>
              <StatScreenshots
                submissionId={s.id}
                platform={s.platform}
                basePath="/api/admin/submissions"
                authFetch={authFetch}
                count={s.screenshots_count}
                lastAt={s.last_screenshot_at}
              />
            </div>
          </div>
        ))}
      </section>
    );
  }

  // ---- Level 2: everyone who took the selected brief ----
  if (selBrief) {
    const briefSubs = subsByBrief.get(selBriefId) || [];
    const byCreator = new Map(); // creator_id → { count, views }
    for (const s of briefSubs) {
      const e = byCreator.get(s.creator_id) || { count: 0, views: 0 };
      e.count += 1; e.views += (s.views || 0);
      byCreator.set(s.creator_id, e);
    }
    // Union of takers and anyone who submitted: on an unlimited brief a creator
    // can submit without ever "taking" a slot, so they'd otherwise be invisible
    // here despite having a video.
    const takersList = takers || [];
    const seen = new Set(takersList.map((t) => t.creator_id));
    const extra = [];
    for (const s of briefSubs) {
      if (seen.has(s.creator_id)) continue;
      seen.add(s.creator_id);
      extra.push({ creator_id: s.creator_id, creator_name: s.creator_name, taken_at: null, submitted: true, lapsed: false });
    }
    const list = [...takersList, ...extra];
    return (
      <section className="admin-block">
        <Breadcrumb trail={[{ label: 'Брифы', onClick: () => setSelBriefId(null) }, { label: selBrief.title }]} />
        <h2 className="admin-block__title">{selBrief.title}</h2>
        <p className="muted-note" style={{ textAlign: 'left', marginTop: 0 }}>
          {selBrief.platform} · взяли: <b>{list.length}</b> · сдали: <b>{byCreator.size}</b> · всего просмотров: <b>{briefSubs.reduce((n, s) => n + (s.views || 0), 0).toLocaleString('ru-RU')}</b>
        </p>
        {takersLoading && !takers ? (
          <p className="muted-note">Загружаю…</p>
        ) : !list.length ? (
          <p className="admin-table__empty">Бриф ещё никто не взял.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>Креатор</th><th>Взял</th><th>Видео</th><th>Просмотры</th><th>Статус</th><th></th></tr>
              </thead>
              <tbody>
                {list.map((t) => {
                  const agg = byCreator.get(t.creator_id) || { count: 0, views: 0 };
                  const state = t.submitted ? { cls: 'accepted', text: '✅ сдал' }
                    : t.lapsed ? { cls: 'rejected', text: '⌛ просрочено' }
                      : { cls: 'pending', text: '⏳ в работе' };
                  return (
                    <tr key={t.creator_id}>
                      <td data-label="Креатор">
                        <b>{t.creator_name}</b>
                        {t.ugc_code && <div className="takers-cell__ugc">UGC {t.ugc_code}</div>}
                      </td>
                      <td data-label="Взял">
                        {t.taken_at ? new Date(t.taken_at).toLocaleString('ru-RU') : '—'}
                        {t.submitted && t.seconds_to_submit != null && (
                          <div className="creator-portal__muted" style={{ fontSize: '0.78rem' }}>сдал за {humanDuration(t.seconds_to_submit)}</div>
                        )}
                      </td>
                      <td data-label="Видео">{agg.count || '—'}</td>
                      <td data-label="Просмотры">{agg.views ? agg.views.toLocaleString('ru-RU') : '—'}</td>
                      <td data-label="Статус"><span className={`pf-status pf-status--${state.cls}`}>{state.text}</span></td>
                      <td data-label="">
                        {agg.count > 0 && (
                          <button className="btn btn--ghost btn--sm" onClick={() => setSelCreatorId(t.creator_id)}>Открыть →</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    );
  }

  // ---- Level 1: list of briefs ----
  const needle = q.trim().toLowerCase();
  const rows = briefs
    .map((b) => {
      const bs = subsByBrief.get(b.id) || [];
      const submitted = new Set(bs.map((s) => s.creator_id)).size;
      const views = bs.reduce((n, s) => n + (s.views || 0), 0);
      return { b, submitted, views, took: b.assigned_count || 0 };
    })
    .filter(({ b }) => !needle || (b.title || '').toLowerCase().includes(needle))
    // Most active first: taken or submitted; drafts nobody touched sink down.
    .sort((x, y) => (y.took + y.submitted) - (x.took + x.submitted) || y.b.id - x.b.id);

  return (
    <section className="admin-block">
      <div className="admin-panel__head">
        <h2 className="admin-block__title">Проверка по брифам</h2>
        <button className="btn btn--ghost btn--sm" onClick={load} disabled={loading}>{loading ? 'Обновляю…' : 'Обновить'}</button>
      </div>
      <p className="muted-note" style={{ textAlign: 'left', marginTop: 0 }}>
        Выбери бриф → увидишь всех, кто его взял → открой креатора, чтобы посмотреть его видео: просмотры, ИИ-анализ, скриншоты статистики.
      </p>
      {err && <p className="lead-form__errors" role="alert">{err}</p>}
      <input
        className="cr-filters__search"
        placeholder="Поиск брифа по названию…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ margin: '4px 0 12px', maxWidth: 360 }}
      />
      <div className="br-briefs">
        {rows.map(({ b, submitted, views, took }) => (
          <button type="button" className="br-brief" key={b.id} onClick={() => { setSelBriefId(b.id); setSelCreatorId(null); }}>
            <div className="br-brief__main">
              <b className="br-brief__title">{b.title}</b>
              <span className="creator-portal__muted" style={{ fontSize: '0.82rem' }}>
                {b.platform}{b.slots ? ` · слотов ${b.slots}` : ''}
              </span>
            </div>
            <div className="br-brief__stats">
              <span><b>{took}</b> взяли</span>
              <span><b>{submitted}</b> сдали</span>
              <span><b>{views.toLocaleString('ru-RU')}</b> просмотров</span>
            </div>
            <span className="br-brief__chevron" aria-hidden="true">→</span>
          </button>
        ))}
        {!rows.length && <p className="admin-table__empty">{loading ? 'Загружаю…' : 'Брифов нет'}</p>}
      </div>
    </section>
  );
}

/** Clickable breadcrumb trail for the drill-down. Last item is the current page. */
function Breadcrumb({ trail }) {
  return (
    <nav className="br-crumbs" aria-label="Навигация">
      {trail.map((c, i) => (
        <span key={i} className="br-crumbs__item">
          {c.onClick ? (
            <button type="button" className="br-crumbs__link" onClick={c.onClick}>{c.label}</button>
          ) : (
            <span className="br-crumbs__cur">{c.label}</span>
          )}
          {i < trail.length - 1 && <span className="br-crumbs__sep" aria-hidden="true">/</span>}
        </span>
      ))}
    </nav>
  );
}
