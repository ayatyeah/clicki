import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * In-site confirmation dialog, replacing the native window.confirm() used for
 * destructive actions (delete a business account, mark a payout paid). Native
 * confirm() is unstyled, jarring on mobile, and blocks the whole thread.
 *
 * Promise-based so call sites read almost like the old code:
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title: 'Удалить аккаунт?', danger: true }))) return;
 */
const ConfirmContext = createContext(null);

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  // Fallback to native confirm if used outside the provider, so a call never hangs.
  return ctx || ((opts) => Promise.resolve(window.confirm(opts?.message || opts?.title || 'Подтвердить?')));
}

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null); // { title, message, confirmText, cancelText, danger }
  const resolverRef = useRef(null);

  const confirm = useCallback((opts) => {
    setState({
      title: opts?.title || 'Подтвердите действие',
      message: opts?.message || '',
      confirmText: opts?.confirmText || 'Подтвердить',
      cancelText: opts?.cancelText || 'Отмена',
      danger: !!opts?.danger,
    });
    return new Promise((resolve) => { resolverRef.current = resolve; });
  }, []);

  const settle = useCallback((value) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setState(null);
  }, []);

  useEffect(() => {
    if (!state) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') settle(false);
      else if (e.key === 'Enter') settle(true);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [state, settle]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state &&
        createPortal(
          <div className="confirm" role="dialog" aria-modal="true" onClick={() => settle(false)}>
            <div className="confirm__card" onClick={(e) => e.stopPropagation()}>
              <h3 className="confirm__title">{state.title}</h3>
              {state.message && <p className="confirm__msg">{state.message}</p>}
              <div className="confirm__actions">
                <button className="btn btn--ghost btn--sm" onClick={() => settle(false)} autoFocus>{state.cancelText}</button>
                <button className={`btn btn--sm ${state.danger ? 'btn--danger' : 'btn--primary'}`} onClick={() => settle(true)}>
                  {state.confirmText}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </ConfirmContext.Provider>
  );
}
