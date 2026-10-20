import { useTitle } from '../../components/layout/Page.jsx';
import { PanelHeader } from '../../components/layout/PanelLayout.jsx';
import { Button, ButtonLink } from '../../components/ui/Button.jsx';
import { EmptyState, ErrorState } from '../../components/ui/feedback.jsx';
import { ProductGrid } from '../catalog/ProductTile.jsx';
import { useAuth } from '../../providers/AuthProvider.jsx';
import { useCart } from '../../providers/CartProvider.jsx';
import { useToast } from '../../providers/ToastProvider.jsx';
import { useWishlist } from './useWishlist.js';

// Saved for later usually means "buy this soon": each saved product can go straight into the cart from here.
// Sold-out ones already say so on the card, so they get no button.
function QuickAdd({ product }) {
  const { user } = useAuth();
  const cart = useCart();
  const toast = useToast();
  if (product.stock === 0 || product.seller?._id === user?._id) return null;
  if (cart.items.some((i) => i.productId === product._id))
    return (
      <ButtonLink to="/cart" variant="secondary" size="sm" className="w-full">
        In your cart
      </ButtonLink>
    );
  return (
    <Button
      variant="secondary"
      size="sm"
      className="w-full"
      onClick={() =>
        cart.add(product._id, 1).then((ok) => ok && toast.show(`${product.name} added to your cart`))
      }
    >
      Add to cart
    </Button>
  );
}

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
        <ProductGrid
          products={wishlist.items}
          loading={wishlist.isPending}
          footer={(p) => <QuickAdd product={p} />}
        />
      )}
    </section>
  );
}
