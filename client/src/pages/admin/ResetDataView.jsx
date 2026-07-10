import { useState } from 'react';

/* ---------------- Danger zone: wipe all accounts + data ---------------- */
export function ResetDataView({ authFetch }) {
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const reset = async () => {
    setBusy(true);
    setError('');
    setMsg('');
    const res = await authFetch('/api/admin/reset-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok || d.ok === false) return setError((d.errors && d.errors[0]) || 'Не удалось очистить');
    setConfirm('');
    setMsg('Готово — все аккаунты и данные удалены. Остался только аккаунт админа.');
  };

  return (
    <section className="admin-block">
      <h2 className="admin-block__title">Очистка данных</h2>
      <div className="mod-note" style={{ marginBottom: 14 }}>
        <b>Осторожно.</b> Это удалит <b>всех креаторов и бизнесы</b>, а также брифы, сдачи видео, выплаты,
        рефералов, заявки и аналитику посещений. Контент главной и настройки платформы сохранятся.
        Аккаунт админа не затрагивается. Действие необратимо.
      </div>
      <p className="muted-note" style={{ textAlign: 'left', marginTop: 0 }}>
        Чтобы подтвердить, введите слово <b>ОЧИСТИТЬ</b> и нажмите кнопку.
      </p>
      <div className="pf-form" style={{ maxWidth: 360 }}>
        <input placeholder="ОЧИСТИТЬ" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        {error && <p className="creator-portal__err" style={{ margin: 0 }}>{error}</p>}
        {msg && <p className="muted-note" style={{ margin: 0, color: '#15803d' }}>{msg}</p>}
        <button className="btn btn--danger btn--sm" onClick={reset} disabled={busy || confirm !== 'ОЧИСТИТЬ'}>
          {busy ? 'Очищаю…' : 'Очистить все данные'}
        </button>
      </div>
    </section>
  );
}
