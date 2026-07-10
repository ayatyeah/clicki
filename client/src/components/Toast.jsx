import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * App-wide toast notifications. Before this, feedback after an action was either
 * an inline "Сохранено ✓" in some places or nothing at all in others (uploading
 * a screenshot, accepting work, assigning a brief). One consistent channel:
 *   const toast = useToast();
 *   toast.success('Скриншот загружен');
 *   toast.error('Не удалось загрузить');
 *
 * Auto-dismisses; stacks bottom-right; respects prefers-reduced-motion via CSS.
 */
const ToastContext = createContext(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  // Never throw if used outside the provider — feedback must not break a flow.
  return ctx || { success() {}, error() {}, info() {} };
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const remove = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const push = useCallback(
    (message, tone) => {
      if (!message) return;
      const id = ++idRef.current;
      setToasts((list) => [...list, { id, message, tone }]);
      setTimeout(() => remove(id), 3500);
    },
    [remove]
  );

  const api = useRef({
    success: (m) => push(m, 'success'),
    error: (m) => push(m, 'error'),
    info: (m) => push(m, 'info'),
  }).current;

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div className="toast-stack" role="status" aria-live="polite">
          {toasts.map((t) => (
            <button key={t.id} className={`toast toast--${t.tone}`} onClick={() => remove(t.id)}>
              <span className="toast__icon" aria-hidden="true">{t.tone === 'error' ? '⚠' : t.tone === 'info' ? 'ℹ' : '✓'}</span>
              <span>{t.message}</span>
            </button>
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}
