import { useState, useEffect } from 'react';
import { useToast } from '../../components/Toast.jsx';
import { useConfirm } from '../../components/ConfirmDialog.jsx';
import { safeHref } from '../../lib/safeHref.js';

const PLATFORMS = ['TikTok', 'Instagram Reels', 'YouTube Shorts', 'Threads', 'X (Twitter)'];
// Brief-level wildcard: the creator picks the real platform at submit time.
const ANY_PLATFORM = 'Любая';

/** Brief status → what an operator calls it, and the badge colour. Shared with
 *  the per-business brief history in BusinessesView. */
export function briefStatus(status) {
  const label =
    status === 'active' ? 'опубликован креаторам'
      : status === 'revision' ? 'у бизнеса на доработке'
      : status === 'new' ? 'на модерации'
      : status;
  const cls = status === 'active' ? 'accepted' : status === 'revision' ? 'rework' : 'pending';
  return { label, cls };
}

/**
 * The whole brief, read-only — everything the business filled in, including the
 * `spec` from its brief builder. The card only ever showed the title, platform
 * and hashtag, which meant an operator published a brief to every creator
 * without being able to read what it asked for.
 *
 * Empty fields are dropped rather than rendered as "—": admin-created briefs
 * legitimately have no goal/audience, and a wall of dashes hides the real
 * content. `tone` already holds the human-readable style label (the business
 * portal writes it there alongside the raw spec.style key), so no map is needed.
 */
export function BriefRead({ b }) {
  const spec = b.spec || {};
  const who = b.business_company || b.business_name;

  const facts = [
    ['Платформа', b.platform],
    ['Ориентация', spec.orientation ? (spec.orientation === 'horizontal' ? 'Горизонтальное' : 'Вертикальное') : null],
    ['Длительность', b.duration_max ? `${b.duration_min || 0}–${b.duration_max} сек` : null],
    ['Стиль', b.tone || spec.style],
    ['Слотов', b.slots || null],
    ['Хэштег', b.req_hashtag],
  ].filter(([, v]) => v != null && v !== '');

  const texts = [
    ['Цель', b.goal],
    ['Аудитория', b.audience],
    ['Ключевое сообщение', b.key_message],
    ['Что нужно показать', b.dos],
    ['Чего не делать', b.donts],
    ['Референсы', b.refs],
  ].filter(([, v]) => v && String(v).trim());

  const flags = [
    [b.req_mention, 'Упоминание бренда в первые 3 сек'],
    [spec.cta_required, 'CTA обязателен'],
    [spec.logo_first5, 'Логотип в первые 5 сек'],
    [spec.brand_spoken, 'Бренд произносится вслух'],
    [spec.product_in_frame, 'Продукт в кадре'],
  ].filter(([on]) => on).map(([, label]) => label);

  // A brand-supplied URL rendered as a link: safeHref returns undefined for
  // anything that isn't http(s), and we then show it as inert text.
  const cta = safeHref(b.req_cta_link);

  return (
    <div className="brief-read">
      <div className="brief-read__block">
        <span className="brief-read__k">Прислал</span>
        <span className="brief-read__v">
          {who ? `${who}${b.business_company && b.business_name ? ` · ${b.business_name}` : ''} (#${b.business_id})` : 'Создан в админке'}
          {b.created_at ? ` · ${new Date(b.created_at).toLocaleString('ru-RU')}` : ''}
        </span>
      </div>

      {!!facts.length && (
        <div className="brief-read__grid">
          {facts.map(([k, v]) => (
            <div className="brief-read__block" key={k}>
              <span className="brief-read__k">{k}</span>
              <span className="brief-read__v">{v}</span>
            </div>
          ))}
        </div>
      )}

      {b.req_cta_link && (
        <div className="brief-read__block">
          <span className="brief-read__k">CTA-ссылка</span>
          <span className="brief-read__v">
            {cta ? <a href={cta} target="_blank" rel="noopener noreferrer">{b.req_cta_link}</a> : b.req_cta_link}
          </span>
        </div>
      )}

      {texts.map(([k, v]) => (
        <div className="brief-read__block" key={k}>
          <span className="brief-read__k">{k}</span>
          <span className="brief-read__v">{v}</span>
        </div>
      ))}

      {!!flags.length && (
        <div className="brief-read__block">
          <span className="brief-read__k">Требования</span>
          <div className="brief-read__flags">
            {flags.map((f) => <span className="brief-read__flag" key={f}>{f}</span>)}
          </div>
        </div>
      )}

      {!facts.length && !texts.length && !flags.length && !b.req_cta_link && (
        <p className="brief-read__empty" style={{ margin: 0 }}>В брифе заполнено только название.</p>
      )}
    </div>
  );
}

/* ---------------- Briefs ----------------
   canManage=false (investor demo) hides mutating controls like delete. */
