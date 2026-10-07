import { CaretRight, Gauge, Heart, List, Moon, Package, ShieldCheck, SignOut, Storefront, Sun, Tag, Truck, UserCircle, X } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router';
import { initials } from '../../lib/format.js';
import { ButtonLink } from '../ui/Button.jsx';
import { accountLinks } from './accountLinks.js';
import { useAuth } from '../../providers/AuthProvider.jsx';
import { usePerformance } from '../../providers/PerformanceProvider.jsx';
import { useTheme } from '../../providers/ThemeProvider.jsx';

const ICONS = {
  '/admin': ShieldCheck,
  '/seller': Storefront,
  '/deliveries': Truck,
  '/account': UserCircle,
  '/account/orders': Package,
  '/account/wishlist': Heart,
  '/account/sell': Tag,
};

const rowBase = 'flex h-12 w-full items-center gap-3 rounded-control px-3 text-left text-[15px] transition-colors active:bg-raised hover:bg-raised';
const row = `${rowBase} text-ink-2 hover:text-ink`;

// One on/off row with a switch on the right.
function SwitchRow({ icon: Icon, label, on, onToggle }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={onToggle} className={`${row} justify-between`}>
      <span className="flex items-center gap-3">
        <Icon size={20} />
        {label}
      </span>
      <span className={`relative h-6 w-11 rounded-full border transition-colors ${on ? 'border-accent-ink bg-accent/25' : 'border-seam bg-raised'}`} aria-hidden="true">
        <span className={`absolute top-0.5 size-[18px] rounded-full transition-[left,background-color] duration-150 ${on ? 'left-[22px] bg-accent' : 'left-0.5 bg-ink-3'}`} />
      </span>
    </button>
  );
}

function ThemeSwitch() {
  const { theme, toggle } = useTheme();
  const dark = theme === 'dark';
  return <SwitchRow icon={dark ? Moon : Sun} label="Dark theme" on={dark} onToggle={toggle} />;
}

function PerformanceSwitch() {
  const perf = usePerformance();
  return <SwitchRow icon={Gauge} label="Performance mode" on={perf.on} onToggle={perf.toggle} />;
}

// Phones: the account, its pages, the theme, Performance mode and signing in or out, in a panel that drops down from the
// top bar and is only as tall as what's in it. The header stays visible above it; the page dims below.
function MenuPanel({ onClose }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const panel = useRef(null);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    panel.current?.querySelector('a, button')?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-x-0 top-[calc(4rem+1px+env(safe-area-inset-top))] bottom-0 z-50 sm:hidden">
      <button type="button" aria-label="Close menu" tabIndex={-1} onClick={onClose} className="absolute inset-0 bg-black/55" />
      <div
        ref={panel}
        role="dialog"
        aria-label="Menu"
        className="relative max-h-full overflow-y-auto border-b border-seam bg-plate px-3 pt-3 pb-4 text-ink shadow-[0_16px_32px_-16px_rgb(0_0_0/0.6)] transition-[opacity,translate] duration-150 ease-out starting:-translate-y-2 starting:opacity-0"
      >
        {auth.user ? (
          <>
            <Link
              to="/account"
              onClick={onClose}
              className="mb-2 flex items-center gap-3 rounded-panel border border-seam bg-raised/60 p-3 active:bg-raised"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent/15 font-mono text-[13px] font-medium text-accent-ink">
                {initials(auth.user.name)}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium">{auth.user.name}</span>
                <span className="truncate text-[13px] text-ink-3">{auth.user.email}</span>
              </span>
              <CaretRight size={16} className="shrink-0 text-ink-3" />
            </Link>
            <ul className="flex flex-col">
              {accountLinks(auth)
                .filter(([to]) => to !== '/account')
                .map(([to, label]) => {
                  const Icon = ICONS[to] ?? UserCircle;
                  return (
                    <li key={to}>
                      <Link to={to} onClick={onClose} className={row}>
                        <Icon size={20} />
                        {label}
                      </Link>
                    </li>
                  );
                })}
            </ul>
          </>
        ) : (
          <div className="mb-2 flex flex-col gap-2 p-1">
            <p className="px-1 pb-1 text-sm text-ink-2">Sign in to check out, save products and track your orders.</p>
            <div className="grid grid-cols-2 gap-2">
              <ButtonLink to="/login" onClick={onClose}>
                Sign in
              </ButtonLink>
              <ButtonLink to="/register" variant="secondary" onClick={onClose}>
                Create account
              </ButtonLink>
            </div>
          </div>
        )}
        <div className="mt-2 border-t border-seam pt-2">
          <ThemeSwitch />
          <PerformanceSwitch />
          {auth.user && (
            <button
              type="button"
              onClick={async () => {
                onClose();
                await auth.logout();
                navigate('/');
              }}
              className={`${rowBase} text-bad`}
            >
              <SignOut size={20} />
              Sign out
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// The phone top bar's menu button; it turns into a close button while the menu is open.
export function MenuButton() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  // Following a link closes it; so does any other navigation (back button, a tab).
  const [openedOn, setOpenedOn] = useState(pathname);
  if (open && openedOn !== pathname) setOpen(false);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpenedOn(pathname);
          setOpen((o) => !o);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={open ? 'Close menu' : 'Menu'}
        className="grid size-10 place-items-center rounded-control text-ink-2 hover:bg-raised hover:text-ink sm:hidden"
      >
        {open ? <X size={22} /> : <List size={22} />}
      </button>
      {open && <MenuPanel onClose={() => setOpen(false)} />}
    </>
  );
}
