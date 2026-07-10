import { useState, useEffect } from 'react';

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
