import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useConfirm } from './ConfirmDialog.jsx';
import { useToast } from './Toast.jsx';
import { LEGAL_DOCS } from '../lib/legalDocs.js';

/**
 * Full-screen blocking gate shown when an account's legal_accepted_version
 * doesn't match the server's current required-docs version — either a brand
 * new document requirement, or an already-accepted document got a new
 * revision. Decline doesn't lock the account forever: it offers logout or
 * self-service account deletion, per the offer's §8.3/consent's §8.3 (declining
 * consent means the contract/consent can't continue, not that the person is
 * trapped).
 */
export default function LegalGate({ role, authFetch, onAccepted, onLogout, onDeleted }) {
  const [declined, setDeclined] = useState(false);
  const [busy, setBusy] = useState(false);
  const confirm = useConfirm();
  const toast = useToast();

  const docs = role === 'business' ? [LEGAL_DOCS.personal_data_consent] : [LEGAL_DOCS.offer, LEGAL_DOCS.personal_data_consent];
  const base = role === 'business' ? '/api/business' : '/api/creator';

  const accept = async () => {
    setBusy(true);
    try {
      const res = await authFetch(`${base}/legal/accept`, { method: 'POST' });
      if (!res.ok) throw new Error('accept-failed');
      const payload = await res.json();
      onAccepted(payload);
    } catch {
      toast.error('Не удалось сохранить согласие. Попробуйте ещё раз.');
    } finally {
      setBusy(false);
    }
  };

  const decline = async () => {
    setBusy(true);
    try {
      await authFetch(`${base}/legal/decline`, { method: 'POST' });
    } finally {
      setBusy(false);
      setDeclined(true);
    }
  };

  const deleteAccount = async () => {
    const yes = await confirm({
      title: 'Удалить аккаунт?',
      message: 'Доступ к аккаунту будет закрыт, персональные данные обезличены. Восстановление невозможно.',
      confirmText: 'Удалить',
      danger: true,
    });
    if (!yes) return;
    setBusy(true);
    try {
      const res = await authFetch(`${base}/account`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete-failed');
      onDeleted();
    } catch {
      toast.error('Не удалось удалить аккаунт. Попробуйте ещё раз.');
      setBusy(false);
    }
  };

  return (
    <div className="legal-gate" role="dialog" aria-modal="true">
      <div className="legal-gate__card">
        {!declined ? (
          <>
            <h2 className="legal-gate__title">Нужно принять документы</h2>
            <p className="legal-gate__text">
              Чтобы продолжить пользоваться кабинетом CLICKI, примите{' '}
              {docs.map((d, i) => (
                <span key={d.path}>
                  <Link to={d.path} target="_blank" rel="noopener noreferrer">{d.label}</Link>
                  {i < docs.length - 1 ? ' и ' : ''}
                </span>
              ))}
              .
            </p>
            <div className="legal-gate__actions">
              <button className="btn btn--ghost btn--sm" onClick={decline} disabled={busy}>Отказаться</button>
              <button className="btn btn--primary" onClick={accept} disabled={busy}>Принять</button>
            </div>
          </>
        ) : (
          <>
            <h2 className="legal-gate__title">Без принятия документов доступ к кабинету закрыт</h2>
            <p className="legal-gate__text">
              Можно выйти из аккаунта или удалить его полностью. Удаление необратимо: доступ закрывается,
              персональные данные обезличиваются, юридические и финансовые записи сохраняются согласно закону.
            </p>
            <div className="legal-gate__actions">
              <button className="btn btn--ghost btn--sm" onClick={onLogout} disabled={busy}>Выйти</button>
              <button className="btn btn--danger" onClick={deleteAccount} disabled={busy}>Удалить аккаунт</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
