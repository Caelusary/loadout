import { Heart, House, ShoppingBagOpen, SquaresFour, Storefront, UserCircle } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router';
import { initials } from '../../lib/format.js';
import { accountLinks } from './accountLinks.js';
import { useAuth } from '../../providers/AuthProvider.jsx';
import { useCart } from '../../providers/CartProvider.jsx';

// Signed-in users' account destinations and sign-out, as a bottom sheet (the desktop menu lives in the top bar).
function AccountSheet({ onClose }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const ref = useRef(null);
  useEffect(() => {
    ref.current.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && ref.current.close()}
      aria-label="Account"
      className="mt-auto mb-0 w-full max-w-none rounded-t-[20px] border-t border-seam bg-plate p-0 pb-[calc(var(--dock)+0.5rem)] text-ink backdrop:bg-black/60 transition-[translate] duration-200 ease-out starting:open:translate-y-full"
    >
      <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-seam" aria-hidden="true" />
      <div className="flex items-center gap-3 px-5 pt-4 pb-3">
        <span className="grid size-10 place-items-center rounded-full bg-raised font-mono text-[13px]">{initials(auth.user.name)}</span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{auth.user.name}</span>
          <span className="truncate text-[13px] text-ink-3">{auth.user.email}</span>
        </span>
      </div>
      <ul className="flex flex-col px-2">
        {accountLinks(auth).map(([to, label]) => (
          <li key={to}>
            <Link to={to} onClick={() => ref.current.close()} className="flex h-12 items-center rounded-control px-3 text-[15px] text-ink-2 active:bg-raised">
              {label}
            </Link>
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={async () => {
              ref.current.close();
              await auth.logout();
              navigate('/');
            }}
            className="flex h-12 w-full items-center rounded-control px-3 text-left text-[15px] text-bad active:bg-raised"
          >
            Sign out
          </button>
        </li>
      </ul>
    </dialog>
  );
}

// Phones get app-style navigation within thumb reach instead of a crowded top bar.
// Its height is the --dock token (index.css), which every bottom-fixed element sits above.
export function MobileTabBar() {
  const { user, isAdmin } = useAuth();
  const { count } = useCart();
  const [sheet, setSheet] = useState(false);
  const { pathname } = useLocation();
  const inAccountArea = /^\/(account|seller|admin)(\/|$)/.test(pathname) && !pathname.startsWith('/account/wishlist');

  const tabs = [
    { to: '/', label: 'Home', icon: House, end: true },
    { to: '/shop', label: 'Shop', icon: Storefront },
    { to: '/loadout', label: 'Build', icon: SquaresFour },
    ...(!isAdmin ? [{ to: '/account/wishlist', label: 'Saved', icon: Heart }] : []),
    ...(!isAdmin ? [{ to: '/cart', label: 'Cart', icon: ShoppingBagOpen, badge: count }] : []),
  ];

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-seam bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden"
    >
      <ul className="flex h-[60px] items-stretch">
        {tabs.map(({ to, label, icon: Icon, end, badge }) => (
          <li key={label} className="flex-1">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `relative flex h-full flex-col items-center justify-center gap-1 text-[11px] transition-colors ${isActive ? 'text-accent-ink' : 'text-ink-3 active:text-ink'}`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-accent-ink" aria-hidden="true" />}
                  <span className="relative">
                    <Icon size={22} weight={isActive ? 'fill' : 'regular'} />
                    {badge > 0 && (
                      <span className="absolute -top-1.5 -right-2.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 font-mono text-[10px] font-medium text-on-accent tabular-nums">
                        {badge}
                      </span>
                    )}
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          </li>
        ))}
        <li className="flex-1">
          {user ? (
            <button
              type="button"
              onClick={() => setSheet(true)}
              aria-haspopup="dialog"
              className={`relative flex h-full w-full flex-col items-center justify-center gap-1 text-[11px] transition-colors ${inAccountArea ? 'text-accent-ink' : 'text-ink-3 active:text-ink'}`}
            >
              {inAccountArea && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-accent-ink" aria-hidden="true" />}
              <UserCircle size={22} weight={inAccountArea ? 'fill' : 'regular'} />
              Account
            </button>
          ) : (
            <NavLink
              to="/login"
              className={({ isActive }) =>
                `relative flex h-full flex-col items-center justify-center gap-1 text-[11px] transition-colors ${isActive ? 'text-accent-ink' : 'text-ink-3 active:text-ink'}`
              }
            >
              <UserCircle size={22} />
              Sign in
            </NavLink>
          )}
        </li>
      </ul>
      {sheet && user && <AccountSheet onClose={() => setSheet(false)} />}
    </nav>
  );
}
