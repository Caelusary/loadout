import { ArrowLeft, CaretDown, Lightning, Moon, ShoppingBagOpen, SignOut, Sun } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router';
import { initials } from '../../lib/format.js';
import { useAuth } from '../../providers/AuthProvider.jsx';
import { useCart } from '../../providers/CartProvider.jsx';
import { usePerformance } from '../../providers/PerformanceProvider.jsx';
import { useTheme } from '../../providers/ThemeProvider.jsx';
import { ButtonLink } from '../ui/Button.jsx';
import { SearchBox } from './SearchBox.jsx';
import { Logo } from './Logo.jsx';
import { MenuButton } from './MobileMenu.jsx';
import { SearchOverlay } from './SearchOverlay.jsx';
import { NavTip } from './NavTip.jsx';
import { NotificationBell } from './NotificationBell.jsx';
import { useSignOut } from './useSignOut.jsx';
import { accountSections, sectionLabel } from './accountLinks.js';

function AccountMenu() {
  const auth = useAuth();
  const { user } = auth;
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const signOut = useSignOut();

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

  const sections = accountSections(auth);
  // A rider's two pages sit in the navbar itself, so the menu keeps only settings and sign out.
  if (auth.isRider) sections.workspace = [];

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
          {/* Your name opens your settings, the way most apps do it. */}
          <Link
            to="/account"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 rounded-control bg-raised/60 p-2.5 transition-colors hover:bg-raised"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent/15 font-mono text-[12px] font-medium text-accent-ink">
              {initials(user.name)}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium text-ink">{user.name}</span>
              <span className="truncate text-[12px] text-ink-3">{user.email}</span>
              <span className="mt-0.5 text-[12px] text-accent-ink">Account settings</span>
            </span>
          </Link>
          {Object.entries(sections).map(
            ([key, links]) =>
              links.length > 0 && (
                <div key={key} role="group" aria-label={sectionLabel(key, auth)}>
                  <p className="px-3 pt-3 pb-1 text-[11px] font-medium tracking-wider text-ink-3 uppercase">
                    {sectionLabel(key, auth)}
                  </p>
                  {links.map(([to, label, Icon]) => (
                    <Link
                      key={to}
                      to={to}
                      role="menuitem"
                      onClick={() => setOpen(false)}
                      className="flex h-10 items-center gap-2.5 rounded-control px-3 text-sm text-ink-2 hover:bg-raised hover:text-ink"
                    >
                      <Icon size={17} />
                      {label}
                    </Link>
                  ))}
                </div>
              ),
          )}
          <div className="mt-1.5 border-t border-seam pt-1.5" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              signOut.ask();
            }}
            className="flex h-10 w-full items-center gap-2.5 rounded-control px-3 text-left text-sm text-ink-2 hover:bg-raised hover:text-ink"
          >
            <SignOut size={17} />
            Sign out
          </button>
        </div>
      )}
      {signOut.dialog}
    </div>
  );
}

const pillButton =
  'relative grid size-9 place-items-center rounded-full transition-[color,background-color,box-shadow] duration-150';

