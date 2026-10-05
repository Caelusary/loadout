import { useEffect, useRef } from 'react';
import { Button } from './Button.jsx';

// Native <dialog>: focus trapping, Escape and the backdrop come from the browser.
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = 'Keep it',
  tone = 'danger',
  pending,
  onConfirm,
  onClose,
}) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-panel border border-seam bg-plate p-0 text-ink"
    >
      <div className="flex flex-col gap-3 p-6">
        <h2 className="wide text-lg font-bold">{title}</h2>
        <div className="text-sm text-ink-2">{children}</div>
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={pending}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
