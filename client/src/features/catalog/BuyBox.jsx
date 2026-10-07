import { Check } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { Button } from '../../components/ui/Button.jsx';
import { Price } from '../../components/ui/chips.jsx';
import { QtyStepper } from '../../components/ui/controls.jsx';
import { MAX_QTY } from '../../lib/constants.js';
import { useAuth } from '../../providers/AuthProvider.jsx';
import { useCart } from '../../providers/CartProvider.jsx';
import { CompareButton } from '../compare/CompareButton.jsx';
import { WishlistButton } from '../wishlist/WishlistButton.jsx';
import { useToast } from '../../providers/ToastProvider.jsx';

// Price, stock, quantity and the add-to-cart / buy-now actions beside the gallery.
export function BuyBox({ product }) {
  const { user, isAdmin, isRider } = useAuth();
  const cart = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  // Guests are sent to sign in with ?add=<qty>; once they're back, signed in and their saved cart has
  // loaded, finish adding the item (no more than they can still add).
  const pendingAdd = Number(params.get('add'));
  const addedPending = useRef(false);
  useEffect(() => {
    if (addedPending.current || !user || !cart.enabled || !cart.ready || !pendingAdd) return;
    addedPending.current = true;
    const already = cart.items.find((i) => i.productId === product._id)?.qty ?? 0;
    const room = Math.min(pendingAdd, product.stock, MAX_QTY - already);
    if (product.isActive && room > 0) {
      cart.add(product._id, room).then((ok) => ok && toast.show(`${product.name} added to your cart`));
    }
    setParams(
      (p) => {
        p.delete('add');
        return p;
      },
      { replace: true },
    );
  }, [user, cart, pendingAdd, product, toast, setParams]);
  const inCart = cart.items.find((i) => i.productId === product._id)?.qty ?? 0;
  // Buy now skips the cart, so only stock limits it; Add to cart also counts what's already in the cart.
  const buyMax = Math.min(product.stock, MAX_QTY);
  const maxQty = buyMax - inCart;
  const cartFull = maxQty <= 0;
  const ownProduct = user && product.seller?._id === user._id;

  useEffect(() => {
    if (!added) return;
    const t = setTimeout(() => setAdded(false), 1200);
    return () => clearTimeout(t);
  }, [added]);

  let blocked = '';
  if (!product.isActive) blocked = 'This product is no longer listed.';
  else if (product.stock === 0) blocked = 'Sold out. Check back later.';
  else if (isAdmin) blocked = "Admin accounts can't buy products.";
  else if (isRider) blocked = "Rider accounts can't buy products.";
  else if (ownProduct) blocked = 'This is your product.';

  const buyRow = useRef(null);
  const [buyRowVisible, setBuyRowVisible] = useState(true);
  useEffect(() => {
    const el = buyRow.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setBuyRowVisible(entry.isIntersecting));
    observer.observe(el);
    return () => observer.disconnect();
  }, [blocked]);

  const addToCart = () => {
    if (!user) {
      const back = `${location.pathname}?add=${Math.min(qty, maxQty)}`;
      navigate(`/login?next=${encodeURIComponent(back)}`);
      return;
    }
    setQty(1);
    cart.add(product._id, Math.min(qty, maxQty)).then((ok) => {
      if (!ok) return;
      setAdded(true);
      toast.show(`${product.name} added to your cart`);
    });
  };

  const buyNow = () => {
    const target = `/checkout?buy=${product._id}&qty=${Math.min(qty, buyMax)}`;
    navigate(user ? target : `/login?next=${encodeURIComponent(target)}`);
  };

  const stockNote =
    product.stock === 0 ? 'Sold out' : product.stock <= 5 ? `Only ${product.stock} left` : 'In stock';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline gap-4">
        <Price cents={product.priceCents} was={product.compareAtCents} className="text-[28px] font-medium text-ink" />
        <span
          className={`text-sm ${product.stock === 0 ? 'text-bad' : product.stock <= 5 ? 'text-warn' : 'text-ok'}`}
        >
          {stockNote}
        </span>
      </div>
      {blocked ? (
        <p className="rounded-control border border-seam px-4 py-3 text-sm text-ink-2">{blocked}</p>
      ) : (
        <div ref={buyRow} className="flex flex-wrap gap-3">
          <QtyStepper value={Math.min(qty, buyMax)} onChange={setQty} max={buyMax} />
          <Button size="lg" className="min-w-36 flex-1 sm:flex-none" onClick={buyNow}>
            Buy now
          </Button>
          <Button size="lg" variant="secondary" className="min-w-36 flex-1 sm:flex-none" onClick={addToCart} disabled={cartFull}>
            {added ? (
              <>
                <Check size={18} weight="bold" /> Added
              </>
            ) : (
              'Add to cart'
            )}
          </Button>
        </div>
      )}
      {!blocked && cartFull && (
        <p className="text-[13px] text-ink-3">You already have the most you can buy ({inCart}) in your cart. Buy now still works.</p>
      )}
      {!blocked && !user && <p className="text-[13px] text-ink-3">You&apos;ll be asked to sign in first.</p>}
      {product.isActive && (
        <div className="flex flex-wrap gap-5 text-sm">
          <WishlistButton product={product} withLabel className="h-9" />
          <CompareButton product={product} withLabel className="h-9" />
        </div>
      )}
      {!blocked && !buyRowVisible && (
        <div className="fixed inset-x-0 bottom-[var(--dock)] z-30 flex items-center justify-between gap-4 border-t border-seam bg-plate/95 px-4 pt-3 pb-3 backdrop-blur-md sm:pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-[13px] text-ink-2">{product.name}</span>
            <Price cents={product.priceCents} was={product.compareAtCents} tag={false} className="font-medium text-ink" />
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="secondary" onClick={addToCart} disabled={cartFull}>
              {added ? 'Added' : 'Add to cart'}
            </Button>
            <Button onClick={buyNow}>Buy now</Button>
          </div>
        </div>
      )}
    </div>
  );
}
