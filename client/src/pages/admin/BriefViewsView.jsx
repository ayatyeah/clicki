import { useState, useEffect } from 'react';

/* ---------------- Views by brief × creator ---------------- */
export function BriefViewsView({ authFetch }) {
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(false);
  const load = async () => {
    setLoading(true);
    try {
      const r = await (await authFetch('/api/admin/submissions')).json();
      setSubs(r.submissions || []);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    const id = setInterval(load, 20000);
    return () => clearInterval(id);
  }, []); // eslint-disable-line

  // Group by brief, then by creator within each brief — sums views if a
  // creator has more than one submission against the same brief.
  const briefs = new Map(); // brief_id -> { title, total, byCreator: Map }
  for (const s of subs) {
    const briefId = s.brief_id ?? `_${s.id}`;
    if (!briefs.has(briefId)) briefs.set(briefId, { title: s.brief_title || 'без брифа', total: 0, byCreator: new Map() });
    const b = briefs.get(briefId);
    const views = s.views || 0;
    b.total += views;
    const creatorKey = s.creator_id ?? `_${s.id}`;
    const name = s.creator_name || `#${s.creator_id}`;
    b.byCreator.set(creatorKey, { name, views: (b.byCreator.get(creatorKey)?.views || 0) + views });
  }
  const rows = [...briefs.values()].sort((a, b) => b.total - a.total);

  return (
    <section className="admin-block">
      <div className="admin-panel__head">
        <h2 className="admin-block__title">Просмотры по брифам <span className="an-live">● live</span></h2>
        <button className="btn btn--ghost btn--sm" onClick={load} disabled={loading}>{loading ? 'Обновляю…' : 'Обновить'}</button>
      </div>
      {rows.map((b, i) => (
        <div className="admin-block" key={i} style={{ marginTop: i ? 16 : 0, padding: 16 }}>
          <div className="admin-panel__head">
            <h3 className="admin-block__title admin-subhead" style={{ margin: 0 }}>{b.title}</h3>
            <b>{b.total.toLocaleString('ru-RU')} просмотров всего</b>
          </div>
          <div className="admin-table-wrap" style={{ marginTop: 8 }}>
            <table className="admin-table">
              <thead><tr><th>Креатор</th><th>Просмотры</th></tr></thead>
              <tbody>
                {[...b.byCreator.values()].sort((x, y) => y.views - x.views).map((c) => (
                  <tr key={c.name}><td data-label="Креатор">{c.name}</td><td className="muted-cell" data-label="Просмотры">{c.views.toLocaleString('ru-RU')}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      {!rows.length && <p className="admin-table__empty">Пока нет сдач видео</p>}
    </section>
  );
}