// Desktop and tablets: the two display settings share one pill, apart from the cart, alerts and account
// (phones have both in the menu). Lite mode stays lit and labelled while it's on, so its state reads without hovering.
function SettingsPill() {
  const perf = usePerformance();
  const { theme, toggle } = useTheme();
  const dark = theme === 'dark';
  return (
    <div className="flex items-center rounded-full border border-seam bg-plate/60 p-0.5 max-sm:hidden">
      <NavTip label="Lite mode">
        <button
          type="button"
          aria-pressed={perf.on}
          onClick={perf.toggle}
          aria-label="Lite mode"
          className={`${pillButton} ${perf.on ? 'w-auto grid-flow-col gap-1.5 bg-accent/10 pr-3 pl-2.5 text-accent-ink ring-1 ring-accent/50' : 'text-ink-2 hover:bg-raised hover:text-ink'}`}
        >
          <Lightning size={19} weight={perf.on ? 'fill' : 'regular'} />
          {perf.on && (
            <span className="font-display text-[13px] font-semibold tracking-[0.02em]" aria-hidden="true">
              Lite
            </span>
          )}
        </button>
      </NavTip>
      <span className="mx-0.5 h-5 w-px bg-seam" aria-hidden="true" />
      <NavTip label={`Theme: ${dark ? 'Dark' : 'Light'}`}>
        <button
          type="button"
          onClick={toggle}
          aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
          className={`${pillButton} text-ink-2 hover:bg-raised hover:text-ink`}
        >
          {dark ? <Sun size={19} /> : <Moon size={19} />}
        </button>
      </NavTip>
    </div>
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

const RIDER_NAV = [
  ['/deliveries', 'Deliveries'],
  ['/account/rider', 'Delivery profile'],
];

export function Navbar() {
  const { user, status, canShop, isRider, isSeller, isAdmin } = useAuth();
  const { count } = useCart();
  const { pathname } = useLocation();
  // The homepage has its own spec search in the hero.
  const onHome = pathname === '/';
  // A rider's two navbar pages are where they start, and the shop (links, search) isn't theirs to browse.
  const atStart = onHome || (isRider && RIDER_NAV.some(([to]) => to === pathname));

  return (
    <header className="sticky top-0 z-30 border-b border-seam bg-bg/80 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-[1280px] items-center gap-4 px-4 sm:px-6">
        {!atStart && <BackButton />}
        <Logo compact={!onHome} />
        {isRider && (
          <nav className="flex items-center gap-1.5 max-sm:hidden" aria-label="Main">
            {RIDER_NAV.map(([to, label]) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex h-10 items-center rounded-control px-3 text-sm transition-colors hover:text-ink ${isActive ? 'text-ink' : 'text-ink-2'}`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        )}
        {!isRider && (
          <nav className="flex items-center gap-1.5 max-sm:hidden" aria-label="Main">
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
            {/* A seller's or admin's workplace, one click away like the rider's Deliveries (it was only in the account menu).
                Wide screens only: below that it would squeeze the search box, and the account menu still has it. */}
            {isSeller && (
              <NavLink
                to="/seller"
                className={({ isActive }) =>
                  `flex h-10 items-center rounded-control px-3 text-sm whitespace-nowrap transition-colors hover:text-ink max-xl:hidden ${isActive ? 'text-ink' : 'text-ink-2'}`
                }
              >
                Seller Center
              </NavLink>
            )}
            {isAdmin && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  `flex h-10 items-center rounded-control px-3 text-sm whitespace-nowrap transition-colors hover:text-ink max-xl:hidden ${isActive ? 'text-ink' : 'text-ink-2'}`
                }
              >
                Admin panel
              </NavLink>
            )}
          </nav>
        )}
        <div className="ml-auto flex flex-1 items-center justify-end gap-2">
          {/* The home page has its own search bar, so the navbar only adds one elsewhere. */}
          {!onHome && !isRider && <SearchBox />}
          {!onHome && !isRider && <SearchOverlay />}
          <SettingsPill />
          {canShop && (
            // The cart is in the top bar on phones too: it's not a tab there (MobileTabBar).
            <NavTip label={count ? `Cart · ${count} item${count === 1 ? '' : 's'}` : 'Cart'}>
              <Link
                to="/cart"
                aria-label={`Cart, ${count} item${count === 1 ? '' : 's'}`}
                className="relative grid size-10 place-items-center rounded-control text-ink-2 transition-colors hover:bg-raised hover:text-ink"
              >
                <ShoppingBagOpen size={21} />
                {count > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-accent px-1 font-mono text-[11px] font-medium text-on-accent tabular-nums">
                    {count}
                  </span>
                )}
              </Link>
            </NavTip>
          )}
          {user && <NotificationBell />}
          {status === 'loading' ? (
            <span className="size-10" aria-hidden="true" />
          ) : user ? (
            // On phones the account, theme and sign-out live in the tab bar's menu.
            <div className="max-sm:hidden">
              <AccountMenu />
            </div>
          ) : (
            <>
              <ButtonLink to="/login" variant="ghost" size="sm" className="h-10! max-sm:hidden">
                Sign in
              </ButtonLink>
              {/* Wrapped: the button's own inline-flex would override `hidden` on the button itself. */}
              <span className="hidden sm:contents">
                <ButtonLink to="/register" variant="primary" size="sm" className="h-10!">
                  Create account
                </ButtonLink>
              </span>
            </>
          )}
          <MenuButton />
        </div>
      </div>
    </header>
  );
}
