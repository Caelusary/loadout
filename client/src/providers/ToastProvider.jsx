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
      {/* Toasts drop in under the top bar, where people look first (and the bottom holds the phone tab bar and the
          compare tray). */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 z-50 flex flex-col items-center gap-2 px-4 top-[calc(env(safe-area-inset-top,0px)+4.75rem)]"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="pointer-events-auto flex max-w-md items-center gap-2.5 rounded-panel border border-seam bg-raised px-4 py-3 text-sm text-ink shadow-[0_8px_24px_-12px_rgb(0_0_0/0.6)] transition-[opacity,translate] duration-200 ease-out starting:-translate-y-2 starting:opacity-0"
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
