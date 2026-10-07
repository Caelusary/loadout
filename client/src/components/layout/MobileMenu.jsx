import { List, Moon, Sun } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { initials } from '../../lib/format.js';
import { accountLinks } from './accountLinks.js';
import { useAuth } from '../../providers/AuthProvider.jsx';
import { useTheme } from '../../providers/ThemeProvider.jsx';

const row = 'flex h-12 w-full items-center rounded-control px-3 text-left text-[15px] text-ink-2 active:bg-raised';

// Everything that doesn't fit in the phone tab bar: the account and its pages, the theme, and signing
// in or out. A bottom sheet, so it sits within thumb reach (the desktop menu lives in the top bar).
function MenuSheet({ onClose }) {
  const auth = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const ref = useRef(null);
  useEffect(() => {
    ref.current.showModal();
  }, []);
  const close = () => ref.current.close();
  const dark = theme === 'dark';
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && close()}
      aria-label="Menu"
      className="mt-auto mb-0 w-full max-w-none rounded-t-[20px] border-t border-seam bg-plate p-0 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] text-ink backdrop:bg-black/60 transition-[translate] duration-200 ease-out starting:open:translate-y-full"
    >
      <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-seam" aria-hidden="true" />
      {auth.user && (
        <div className="flex items-center gap-3 px-5 pt-4 pb-3">
          <span className="grid size-10 place-items-center rounded-full bg-raised font-mono text-[13px]">{initials(auth.user.name)}</span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{auth.user.name}</span>
            <span className="truncate text-[13px] text-ink-3">{auth.user.email}</span>
          </span>
        </div>
      )}
      <ul className="flex flex-col px-2 pt-2">
        {auth.user ? (
          accountLinks(auth).map(([to, label]) => (
            <li key={to}>
              <Link to={to} onClick={close} className={row}>
                {label}
              </Link>
            </li>
          ))
        ) : (
          <>
            <li>
              <Link to="/login" onClick={close} className={`${row} text-ink`}>
                Sign in
              </Link>
            </li>
            <li>
              <Link to="/register" onClick={close} className={row}>
                Create account
              </Link>
            </li>
          </>
        )}
        <li>
          <button type="button" onClick={toggle} className={`${row} justify-between`}>
            {dark ? 'Light theme' : 'Dark theme'}
            {dark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </li>
        {auth.user && (
          <li>
            <button
              type="button"
              onClick={async () => {
                close();
                await auth.logout();
                navigate('/');
              }}
              className={`${row} text-bad`}
            >
              Sign out
            </button>
          </li>
        )}
      </ul>
    </dialog>
  );
}

// The tab bar's last tab: opens the menu sheet.
export function MenuTab({ active }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={`relative flex h-full w-full flex-col items-center justify-center gap-1 text-[11px] transition-colors ${active ? 'text-accent-ink' : 'text-ink-3 active:text-ink'}`}
      >
        {active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-accent-ink" aria-hidden="true" />}
        <List size={22} weight={active ? 'bold' : 'regular'} />
        Menu
      </button>
      {open && <MenuSheet onClose={() => setOpen(false)} />}
    </>
  );
}
