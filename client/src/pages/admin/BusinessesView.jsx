import { useState, useEffect } from 'react';
import { useToast } from '../../components/Toast.jsx';
import { useConfirm } from '../../components/ConfirmDialog.jsx';

/* ---------------- Businesses (accounts) ---------------- */
export function BusinessesView({ authFetch }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [businesses, setBusinesses] = useState([]);
  const [form, setForm] = useState({ name: '', company: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = async () => {
    const r = await (await authFetch('/api/admin/businesses')).json();
    setBusinesses(r.businesses || []);
  };
  useEffect(() => {
    load();
  }, []); // eslint-disable-line
  const setF = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  const create = async () => {
    if (!form.name || !form.email || !form.password) return;
    setBusy(true);
    setError('');
    const res = await authFetch('/api/admin/businesses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok || d.ok === false) return setError((d.errors && d.errors[0]) || 'Ошибка');
    setForm({ name: '', company: '', email: '', password: '' });
    toast.success('Аккаунт бизнеса создан');
    load();
  };

  const remove = async (id, name) => {
    const okToDelete = await confirm({
      title: 'Удалить аккаунт бизнеса?',
      message: `«${name}» и все его брифы будут удалены безвозвратно.`,
      confirmText: 'Удалить',
      danger: true,
    });
    if (!okToDelete) return;
    setError('');
    const res = await authFetch(`/api/admin/businesses/${id}/delete`, { method: 'POST' });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      const msg = (d.errors && d.errors[0]) || 'Не удалось удалить';
      setError(msg);
      toast.error(msg);
      return;
    }
    toast.success('Аккаунт удалён');
    load();
  };

  return (
    <section className="admin-block">
      <h2 className="admin-block__title">Бизнесы ({businesses.length})</h2>
      <p className="muted-note" style={{ textAlign: 'left', marginTop: 0 }}>
        Создай аккаунт бизнесу (выдай email и пароль) — под этими данными бренд войдёт в кабинет.
        Бренды также могут регистрироваться сами со страницы входа.
      </p>
      <div className="pf-form">
        <input placeholder="Имя контакта" value={form.name} onChange={(e) => setF('name', e.target.value)} />
        <input placeholder="Компания (по желанию)" value={form.company} onChange={(e) => setF('company', e.target.value)} />
        <div className="pf-row">
          <input placeholder="Email" type="email" value={form.email} onChange={(e) => setF('email', e.target.value)} />
          <input placeholder="Пароль (мин. 6)" value={form.password} onChange={(e) => setF('password', e.target.value)} />
        </div>
        {error && <p className="creator-portal__err" style={{ margin: 0 }}>{error}</p>}
        <button className="btn btn--primary btn--sm" onClick={create} disabled={busy}>
          {busy ? 'Создаю…' : 'Создать бизнес'}
        </button>
      </div>

      <div className="admin-table-wrap" style={{ marginTop: 16 }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Бизнес</th>
              <th>Email (логин)</th>
              <th>Брифов</th>
              <th>Создан</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {businesses.map((b) => (
              <tr key={b.id}>
                <td data-label="Бизнес">
                  <b>{b.company || b.name}</b>
                  {b.company && <div style={{ fontSize: '0.8rem', color: 'var(--fog)' }}>{b.name}</div>}
                </td>
                <td data-label="Email"><BusinessCredentials business={b} authFetch={authFetch} onSaved={load} /></td>
                <td data-label="Брифов">{b.briefs}</td>
                <td className="muted-cell" data-label="Создан">{b.created_at ? new Date(b.created_at).toLocaleDateString('ru-RU') : '—'}</td>
                <td data-label="Действия">
                  <button className="btn btn--ghost btn--sm" onClick={() => remove(b.id, b.company || b.name)}>Удалить</button>
                </td>
              </tr>
            ))}
            {!businesses.length && <tr><td colSpan={5} className="admin-table__empty">Бизнесов пока нет</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BusinessCredentials({ business, authFetch, onSaved }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(business.email || '');
  const [p, setP] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const save = async () => {
    setBusy(true);
    setErr('');
    const res = await authFetch(`/api/admin/businesses/${business.id}/credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: p }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok || d.ok === false) return setErr((d.errors && d.errors[0]) || 'Ошибка');
    setP('');
    setOpen(false);
    onSaved();
  };

  if (!open) {
    return (
      <div className="pf-actions">
        <span style={{ fontSize: '0.85rem' }}>{business.email}</span>
        <button className="btn btn--ghost btn--sm" onClick={() => setOpen(true)}>Сменить пароль</button>
      </div>
    );
  }
  return (
    <div className="pf-actions">
      <input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input type="text" placeholder="Новый пароль" value={p} onChange={(e) => setP(e.target.value)} />
      {err && <span className="creator-portal__err" style={{ fontSize: '0.78rem' }}>{err}</span>}
      <div className="pf-row">
        <button className="btn btn--primary btn--sm" onClick={save} disabled={busy}>{busy ? '…' : 'Сохранить'}</button>
        <button className="btn btn--ghost btn--sm" onClick={() => setOpen(false)}>Отмена</button>
      </div>
    </div>
  );
}
