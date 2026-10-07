import { MagnifyingGlass } from '@phosphor-icons/react';
import { useRef } from 'react';
import { SearchBox } from './SearchBox.jsx';

// Phones and small tablets: the search icon opens a full-screen search with the keyboard already up,
// instead of sending people to the shop page to look for a box. Desktop has the bar in the navbar.
export function SearchOverlay() {
  const dialog = useRef(null);
  const input = useRef(null);
  const close = () => dialog.current?.close();
  return (
    <>
      <button
        type="button"
        aria-label="Search products"
        onClick={() => {
          dialog.current.showModal();
          // Focus inside the tap itself, or phones won't raise the keyboard.
          input.current?.focus();
        }}
        className="grid size-10 place-items-center rounded-control text-ink-2 hover:bg-raised hover:text-ink md:hidden"
      >
        <MagnifyingGlass size={20} />
      </button>
      <dialog
        ref={dialog}
        aria-label="Search products"
        onClick={(e) => e.target === dialog.current && close()}
        className="mt-0 mb-auto w-full max-w-none border-b border-seam bg-bg p-0 pt-[env(safe-area-inset-top)] text-ink backdrop:bg-black/60"
      >
        <div className="flex items-start gap-2 px-4 py-3">
          <SearchBox overlay inputRef={input} onDone={close} />
          <button type="button" onClick={close} className="h-10 shrink-0 rounded-control px-2 text-sm text-ink-2 hover:text-ink">
            Cancel
          </button>
        </div>
      </dialog>
    </>
  );
}