export function BriefsView({ authFetch, canManage = false }) {
  const [briefs, setBriefs] = useState([]);
  const [creators, setCreators] = useState([]);
  const [form, setForm] = useState({ title: '', platform: 'TikTok', duration_min: 15, duration_max: 90, slots: 0 });
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
    setForm({ title: '', platform: 'TikTok', duration_min: 15, duration_max: 90, slots: 0 });
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
          <option value={ANY_PLATFORM}>Любая платформа</option>
        </select>
        <input placeholder="Хэштег (#...)" value={form.req_hashtag || ''} onChange={(e) => setF('req_hashtag', e.target.value)} />
        <input placeholder="CTA-ссылка" value={form.req_cta_link || ''} onChange={(e) => setF('req_cta_link', e.target.value)} />
        <input placeholder="Ключевое сообщение" value={form.key_message || ''} onChange={(e) => setF('key_message', e.target.value)} />
        <label className="pf-check">
          <input type="checkbox" checked={!!form.req_mention} onChange={(e) => setF('req_mention', e.target.checked)} /> упоминание бренда в первые 3 сек
        </label>
        <div className="pf-row">
          <label className="pf-num">Мин. сек
            <input type="number" value={form.duration_min} onChange={(e) => setF('duration_min', +e.target.value)} />
          </label>
          <label className="pf-num">Макс. сек
            <input type="number" value={form.duration_max} onChange={(e) => setF('duration_max', +e.target.value)} />
          </label>
          <label className="pf-num">Слотов
            <input type="number" min="0" value={form.slots} onChange={(e) => setF('slots', +e.target.value)} />
          </label>
        </div>
        <p className="muted-note" style={{ textAlign: 'left', margin: 0 }}>
          Слотов — сколько креаторов могут взять бриф в работу. Как только столько наберётся,
          заказ закрывается для остальных. <b>0 — без лимита.</b>
        </p>
        <button className="btn btn--primary btn--sm" onClick={create} disabled={busy}>
          {busy ? 'Создаю…' : 'Создать бриф'}
        </button>
        <p className="muted-note" style={{ textAlign: 'left', margin: 0 }}>
          Бриф создаётся черновиком — он не виден креаторам, пока в списке ниже вы не нажмёте
          «🌐 Опубликовать всем» или «👥 Назначить выбранным».
        </p>
      </div>

      <p className="muted-note" style={{ textAlign: 'left', marginTop: 16 }}>
        Бриф приходит от бизнеса «на модерацию». Прогони ИИ-анализ, затем опубликуй креаторам или верни бизнесу на доработку.
      </p>
      <div className="bp-cards" style={{ marginTop: 12 }}>
        {briefs.map((b) => (
          <BriefModCard key={b.id} b={b} authFetch={authFetch} creators={creators} onChange={load} canManage={canManage} />
        ))}
        {!briefs.length && <p className="muted-note" style={{ textAlign: 'left' }}>Брифов пока нет</p>}
      </div>
    </section>
  );
}

