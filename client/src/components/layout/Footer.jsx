import { Link } from 'react-router';
import { CATEGORIES, CATEGORY_LABELS } from '../../lib/constants.js';

export function Footer() {
  return (
    <footer className="mt-24 border-t border-seam">
      <div className="mx-auto grid w-full max-w-[1280px] gap-10 px-4 py-12 sm:grid-cols-[1.4fr_1fr_1fr] sm:px-6">
        <div className="flex max-w-xs flex-col gap-2">
          <p className="widest text-base font-extrabold">Loadout</p>
          <p className="text-sm text-ink-3">
            Desk gear from independent shops. Group 3, C3A final project. Payments are simulated.
          </p>
        </div>
        <nav aria-label="Categories" className="flex flex-col gap-2 text-sm">
          <p className="text-[13px] font-medium text-ink-3">Shop</p>
          {CATEGORIES.map((c) => (
            <Link key={c} to={`/shop?category=${c}`} className="w-fit text-ink-2 hover:text-ink">
              {CATEGORY_LABELS[c]}
            </Link>
          ))}
        </nav>
        <nav aria-label="Account" className="flex flex-col gap-2 text-sm">
          <p className="text-[13px] font-medium text-ink-3">Account</p>
          <Link to="/account/orders" className="w-fit text-ink-2 hover:text-ink">
            My orders
          </Link>
          <Link to="/account/sell" className="w-fit text-ink-2 hover:text-ink">
            Sell on Loadout
          </Link>
          <Link to="/cart" className="w-fit text-ink-2 hover:text-ink">
            Cart
          </Link>
        </nav>
      </div>
    </footer>
  );
}
