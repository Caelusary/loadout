import { Heart } from '@phosphor-icons/react';
import { useLocation, useNavigate } from 'react-router';
import { useAuth } from '../../providers/AuthProvider.jsx';
import { useWishlist } from './useWishlist.js';

// Heart toggle. Guests are sent to sign in and brought back; admins don't see it.
export function WishlistButton({ product, className = '', withLabel = false }) {
  const { user, isAdmin } = useAuth();
  const wishlist = useWishlist();
  const navigate = useNavigate();
  const location = useLocation();
  if (isAdmin) return null;

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
        if (!user) return navigate(`/login?next=${encodeURIComponent(location.pathname + location.search)}`);
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
