import { useEffect, useState } from 'react';

/**
 * Inline two-step delete button. First click arms it ("Точно удалить?"); a second
 * click within a few seconds runs onConfirm. Auto-disarms so a stray first click
 * can't leave it primed. onConfirm may be async; the button shows "Удаляю…" while
 * it runs. Errors are the caller's to surface (toast / inline).
 */
export default function ConfirmDelete({ onConfirm, label = 'Удалить', armedLabel = 'Точно удалить?', className = '' }) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!armed) return undefined;
    const id = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(id);
  }, [armed]);

  const onClick = async () => {
    if (!armed) {
      setArmed(true);
      return;
    }
    setBusy(true);
    try {
      await onConfirm();
    } catch {
      /* caller surfaces the error */
    } finally {
      setBusy(false);
      setArmed(false);
    }
  };

  return (
    <button
      type="button"
      className={`btn btn--sm confirm-del ${armed ? 'confirm-del--armed' : 'btn--ghost'} ${className}`}
      onClick={onClick}
      disabled={busy}
      aria-label={armed ? armedLabel : label}
    >
      {busy ? 'Удаляю…' : armed ? armedLabel : label}
    </button>
  );
}
