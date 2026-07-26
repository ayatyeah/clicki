import { useState, useEffect } from 'react';

const ACTION_RU = { accept: 'принял', decline: 'отказался', account_deleted: 'удалил аккаунт' };
const DOC_RU = { offer: 'Оферта', personal_data_consent: 'Согласие на ПДн', all: 'все документы', account: '—' };
const ROLE_RU = { creator: 'Креатор', business: 'Бизнес' };

export function LegalAcceptancesView({ authFetch }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const load = async () => {
    setLoading(true);
    try {
      const r = await (await authFetch('/api/admin/legal-acceptances')).json();
      setRows(r.acceptances || []);
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
        <h2 className="admin-block__title">Принятие юридических документов</h2>
        <button className="btn btn--ghost btn--sm" onClick={load} disabled={loading}>{loading ? 'Обновляю…' : 'Обновить'}</button>
      </div>
      <p className="muted-note" style={{ textAlign: 'left', marginTop: 0 }}>
        Append-only журнал: каждое принятие, отказ и удаление аккаунта — офера и согласие на обработку ПДн для
        креаторов, согласие на ПДн для бизнеса. Запись никогда не удаляется и не изменяется.
      </p>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Кто</th>
              <th>Роль</th>
              <th>Документ</th>
              <th>Версия</th>
              <th>Действие</th>
              <th>IP</th>
              <th>Когда</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td data-label="Кто"><b>{a.actor_name || `#${a.actor_id}`}</b></td>
                <td data-label="Роль">{ROLE_RU[a.actor_type] || a.actor_type}</td>
                <td data-label="Документ">{DOC_RU[a.doc_type] || a.doc_type}</td>
                <td className="muted-cell" data-label="Версия">{a.doc_version}</td>
                <td data-label="Действие"><span className={`pf-status pf-status--${a.action === 'decline' ? 'rejected' : a.action === 'account_deleted' ? 'rejected' : 'accepted'}`}>{ACTION_RU[a.action] || a.action}</span></td>
                <td className="muted-cell" data-label="IP">{a.ip || '—'}</td>
                <td className="muted-cell" data-label="Когда">{new Date(a.created_at).toLocaleString('ru-RU')}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={7} className="admin-table__empty">Пока нет записей</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
