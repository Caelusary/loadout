import { Link } from 'react-router';
import { CATEGORIES, CATEGORY_LABELS } from '../../lib/constants.js';
import { useAuth } from '../../providers/AuthProvider.jsx';
import { accountSections } from './accountLinks.js';

const link = 'w-fit text-ink-2 hover:text-ink';

// The Account column matches the account menu: a rider or admin never sees cart or order links they can't use.
// Guests get the shopper links, which lead through sign-in.
function accountLinks(auth) {
  if (!auth.user) {
    return [
      ['/account/orders', 'My orders'],
      ['/account/sell', 'Sell on Loadout'],
      ['/cart', 'Cart'],
    ];
  }
  const { workspace, you } = accountSections(auth);
  // A customer's own orders come before the invitation to start selling.
  const links = auth.user.role === 'customer' ? [...you, ...workspace] : [...workspace, ...you];
  return [...links, ['/account', 'Account settings']];
}

export function Footer() {
  const auth = useAuth();
  return (
    <footer className="mt-24 border-t border-seam">
      {/* Phones: the brand line on top, then Shop and Account side by side, so the footer is half as tall. Riders and
          admins can't buy, so their footer leaves out the Shop column. */}
      <div
        className={`mx-auto grid w-full max-w-[1280px] grid-cols-2 gap-x-6 gap-y-8 px-4 py-10 sm:gap-10 sm:px-6 sm:py-12 ${auth.canShop ? 'sm:grid-cols-[1.4fr_1fr_1fr]' : 'sm:grid-cols-[2.4fr_1fr]'}`}
      >
        <div className="col-span-2 flex max-w-xs flex-col gap-2 sm:col-span-1">
          <p className="widest text-base font-extrabold">Loadout</p>
          <p className="text-sm text-ink-3">
            Desk gear from independent shops. Group 3, C3A final project. Payments are simulated.
          </p>
        </div>
        {auth.canShop && (
          <nav aria-label="Categories" className="flex flex-col gap-2 text-sm">
            <p className="text-[13px] font-medium text-ink-3">Shop</p>
            {CATEGORIES.map((c) => (
              <Link key={c} to={`/shop?category=${c}`} className={link}>
                {CATEGORY_LABELS[c]}
              </Link>
            ))}
          </nav>
        )}
        <nav aria-label="Account" className="flex flex-col gap-2 text-sm">
          <p className="text-[13px] font-medium text-ink-3">Account</p>
          {accountLinks(auth).map(([to, label]) => (
            <Link key={to} to={to} className={link}>
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
