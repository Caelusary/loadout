import { CaretRight, Lightning, List, Moon, SignOut, Sun, X } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router';
import { initials } from '../../lib/format.js';
import { ButtonLink } from '../ui/Button.jsx';
import { accountSections, sectionLabel as headingFor } from './accountLinks.js';
import { useAdminLinks } from './adminLinks.js';
import { useSignOut } from './useSignOut.jsx';
import { useAuth } from '../../providers/AuthProvider.jsx';
import { usePerformance } from '../../providers/PerformanceProvider.jsx';
import { useTheme } from '../../providers/ThemeProvider.jsx';

const rowBase =
  'flex h-12 w-full items-center gap-3 rounded-control px-3 text-left text-[15px] transition-colors active:bg-raised hover:bg-raised';
const row = `${rowBase} text-ink-2 hover:text-ink`;
const sectionLabel = 'px-3 pt-3 pb-1 text-[11px] font-medium tracking-wider text-ink-3 uppercase';

// One on/off row with a switch on the right.
function SwitchRow({ icon: Icon, label, on, onToggle }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className={`${row} justify-between`}
    >
      <span className="flex items-center gap-3">
        <Icon size={20} />
        {label}
      </span>
      <span
        className={`relative h-6 w-11 rounded-full border transition-colors ${on ? 'border-accent-ink bg-accent/25' : 'border-seam bg-raised'}`}
        aria-hidden="true"
      >
        <span
          className={`absolute top-0.5 size-[18px] rounded-full transition-[left,background-color] duration-150 ${on ? 'left-[22px] bg-accent' : 'left-0.5 bg-ink-3'}`}
        />
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
  return <SwitchRow icon={Lightning} label="Lite mode" on={perf.on} onToggle={perf.toggle} />;
}

// Phones: the account, its pages, the theme, Lite mode and signing in or out, in a panel that drops down from the
// top bar and is only as tall as what's in it. The header stays visible above it; the page dims below.
function MenuPanel({ onClose, onSignOut }) {
  const auth = useAuth();
  const adminLinks = useAdminLinks();
  // Nothing the tab bar already holds (MobileTabBar): a rider's two pages, an admin's main three, a seller's Seller
  // Center, a shopper's orders. An admin's menu lists the rest of the admin pages.
  // Signed out there are no account pages, just signing in, the display switches and the tab bar's pages.
  const sections = auth.user ? accountSections(auth) : {};
  const inTabs = new Set(['/seller', '/account/orders', '/deliveries', '/account/rider']);
  for (const key of Object.keys(sections)) sections[key] = sections[key].filter(([to]) => !inTabs.has(to));
  if (auth.isAdmin)
    sections.workspace = adminLinks.filter((l) => !l.tab).map((l) => [l.to, l.label, l.icon, l.count]);
  const panel = useRef(null);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    panel.current?.querySelector('a, button')?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-x-0 top-[calc(4rem+1px+env(safe-area-inset-top))] bottom-0 z-50 sm:hidden">
      <button
        type="button"
        aria-label="Close menu"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 bg-black/55"
      />
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
                <span className="mt-0.5 text-[13px] text-accent-ink">Account settings</span>
              </span>
              <CaretRight size={16} className="shrink-0 text-ink-3" />
            </Link>
            {Object.entries(sections).map(
              ([key, links]) =>
                links.length > 0 && (
                  <section key={key} aria-label={headingFor(key, auth)}>
                    <p className={sectionLabel}>{headingFor(key, auth)}</p>
                    <ul className="flex flex-col">
                      {links.map(([to, label, Icon, count]) => (
                        <li key={to}>
                          <Link to={to} onClick={onClose} className={row}>
                            <Icon size={20} />
                            {label}
                            {/* What's waiting there (an admin's approvals, complaints, returns). */}
                            {count > 0 && (
                              <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1.5 font-mono text-[11px] font-medium text-on-accent tabular-nums">
                                {count}
                                <span className="sr-only"> waiting</span>
                              </span>
                            )}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                ),
            )}
          </>
        ) : (
          <div className="mb-2 flex flex-col gap-2 p-1">
            <p className="px-1 pb-1 text-sm text-ink-2">
              Sign in to check out, save products and track your orders.
            </p>
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
        <div className="mt-2 border-t border-seam pt-1">
          <p className={sectionLabel}>Display</p>
          <ThemeSwitch />
          <PerformanceSwitch />
          {auth.user && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onSignOut();
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
  // Owned here, not by the panel: the panel unmounts when it closes, and the question outlives it.
  const signOut = useSignOut();
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
      {open && <MenuPanel onClose={() => setOpen(false)} onSignOut={signOut.ask} />}
      {signOut.dialog}
    </>
  );
}
