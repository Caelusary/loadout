import { Heart } from '@phosphor-icons/react';
import { useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '../../providers/AuthProvider.jsx';
import { useWishlist } from './useWishlist.js';

// A guest's Save, waiting for them to sign in. Module-level so that when the same product shows twice on a page,
// only one of its hearts finishes the save.
const done = new Set();

// Heart toggle. Guests are sent to sign in and brought back with ?save=<id>, and the save then goes through, the
// same way Add to cart resumes with ?add=. Admins and riders don't see it.
export function WishlistButton({ product, className = '', withLabel = false }) {
  const { user, canShop } = useAuth();
  const wishlist = useWishlist();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const pending = params.get('save') === product._id;
  const ready = Boolean(user) && wishlist.enabled && !wishlist.isPending;
  useEffect(() => {
    if (!pending || !ready || done.has(product._id)) return;
    done.add(product._id);
    if (!wishlist.has(product._id)) wishlist.toggle(product._id);
    setParams(
      (p) => {
        p.delete('save');
        return p;
      },
      { replace: true },
    );
  }, [pending, ready, product._id, wishlist, setParams]);
  if (!canShop) return null;

  const saved = wishlist.has(product._id);
  const label = saved ? `Remove ${product.name} from your wishlist` : `Save ${product.name} to your wishlist`;

  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={withLabel ? undefined : label}
      title={saved ? 'Saved' : 'Save for later'}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!user) {
          const back = new URLSearchParams(location.search);
          back.set('save', product._id);
          done.delete(product._id);
          return navigate(`/login?next=${encodeURIComponent(`${location.pathname}?${back}`)}`);
        }
        wishlist.toggle(product._id);
      }}
      className={`inline-flex items-center justify-center gap-2 transition-[color,transform] duration-150 ease-out active:scale-90 ${
        saved ? 'text-neon' : 'text-ink-2 hover:text-ink'
      } ${className}`}
    >
      <Heart size={withLabel ? 18 : 17} weight={saved ? 'fill' : 'regular'} />
      {withLabel && (saved ? 'Saved' : 'Save')}
    </button>
  );
}
