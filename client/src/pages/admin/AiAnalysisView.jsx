import { useState, useEffect } from 'react';

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
  const [flags, setFlags] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const loadFlags = async () => {
    const r = await (await authFetch('/api/admin/ops-flags')).json();
    if (r.ok !== false) setFlags(r);
  };
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
    loadFlags();
  }, []); // eslint-disable-line

  return (
    <>
      <section className="admin-block">
        <div className="admin-panel__head">
          <h2 className="admin-block__title">Ops Copilot <span className="creator-portal__muted">— на что обратить внимание</span></h2>
          <button className="btn btn--ghost btn--sm" onClick={() => setSettingsOpen((v) => !v)}>
            {settingsOpen ? 'Скрыть пороги' : 'Настроить пороги'}
          </button>
        </div>
        {settingsOpen && <OpsSettingsForm authFetch={authFetch} onSaved={loadFlags} />}
        {!flags ? (
          <div className="bp-cards"><div className="bp-card bp-card--skeleton" aria-hidden="true" /><div className="bp-card bp-card--skeleton" aria-hidden="true" /></div>
        ) : !flags.behindBriefs.length && !flags.churnRisk.length ? (
          <p className="muted-note">Флагов нет — брифы и креаторы в норме.</p>
        ) : (
          <div className="bp-cards">
            {flags.behindBriefs.map((f) => (
              <div key={`b${f.brief_id}`} className="bp-card">
                <div className="bp-card__head"><b>⏱ {f.title}</b><span className="pf-status pf-status--rework">отстаёт</span></div>
                <p className="creator-portal__muted" style={{ margin: 0 }}>{f.reason}</p>
              </div>
            ))}
            {flags.churnRisk.map((f) => (
              <div key={`c${f.creator_id}`} className="bp-card">
                <div className="bp-card__head"><b>👋 {f.name}</b><span className="pf-status pf-status--rework">риск оттока</span></div>
                <p className="creator-portal__muted" style={{ margin: 0 }}>{f.reason}</p>
              </div>
            ))}
          </div>
        )}
      </section>

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
    </>
  );
}

/** Ops Copilot's flag thresholds used to be hardcoded — this lets an operator
 * tune them (e.g. "4 days" was too twitchy for a slow-moving campaign) without
 * a redeploy. Values persist in the same `settings` table admin/rates already use. */
function OpsSettingsForm({ authFetch, onSaved }) {
  const [values, setValues] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    (async () => {
      const r = await (await authFetch('/api/admin/rates')).json();
      const s = r.settings || {};
      setValues({
        ops_behind_days: s.ops_behind_days ?? 4,
        ops_fill_ratio: Math.round((s.ops_fill_ratio ?? 0.5) * 100),
        ops_churn_days: s.ops_churn_days ?? 14,
      });
    })();
  }, []); // eslint-disable-line

  const set = (k, v) => setValues((s) => ({ ...s, [k]: v }));

  const save = async () => {
    setSaving(true);
    setMsg('');
    try {
      await Promise.all([
        authFetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'ops_behind_days', value: values.ops_behind_days }) }),
        authFetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'ops_fill_ratio', value: values.ops_fill_ratio / 100 }) }),
        authFetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'ops_churn_days', value: values.ops_churn_days }) }),
      ]);
      setMsg('Сохранено ✓');
      onSaved?.();
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(''), 2000);
    }
  };

  if (!values) return null;
  return (
    <div className="ops-settings">
      <div className="creator-portal__q">
        <div className="creator-portal__q-title">Бриф считается отстающим через, дней</div>
        <input type="number" min="1" value={values.ops_behind_days} onChange={(e) => set('ops_behind_days', Number(e.target.value))} />
      </div>
      <div className="creator-portal__q">
        <div className="creator-portal__q-title">...если заполнено меньше, % слотов</div>
        <input type="number" min="1" max="100" value={values.ops_fill_ratio} onChange={(e) => set('ops_fill_ratio', Number(e.target.value))} />
      </div>
      <div className="creator-portal__q">
        <div className="creator-portal__q-title">Риск оттока креатора — нет видео, дней</div>
        <input type="number" min="1" value={values.ops_churn_days} onChange={(e) => set('ops_churn_days', Number(e.target.value))} />
      </div>
      <button className="btn btn--primary btn--sm" onClick={save} disabled={saving}>{saving ? 'Сохраняю…' : 'Сохранить пороги'}</button>
      {msg && <span className="creator-portal__muted" style={{ marginLeft: 10, color: '#15803d' }}>{msg}</span>}
    </div>
  );
}
