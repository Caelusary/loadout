import { CheckCircle, WarningCircle } from '@phosphor-icons/react';
import { createContext, use, useCallback, useMemo, useRef, useState } from 'react';

const ToastContext = createContext(null);
const DURATION_MS = 3200;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const show = useCallback(
    (message, { tone = 'success' } = {}) => {
      const id = ++nextId.current;
      setToasts((list) => [...list.slice(-2), { id, message, tone }]);
      setTimeout(() => dismiss(id), DURATION_MS);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ show, error: (message) => show(message, { tone: 'error' }) }), [show]);

  return (
    <ToastContext value={value}>
      {children}
      {/* Phones show toasts under the top bar: the bottom holds the tab bar and, on product pages, the buy bar. */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 z-50 flex flex-col items-center gap-2 px-4 max-sm:top-[calc(env(safe-area-inset-top,0px)+4.5rem)] sm:bottom-0 sm:pb-[max(1.25rem,env(safe-area-inset-bottom))]"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="pointer-events-auto flex max-w-md items-center gap-2.5 rounded-panel border border-seam bg-raised px-4 py-3 text-sm text-ink shadow-[0_8px_24px_-12px_rgb(0_0_0/0.6)] transition-[opacity,translate] duration-200 ease-out starting:opacity-0 max-sm:starting:-translate-y-2 sm:starting:translate-y-2"
          >
            {t.tone === 'error' ? (
              <WarningCircle size={18} weight="fill" className="shrink-0 text-bad" />
            ) : (
              <CheckCircle size={18} weight="fill" className="shrink-0 text-ok" />
            )}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext>
  );
}

export const useToast = () => use(ToastContext);
