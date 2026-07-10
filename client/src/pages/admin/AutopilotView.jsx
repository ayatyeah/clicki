import { useState, useEffect } from 'react';

/* ---------------- Campaign Autopilot (recommendations only) ---------------- */
export function AutopilotView({ authFetch }) {
  const [data, setData] = useState(null);
  const [busyKey, setBusyKey] = useState(null);
  const [msg, setMsg] = useState('');

  const load = async () => {
    const r = await (await authFetch('/api/admin/autopilot')).json();
    if (r.ok !== false) setData(r);
  };
  useEffect(() => { load(); }, []); // eslint-disable-line

  const assign = async (briefId, creatorId, key) => {
    setBusyKey(key);
    try {
      const res = await authFetch(`/api/admin/briefs/${briefId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creator_id: creatorId }),
      });
      if (res.ok) { setMsg('Назначено ✓'); await load(); }
    } finally {
      setBusyKey(null);
      setTimeout(() => setMsg(''), 2000);
    }
  };

  const pause = async (briefId, key) => {
    setBusyKey(key);
    try {
      const res = await authFetch(`/api/admin/briefs/${briefId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'paused' }),
      });
      if (res.ok) { setMsg('Приостановлено ✓'); await load(); }
    } finally {
      setBusyKey(null);
      setTimeout(() => setMsg(''), 2000);
    }
  };

  if (!data) {
    return (
      <section className="admin-block">
        <div className="bp-cards">
          <div className="bp-card bp-card--skeleton" aria-hidden="true" />
          <div className="bp-card bp-card--skeleton" aria-hidden="true" />
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="admin-block">
        <div className="admin-panel__head">
          <h2 className="admin-block__title">Кого назначить</h2>
        </div>
        <p className="muted-note" style={{ textAlign: 'left' }}>
          Только рекомендации — решение об назначении принимает оператор.
        </p>
        {data.assignSuggestions.length ? (
          <div className="bp-cards">
            {data.assignSuggestions.map((s) => (
              <div key={s.brief_id} className="bp-card">
                <div className="bp-card__head"><b>{s.title}</b><span className="pf-badge">{s.platform}</span></div>
                <p className="creator-portal__muted" style={{ margin: 0 }}>Нужно ещё {s.needed} креатор(ов)</p>
                <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                  {s.candidates.map((c) => {
                    const key = `${s.brief_id}-${c.creator_id}`;
                    return (
                      <div key={c.creator_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                        <span>
                          <b>{c.name}</b>{' '}
                          <span className="creator-portal__muted">
                            {c.videos_on_platform > 0 ? `${c.videos_on_platform} видео на площадке, ~${c.avg_views_platform?.toLocaleString('ru-RU')} просм.` : 'ещё нет видео на площадке'} · trust {c.trust_score}
                          </span>
                        </span>
                        <button className="btn btn--ghost btn--sm" disabled={busyKey === key} onClick={() => assign(s.brief_id, c.creator_id, key)}>
                          Назначить
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted-note" style={{ textAlign: 'left' }}>Все активные брифы укомплектованы или кандидатов нет.</p>
        )}
      </section>

      <section className="admin-block">
        <div className="admin-panel__head">
          <h2 className="admin-block__title">Что приостановить</h2>
        </div>
        {data.pauseSuggestions.length ? (
          <div className="bp-cards">
            {data.pauseSuggestions.map((s) => {
              const key = `pause-${s.brief_id}`;
              return (
                <div key={s.brief_id} className="bp-card">
                  <div className="bp-card__head"><b>{s.title}</b></div>
                  <p className="creator-portal__muted" style={{ margin: 0 }}>{s.reason}</p>
                  <button className="btn btn--ghost btn--sm" style={{ marginTop: 8 }} disabled={busyKey === key} onClick={() => pause(s.brief_id, key)}>
                    Приостановить
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="muted-note" style={{ textAlign: 'left' }}>Нет брифов, готовых к остановке.</p>
        )}
        {msg && <p className="creator-portal__muted" style={{ color: '#15803d' }}>{msg}</p>}
      </section>
    </>
  );
}
