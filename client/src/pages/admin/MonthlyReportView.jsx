import { useState, useEffect } from 'react';
import { Stat } from './ui.jsx';

const MONTH_NAMES_RU = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

/* ---------------- Monthly leaderboard: leads/clients + views per creator ---------------- */
export function MonthlyReportView({ authFetch }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await (await authFetch(`/api/admin/reports/monthly?year=${year}&month=${month}`)).json();
      setReport(r.report || null);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  const shiftMonth = (delta) => {
    let m = month + delta, y = year;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setMonth(m);
    setYear(y);
  };

  const rows = report?.rows || [];
  const totalLeads = rows.reduce((a, r) => a + r.leads, 0);
  const totalViews = rows.reduce((a, r) => a + r.views, 0);

  return (
    <section className="admin-block">
      <div className="admin-panel__head">
        <h2 className="admin-block__title">Отчёт за месяц</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn--ghost btn--sm" onClick={() => shiftMonth(-1)}>←</button>
          <b>{MONTH_NAMES_RU[month - 1]} {year}</b>
          <button className="btn btn--ghost btn--sm" onClick={() => shiftMonth(1)}>→</button>
        </div>
      </div>
      <p className="muted-note" style={{ textAlign: 'left', marginTop: 0 }}>
        Кто больше всех привёл лидов/клиентов по реферальной ссылке и набрал просмотров за этот месяц.
      </p>
      <div className="admin-stats">
        <Stat label="Лидов за месяц" value={totalLeads} />
        <Stat label="Просмотров за месяц" value={totalViews.toLocaleString('ru-RU')} />
        <Stat label="Активных креаторов" value={rows.length} />
      </div>
      <div className="admin-table-wrap" style={{ marginTop: 16 }}>
        <table className="admin-table">
          <thead>
            <tr><th>#</th><th>Креатор</th><th>Лиды / клиенты</th><th>Просмотры</th></tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id}>
                <td data-label="#">{i + 1}</td>
                <td data-label="Креатор"><b>{r.name}</b>{r.username ? <div style={{ color: 'var(--fog)', fontSize: '0.82rem' }}>@{r.username}</div> : null}</td>
                <td data-label="Лиды / клиенты">{r.leads}</td>
                <td className="muted-cell" data-label="Просмотры">{r.views.toLocaleString('ru-RU')}</td>
              </tr>
            ))}
            {!loading && !rows.length && <tr><td colSpan={4} className="admin-table__empty">За этот месяц пока нет данных</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
