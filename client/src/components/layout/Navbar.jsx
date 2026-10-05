import { ArrowLeft, CaretDown, MagnifyingGlass, Moon, ShoppingBagOpen, Sun } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router';
import { initials } from '../../lib/format.js';
import { useAuth } from '../../providers/AuthProvider.jsx';
import { useCart } from '../../providers/CartProvider.jsx';
import { useTheme } from '../../providers/ThemeProvider.jsx';
import { ButtonLink } from '../ui/Button.jsx';
import { SearchBox } from './SearchBox.jsx';
import { Logo } from './Logo.jsx';
import { NotificationBell } from './NotificationBell.jsx';
import { accountLinks } from './accountLinks.js';

function AccountMenu() {
  const { user, isAdmin, isSeller, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const links = accountLinks({ user, isAdmin, isSeller });

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-10 items-center gap-2 rounded-control pr-2 pl-1 text-sm text-ink-2 transition-colors hover:bg-raised hover:text-ink"
      >
        <span className="grid size-8 place-items-center rounded-full bg-raised font-mono text-[12px] text-ink">
          {initials(user.name)}
        </span>
        <span className="hidden max-w-32 truncate lg:inline">{user.name.split(' ')[0]}</span>
        <CaretDown size={12} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute top-12 right-0 z-40 w-56 origin-top-right rounded-panel border border-seam bg-plate p-1.5 shadow-[0_12px_32px_-16px_rgb(0_0_0/0.7)] transition-[opacity,scale] duration-150 ease-out starting:scale-95 starting:opacity-0"
        >
          <p className="truncate px-3 pt-2 pb-2.5 text-[13px] text-ink-3">{user.email}</p>
          {links.map(([to, label]) => (
            <Link
              key={to}
              to={to}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex h-10 items-center rounded-control px-3 text-sm text-ink-2 hover:bg-raised hover:text-ink"
            >
              {label}
            </Link>
          ))}
          <button
            type="button"
            role="menuitem"
            onClick={async () => {
              setOpen(false);
              await logout();
              navigate('/');
            }}
            className="flex h-10 w-full items-center rounded-control px-3 text-left text-sm text-ink-2 hover:bg-raised hover:text-ink"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const dark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={dark ? 'Light theme' : 'Dark theme'}
      className="grid size-10 place-items-center rounded-control text-ink-2 transition-colors hover:bg-raised hover:text-ink"
    >
      {dark ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
}

// Steps back through the app; a page opened directly (no in-app history) goes to the homepage instead.
function BackButton() {
  const navigate = useNavigate();
  const { key } = useLocation();
  return (
    <button
      type="button"
      onClick={() => (key === 'default' ? navigate('/') : navigate(-1))}
      aria-label="Go back"
      title="Back"
      className="grid size-10 shrink-0 place-items-center rounded-full border border-seam text-ink-2 transition-[color,border-color,transform] duration-150 ease-out hover:border-edge hover:text-ink active:scale-95"
    >
      <ArrowLeft size={18} weight="bold" />
    </button>
  );
}

export function Navbar() {
  const { user, status, isAdmin } = useAuth();
  const { count } = useCart();
  // The homepage has its own spec search in the hero.
  const onHome = useLocation().pathname === '/';

  return (
    <header className="sticky top-0 z-30 border-b border-seam bg-bg/80 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-[1280px] items-center gap-4 px-4 sm:px-6">
        {!onHome && <BackButton />}
        <Logo compact={!onHome} />
        <nav className="flex items-center max-sm:hidden" aria-label="Main">
          <NavLink
            to="/shop"
            className={({ isActive }) =>
              `flex h-10 items-center rounded-control px-3 text-sm transition-colors hover:text-ink ${isActive ? 'text-ink' : 'text-ink-2'}`
            }
          >
            Shop
          </NavLink>
          <NavLink
            to="/loadout"
            className={({ isActive }) =>
              `flex h-10 items-center rounded-control px-3 text-sm transition-colors hover:text-ink ${isActive ? 'text-ink' : 'text-ink-2'}`
            }
          >
            Build
          </NavLink>
        </nav>
        <div className="ml-auto flex flex-1 items-center justify-end gap-2">
          {!onHome && <SearchBox />}
          <Link
            to="/shop"
            aria-label="Search products"
            className="grid size-10 place-items-center rounded-control text-ink-2 hover:bg-raised hover:text-ink md:hidden"
          >
            <MagnifyingGlass size={20} />
          </Link>
          <ThemeToggle />
          {!isAdmin && (
            <Link
              to="/cart"
              aria-label={`Cart, ${count} item${count === 1 ? '' : 's'}`}
              className="relative grid size-10 place-items-center rounded-control text-ink-2 transition-colors hover:bg-raised hover:text-ink max-sm:hidden"
            >
              <ShoppingBagOpen size={21} />
              {count > 0 && (
                <span className="absolute -top-0.5 -right-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-accent px-1 font-mono text-[11px] font-medium text-on-accent tabular-nums">
                  {count}
                </span>
              )}
            </Link>
          )}
          {user && <NotificationBell />}
          {status === 'loading' ? (
            <span className="size-10" aria-hidden="true" />
          ) : user ? (
            // On phones the account (and cart) live in the bottom tab bar.
            <div className="max-sm:hidden">
              <AccountMenu />
            </div>
          ) : (
            <>
              <ButtonLink to="/login" variant="ghost" size="sm" className="max-sm:hidden">
                Sign in
              </ButtonLink>
              {/* Wrapped: the button's own inline-flex would override `hidden` on the button itself. */}
              <span className="hidden sm:contents">
                <ButtonLink to="/register" variant="primary" size="sm">
                  Create account
                </ButtonLink>
              </span>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
