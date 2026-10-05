import { X } from '@phosphor-icons/react';
import { useLocation } from 'react-router';
import { ButtonLink } from '../../components/ui/Button.jsx';
import { ProductImage } from '../../components/ui/ProductImage.jsx';
import { MAX_COMPARE } from '../../lib/constants.js';
import { useCompare } from '../../providers/CompareProvider.jsx';

// Floating bar that follows the shopper around while they pick products to compare.
export function CompareTray() {
  const compare = useCompare();
  const { pathname } = useLocation();
  const hidden = ['/compare', '/cart', '/checkout'].includes(pathname) || /^\/(admin|seller)/.test(pathname);
  if (!compare.items.length || hidden) return null;
  // Product pages and the loadout builder have their own sticky bar on smaller screens; the tray would stack on it.
  const onProduct = pathname.startsWith('/p/') || pathname === '/loadout';

  const ids = compare.items.map((p) => p._id).join(',');
  return (
    <>
    {/* Keeps the end of the page clear of the floating tray. */}
    <div className={`h-24 ${onProduct ? 'max-lg:hidden' : ''}`} aria-hidden="true" />
    <div
      role="region"
      aria-label="Products to compare"
      className={`${onProduct ? 'max-lg:hidden' : ''} fixed inset-x-3 bottom-[calc(var(--dock)+0.75rem)] z-30 sm:bottom-[max(1rem,env(safe-area-inset-bottom))] mx-auto flex max-w-xl items-center gap-3 rounded-panel border border-seam bg-plate/95 p-2 pl-4 shadow-[0_18px_40px_-20px_rgb(0_0_0/0.7)] sm:p-2.5 sm:pl-3 backdrop-blur-md transition-[opacity,translate] duration-200 ease-out starting:translate-y-3 starting:opacity-0 sm:right-auto sm:left-1/2 sm:w-[min(36rem,calc(100%-2rem))] sm:-translate-x-1/2`}
    >
      {/* Phones get a slim one-line bar; thumbnails show from the sm breakpoint up. */}
      <p className="flex-1 text-[13px] text-ink-2 sm:hidden">
        <span className="font-mono text-ink">{compare.items.length}</span> of {MAX_COMPARE} picked to compare
      </p>
      <ul className="flex min-w-0 flex-1 gap-2 max-sm:hidden">
        {compare.items.map((p) => (
          <li key={p._id} className="group relative">
            <ProductImage src={p.image} alt="" className="size-11 rounded-control" size={120} />
            <button
              type="button"
              onClick={() => compare.remove(p._id)}
              aria-label={`Remove ${p.name}`}
              className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full border border-seam bg-plate text-ink-2 hover:text-ink"
            >
              <X size={10} weight="bold" />
            </button>
          </li>
        ))}
        {Array.from({ length: MAX_COMPARE - compare.items.length }, (_, i) => (
          <li key={i} className="size-11 rounded-control border border-dashed border-seam max-sm:hidden" aria-hidden="true" />
        ))}
      </ul>
      <button type="button" onClick={compare.clear} className="text-[13px] text-ink-3 hover:text-ink">
        Clear
      </button>
      {compare.items.length < 2 ? (
        <span className="px-2 text-[13px] text-ink-3">Pick one more</span>
      ) : (
        <ButtonLink to={`/compare?ids=${ids}`} size="sm">
          Compare {compare.items.length}
        </ButtonLink>
      )}
    </div>
    </>
  );
}