function BriefModCard({ b, authFetch, creators, onChange, canManage }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [showNote, setShowNote] = useState(false);
  const [showBrief, setShowBrief] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const call = async (url, body) => {
    setBusy(true);
    try {
      await authFetch(url, { method: 'POST', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
      onChange();
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    const okToDelete = await confirm({
      title: 'Удалить бриф?',
      message: `«${b.title}» будет удалён. Уже сданные по нему видео сохранятся, но останутся без привязки к брифу.`,
      confirmText: 'Удалить',
      danger: true,
    });
    if (!okToDelete) return;
    setBusy(true);
    try {
      const res = await authFetch(`/api/admin/briefs/${b.id}/delete`, { method: 'POST' });
      if (res.ok) { toast.success('Бриф удалён'); onChange(); }
      else { const d = await res.json().catch(() => ({})); toast.error(d.errors?.[0] || 'Не удалось удалить'); }
    } finally {
      setBusy(false);
    }
  };
  const { label: statusLabel, cls: statusCls } = briefStatus(b.status);

  // Who can actually see this brief right now. `active` means it's an open order
  // for EVERY creator — assignment doesn't restrict, it only adds — so that case
  // is called out loudly. This is the line the operator kept almost crossing:
  // a brief meant for five, one click from reaching all of them.
  const totalCreators = creators.length;
  const assigned = b.assigned_count || 0;
  const audience = b.status === 'active'
    ? { icon: '🌐', text: `Виден ВСЕМ креаторам${totalCreators ? ` (${totalCreators})` : ''}`, cls: 'all' }
    : assigned > 0
      ? { icon: '👥', text: `Только назначенным: ${assigned}`, cls: 'some' }
      : { icon: '🔒', text: 'Не опубликован — пока не виден никому', cls: 'none' };

  const publishToAll = async () => {
    const okToPublish = await confirm({
      title: 'Опубликовать всем креаторам?',
      message: `Бриф станет открытым заказом для ВСЕХ креаторов${totalCreators ? ` — это ${totalCreators} чел.` : ''}, и любой сможет взять его в работу. Если он нужен только выбранным — не публикуйте, а нажмите «Назначить креаторам».`,
      confirmText: 'Опубликовать всем',
      danger: true,
    });
    if (!okToPublish) return;
    call(`/api/admin/briefs/${b.id}/status`, { status: 'active' });
  };

  // Pull a live brief back from "everyone" — the recovery if it went public by
  // mistake. Assignments survive, so anyone specifically assigned keeps access.
  const unpublish = async () => {
    const okTo = await confirm({
      title: 'Снять бриф с публикации?',
      message: assigned > 0
        ? `Бриф перестанет быть открытым для всех. Назначенные (${assigned}) сохранят доступ.`
        : 'Бриф перестанет быть открытым для всех — его больше никто не увидит, пока вы снова не опубликуете или не назначите креаторов.',
      confirmText: 'Снять с публикации',
      danger: true,
    });
    if (!okTo) return;
    call(`/api/admin/briefs/${b.id}/status`, { status: 'new' });
  };

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
      <div className={`brief-audience brief-audience--${audience.cls}`}>
        <span aria-hidden="true">{audience.icon}</span> {audience.text}
      </div>
      <div className="mod-panel">
        {b.ai_score != null && (
          <div className="mod-ai"><span className="mod-ai__score">ИИ: {b.ai_score}/100.</span> {b.ai_feedback}</div>
        )}
        {b.revision_note && <div className="mod-note">Возвращён бизнесу: {b.revision_note}</div>}
        {/* Admin only. This same view is the public, unauthenticated /demo-admin
            page, and a brief is a paying client's campaign — not something to
            put behind a button anyone can press. */}
        {canManage && showBrief && <BriefRead b={b} />}
        <div className="mod-actions">
          {canManage && (
            <button className="btn btn--ghost btn--sm" onClick={() => setShowBrief((s) => !s)} aria-expanded={showBrief}>
              {showBrief ? 'Свернуть бриф' : 'Читать бриф'}
            </button>
          )}
          <button className="btn btn--ghost btn--sm" disabled={busy} onClick={() => call(`/api/admin/briefs/${b.id}/ai`)}>ИИ-анализ</button>
          {b.status !== 'active' ? (
            <button className="btn btn--primary btn--sm" disabled={busy} onClick={publishToAll}>
              🌐 Опубликовать всем
            </button>
          ) : (
            <button className="btn btn--ghost btn--sm" disabled={busy} onClick={unpublish}>
              Снять с публикации
            </button>
          )}
          <button className="btn btn--ghost btn--sm" disabled={busy} onClick={() => setShowNote((s) => !s)}>Вернуть бизнесу</button>
          <button className="btn btn--ghost btn--sm" disabled={busy} onClick={() => setShowAssign((s) => !s)} aria-expanded={showAssign}>
            👥 Назначить выбранным
          </button>
          {canManage && (
            <button className="btn btn--danger btn--sm" disabled={busy} onClick={remove}>Удалить</button>
          )}
        </div>
        {showAssign && (
          <AssignCreators
            briefId={b.id}
            creators={creators}
            authFetch={authFetch}
            onDone={() => { setShowAssign(false); onChange(); }}
          />
        )}
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

/**
 * Assign one brief to several creators at once — the picker behind "Назначить
 * креаторам". A search box (220+ creators is too many to scan), a checkbox list,
 * a running count, and one submit. Re-assigning someone already on the brief is
 * harmless server-side, so the result is reported as "N назначено" including how
 * many were already there.
 */
function AssignCreators({ briefId, creators, authFetch, onDone }) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState(() => new Set());
  const [busy, setBusy] = useState(false);

  const toggle = (id) => setPicked((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const needle = q.trim().toLowerCase();
  const shown = needle
    ? creators.filter((c) => (c.name || '').toLowerCase().includes(needle))
    : creators;

  const submit = async () => {
    if (!picked.size || busy) return;
    setBusy(true);
    try {
      const res = await authFetch(`/api/admin/briefs/${briefId}/assign-many`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creator_ids: [...picked] }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d.ok === false) { toast.error((d.errors && d.errors[0]) || 'Не удалось назначить'); return; }
      const already = (d.requested || 0) - (d.assigned || 0);
      toast.success(`Назначено: ${d.assigned}${already > 0 ? ` (ещё ${already} уже были на брифе)` : ''}`);
      onDone();
    } catch {
      toast.error('Ошибка сети — попробуйте ещё раз');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="assign-panel">
      <div className="assign-panel__bar">
        <input
          className="assign-panel__search"
          placeholder="Поиск креатора…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <span className="assign-panel__count">Выбрано: {picked.size}</span>
      </div>
      <div className="assign-panel__list">
        {shown.length ? shown.map((c) => (
          <label key={c.id} className="assign-panel__item">
            <input type="checkbox" checked={picked.has(c.id)} onChange={() => toggle(c.id)} />
            <span>{c.name}{c.username ? ` · @${c.username}` : ''}</span>
          </label>
        )) : <p className="muted-note" style={{ margin: 0 }}>Никого не найдено</p>}
      </div>
      <div className="assign-panel__actions">
        <button className="btn btn--primary btn--sm" disabled={!picked.size || busy} onClick={submit}>
          {busy ? 'Назначаю…' : `Назначить${picked.size ? ` (${picked.size})` : ''}`}
        </button>
        {picked.size > 0 && (
          <button className="btn btn--ghost btn--sm" disabled={busy} onClick={() => setPicked(new Set())}>Сбросить</button>
        )}
      </div>
    </div>
  );
}
