import { useTitle } from '../../components/layout/Page.jsx';
import { PanelHeader } from '../../components/layout/PanelLayout.jsx';
import { ButtonLink } from '../../components/ui/Button.jsx';
import { EmptyState, ErrorState } from '../../components/ui/feedback.jsx';
import { ProductGrid } from '../catalog/ProductTile.jsx';
import { useWishlist } from './useWishlist.js';

export default function WishlistPage() {
  useTitle('Wishlist');
  const wishlist = useWishlist();

  return (
    <section className="flex flex-col">
      <PanelHeader
        title="Wishlist"
        description="Products you saved for later. Unlisted products come back here if the shop relists them."
      />
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
