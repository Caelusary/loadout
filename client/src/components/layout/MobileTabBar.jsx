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
set +H
git clean -f client/src/components/ui/
mkdir -p client/src/components/ui
cat > client/src/components/ui/ArcArrowLink.jsx <<'LOADOUT_EOF'
import { ArrowRight } from '@phosphor-icons/react';
import { Link } from 'react-router';

const R = 17;
const C = 2 * Math.PI * R;
const GAP = C * 0.24; // open on the side the arrow points to

// A round "go" link: an open ring around an arrow. The ring is open where the arrow points and
// closes on hover or focus, with the arrow nudging through.
export function ArcArrowLink({ to, label, className = '' }) {
  return (
    <Link
      to={to}
      aria-label={label}
      title={label}
      className={`group/arc relative grid size-10 shrink-0 place-items-center rounded-full text-ink-2 hover:text-accent-ink focus-visible:text-accent-ink ${className}`}
    >
      <svg viewBox="0 0 40 40" className="absolute inset-0 size-full" aria-hidden="true">
        <circle
          cx="20"
          cy="20"
          r={R}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          // Dash offset of arc + gap/2 centres the gap on the right, where the stroke starts.
          style={{ '--arc': C - GAP, '--gap': GAP, '--off': C - GAP / 2, '--c': C }}
          className="opacity-60 transition-[stroke-dasharray,stroke-dashoffset,opacity] duration-300 ease-out [stroke-dasharray:var(--arc)_var(--gap)] [stroke-dashoffset:var(--off)] group-hover/arc:opacity-100 group-hover/arc:[stroke-dasharray:var(--c)_0] group-hover/arc:[stroke-dashoffset:var(--c)] group-focus-visible/arc:opacity-100 group-focus-visible/arc:[stroke-dasharray:var(--c)_0] group-focus-visible/arc:[stroke-dashoffset:var(--c)]"
        />
      </svg>
      <ArrowRight size={16} weight="bold" className="transition-transform duration-200 ease-out group-hover/arc:translate-x-0.5" />
    </Link>
  );
}
