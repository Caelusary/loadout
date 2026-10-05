import { useTitle } from '../../components/layout/Page.jsx';
import { ButtonLink } from '../../components/ui/Button.jsx';
import { EmptyState, ErrorState } from '../../components/ui/feedback.jsx';
import { ProductGrid } from '../catalog/ProductTile.jsx';
import { useWishlist } from './useWishlist.js';

export default function WishlistPage() {
  useTitle('Wishlist');
  const wishlist = useWishlist();

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="wide text-xl font-bold">Wishlist</h2>
        <p className="text-sm text-ink-2">Products you saved for later. Unlisted products come back here if the shop relists them.</p>
      </div>
      {wishlist.isError ? (
        <ErrorState error={wishlist.error} onRetry={wishlist.refetch} />
      ) : !wishlist.isPending && wishlist.items.length === 0 ? (
        <EmptyState title="Nothing saved yet" action={<ButtonLink to="/shop">Browse products</ButtonLink>}>
          Tap the heart on any product to keep it here.
        </EmptyState>
      ) : (
        <ProductGrid products={wishlist.items} loading={wishlist.isPending} />
      )}
    </section>
  );
}
