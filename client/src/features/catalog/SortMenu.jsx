import { CaretDown, X } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/ui/Button.jsx';

// The same radio rows as the filters, so sorting looks like the rest of the shop instead of the phone's
// own picker (a native <select> opens in the system's colors on Android).
function SortOptions({ sorts, value, onPick, name }) {
  return (
    <fieldset className="flex flex-col gap-0.5">
      <legend className="sr-only">Sort by</legend>
      {sorts.map(([optionValue, label]) => (
        <label
          key={optionValue}
          className="flex h-11 cursor-pointer items-center gap-2.5 rounded-control px-2 text-sm text-ink-2 hover:bg-raised has-checked:text-ink lg:h-9"
        >
          <input
            type="radio"
            name={name}
            checked={value === optionValue}
            onChange={() => onPick(optionValue)}
            className="accent-accent-ink"
          />
          {label}
        </label>
      ))}
    </fieldset>
  );
}

// Phones and tablets get a bottom sheet like the filters; desktop gets a small dropdown.
export function SortMenu({ sorts, value, onChange }) {
  const sheet = useRef(null);
  const box = useRef(null);
  const [open, setOpen] = useState(false);
  const label = sorts.find(([v]) => v === value)?.[1] ?? sorts[0][1];

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => !box.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const pick = (next) => {
    onChange(next);
    setOpen(false);
    sheet.current?.close();
  };

  return (
    <div ref={box} className="relative">
      <Button
        variant="secondary"
        size="sm"
        className="w-52 [&>span]:w-full [&>span]:justify-between"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (window.matchMedia('(min-width: 1024px)').matches ? setOpen((o) => !o) : sheet.current?.showModal())}
      >
        <span className="truncate">
          <span className="text-ink-3">Sort:</span> {label}
        </span>
        <CaretDown size={12} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </Button>
      {open && (
        // Same width and left edge as the button, just below it.
        <div className="absolute top-full right-0 left-0 z-30 mt-1.5 rounded-panel border border-seam bg-plate p-1.5 shadow-[0_12px_32px_-16px_rgb(0_0_0/0.45)]">
          <SortOptions sorts={sorts} value={value} onPick={pick} name="sort-desktop" />
        </div>
      )}
      <dialog
        ref={sheet}
        aria-label="Sort by"
        onClick={(e) => e.target === sheet.current && sheet.current.close()}
        className="mt-auto mb-0 max-h-[85dvh] w-full max-w-none rounded-t-panel border-t border-seam bg-plate p-0 text-ink lg:hidden"
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-seam bg-plate px-4 py-3">
          <h2 className="wide text-lg font-bold">Sort by</h2>
          <button
            type="button"
            onClick={() => sheet.current?.close()}
            aria-label="Close sorting"
            className="grid size-10 place-items-center rounded-control text-ink-2 hover:bg-raised"
          >
            <X size={20} />
          </button>
        </div>
        <div className="px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <SortOptions sorts={sorts} value={value} onPick={pick} name="sort-sheet" />
        </div>
      </dialog>
    </div>
  );
}
