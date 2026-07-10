import { useState, useEffect } from 'react';
import { useToast } from '../../components/Toast.jsx';
import { useConfirm } from '../../components/ConfirmDialog.jsx';

/* ---------------- Payouts ---------------- */
export function PayoutsView({ authFetch }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [payouts, setPayouts] = useState([]);
  const [creators, setCreators] = useState([]);
  const [form, setForm] = useState({ creator_id: '', amount: '' });
  const [error, setError] = useState('');
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
    setError('');
    const res = await authFetch('/api/admin/payouts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creator_id: Number(form.creator_id), amount: Number(form.amount) }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
      setError((data.errors && data.errors[0]) || 'Не удалось создать выплату');
      return;
    }
    setForm({ creator_id: '', amount: '' });
    toast.success('Выплата создана');
    load();
  };
  const markPaid = async (id) => {
    const okToPay = await confirm({
      title: 'Отметить выплату оплаченной?',
      message: 'Статус изменится на «оплачено» — отменить нельзя.',
      confirmText: 'Отметить оплаченной',
    });
    if (!okToPay) return;
    setError('');
    const res = await authFetch(`/api/admin/payouts/${id}/paid`, { method: 'POST' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const msg = (data.errors && data.errors[0]) || 'Не удалось отметить оплату';
      setError(msg);
      toast.error(msg);
      return;
    }
    toast.success('Выплата отмечена оплаченной');
    load();
  };

  return (
    <section className="admin-block">
      <h2 className="admin-block__title">Выплаты (Kaspi, вручную)</h2>
      {error && <p className="creator-portal__err">{error}</p>}
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
                <td data-label="Креатор">{p.creator_name || `#${p.creator_id}`}</td>
                <td data-label="Сумма">{Number(p.amount).toLocaleString('ru-RU')} ₸</td>
                <td data-label="Статус"><span className={`pf-status pf-status--${p.status}`}>{p.status}</span></td>
                <td data-label="">{p.status !== 'paid' && <button className="btn btn--ghost btn--sm" onClick={() => markPaid(p.id)}>Отметить оплату</button>}</td>
              </tr>
            ))}
            {!payouts.length && <tr><td colSpan={4} className="admin-table__empty">Выплат пока нет</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ---------------- Decision journal ----------------
   Not AI itself — the raw log every accept/reject/rework call writes, one row
   per decision: what happened, why, how many views it had, how long it took.
   The foundation any future "smart" model would need to learn from. */
