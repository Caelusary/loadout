import { CaretDown } from '@phosphor-icons/react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const MENU_WIDTH = 224;

// A table row's actions behind one "Manage" button, in labelled groups. The menu is fixed to the viewport, so a
// table that scrolls sideways can't clip it, and it opens upward when the row sits near the bottom of the screen.
// `groups` is [{ label, items: [{ label, onSelect, danger }] }]; empty groups are skipped and a danger group gets a
// divider above it. Arrow keys, Home and End move between items; Escape closes and returns focus to the button.
export function RowMenu({ groups, label = 'Manage', ariaLabel }) {
  const [pos, setPos] = useState(null); // { top, left } while open
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const shown = groups.filter((g) => g.items.length);

  const close = (refocus) => {
    setPos(null);
    if (refocus) buttonRef.current?.focus();
  };

  const open = () => {
    const r = buttonRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 6, left: Math.max(8, r.right - MENU_WIDTH), anchorTop: r.top });
  };

  // Once the menu has a height, flip it above the button if it would run off the bottom. It stays hidden until then,
  // and a hidden item can't take focus, so the first item is focused on the pass after it's placed.
  useLayoutEffect(() => {
    if (!pos) return;
    if (pos.placed) {
      menuRef.current.querySelector('[role=menuitem]')?.focus();
      return;
    }
    const h = menuRef.current.offsetHeight;
    // On phones the tab bar covers the bottom of the screen, so the menu must clear it too.
    const bar = document.querySelector('[data-bottom-bar]')?.getBoundingClientRect();
    const floor = bar?.height ? bar.top : window.innerHeight;
    const top = pos.top + h > floor - 8 ? Math.max(8, pos.anchorTop - h - 6) : pos.top;
    setPos({ ...pos, top, placed: true });
  }, [pos]);

  useEffect(() => {
    if (!pos) return;
    const onDown = (e) =>
      !menuRef.current?.contains(e.target) && !buttonRef.current?.contains(e.target) && close(false);
    // A fixed menu would drift from its row, so scrolling or resizing closes it.
    const onMove = () => close(false);
    document.addEventListener('pointerdown', onDown);
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [pos]);

  const onKeyDown = (e) => {
    const items = [...menuRef.current.querySelectorAll('[role=menuitem]')];
    const i = items.indexOf(document.activeElement);
    const go = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: items.length - 1 }[e.key];
    if (go !== undefined) {
      e.preventDefault();
      items[(go + items.length) % items.length]?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close(true);
    } else if (e.key === 'Tab') {
      close(false);
    }
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={Boolean(pos)}
        aria-label={ariaLabel}
        onClick={() => (pos ? close(false) : open())}
        className={`inline-flex h-9 items-center gap-1.5 rounded-control border px-3 text-[13px] font-medium transition-colors ${
          pos ? 'border-edge bg-raised text-ink' : 'border-seam text-ink-2 hover:border-edge hover:text-ink'
        }`}
      >
        {label}
        <CaretDown size={12} className={`transition-transform duration-150 ${pos ? 'rotate-180' : ''}`} />
      </button>
      {pos && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={ariaLabel}
          onKeyDown={onKeyDown}
          style={{
            top: pos.top,
            left: pos.left,
            width: MENU_WIDTH,
            visibility: pos.placed ? 'visible' : 'hidden',
          }}
          className="fixed z-50 rounded-panel border border-seam bg-plate p-1.5 text-left shadow-[0_12px_32px_-16px_rgb(0_0_0/0.7)] transition-[opacity,scale] duration-150 ease-out starting:scale-95 starting:opacity-0"
        >
          {shown.map((g, gi) => (
            <div
              key={g.label}
              role="group"
              aria-label={g.label}
              className={g.danger && gi > 0 ? 'mt-1.5 border-t border-seam pt-1.5' : gi > 0 ? 'mt-1' : ''}
            >
              {!g.danger && (
                <p className="px-3 pt-1.5 pb-1 text-[11px] font-medium tracking-wider text-ink-3 uppercase">
                  {g.label}
                </p>
              )}
              {g.items.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    close(true);
                    item.onSelect();
                  }}
                  className={`flex h-9 w-full items-center rounded-control px-3 text-left text-sm outline-none focus-visible:bg-raised ${
                    g.danger
                      ? 'text-bad hover:bg-bad/10 focus-visible:bg-bad/10'
                      : 'text-ink-2 hover:bg-raised hover:text-ink focus-visible:text-ink'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
