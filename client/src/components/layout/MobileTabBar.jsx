import { Briefcase, IdentificationCard, Package, SquaresFour, Storefront, Truck } from '@phosphor-icons/react';
import { useAdminLinks } from './adminLinks.js';
import { NavLink } from 'react-router';
import { useAuth } from '../../providers/AuthProvider.jsx';

// Phones get app-style navigation within thumb reach: each role's everyday jobs, two to four of them. Every place
// lives in exactly one spot: the logo is home and the cart and notifications sit in the top bar, so neither is a tab,
// and what's here is left out of the top bar's menu (MobileMenu), which holds the rest.
// Its height is the --dock token (index.css), which every bottom-fixed element sits above.
export function MobileTabBar() {
  const { user, isRider, isAdmin, isSeller } = useAuth();
  const adminLinks = useAdminLinks();

  const tabs = isRider
    ? [
        { to: '/deliveries', label: 'Deliveries', icon: Truck },
        { to: '/account/rider', label: 'Profile', icon: IdentificationCard },
      ]
    : isAdmin
      ? adminLinks.filter((l) => l.tab).map((l) => ({ ...l, badge: l.count }))
      : [
          { to: '/shop', label: 'Shop', icon: Storefront },
          { to: '/loadout', label: 'Build', icon: SquaresFour },
          // A seller shops too, so their Seller Center is added rather than swapped in: four tabs at most.
          ...(isSeller ? [{ to: '/seller', label: 'Seller Center', icon: Briefcase }] : []),
          ...(user ? [{ to: '/account/orders', label: 'My orders', icon: Package }] : []),
        ];

  return (
    <nav
      aria-label="Main"
      data-bottom-bar
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
                  {isActive && (
                    <span
                      className="absolute top-0 h-0.5 w-8 rounded-full bg-accent-ink"
                      aria-hidden="true"
                    />
                  )}
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
      </ul>
    </nav>
  );
}
