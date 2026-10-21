import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useAuth } from '../../providers/AuthProvider.jsx';
import { productQuery, productsQuery, shopParams, shopQuery } from '../../features/catalog/queries.js';
import { orderQuery } from '../../features/orders/queries.js';

// The code-split pages, by the start of their path: loading one on intent means the click doesn't also wait for its
// code. (Same modules as the lazy() routes in App.jsx, so the browser fetches each chunk once.)
const CHUNKS = [
  ['/admin/orders', () => import('../../features/admin/AdminOrders.jsx')],
  ['/admin/returns', () => import('../../features/admin/AdminReturns.jsx')],
  ['/admin/products', () => import('../../features/admin/AdminProducts.jsx')],
  ['/admin/coupons', () => import('../../features/admin/AdminCoupons.jsx')],
  ['/admin/users', () => import('../../features/admin/AdminUsers.jsx')],
  ['/admin/approvals', () => import('../../features/admin/AdminApprovals.jsx')],
  ['/admin/complaints', () => import('../../features/admin/AdminComplaints.jsx')],
  ['/admin/activity', () => import('../../features/admin/AdminActivity.jsx')],
  ['/admin/riders/', () => import('../../features/admin/AdminRiderDetail.jsx')],
  ['/admin', () => import('../../features/admin/AdminDashboard.jsx')],
  ['/seller/products/', () => import('../../features/seller/ProductFormPage.jsx')],
  ['/seller/products', () => import('../../features/seller/SellerProducts.jsx')],
  ['/seller/orders', () => import('../../features/seller/SellerOrders.jsx')],
  ['/seller/returns', () => import('../../features/seller/SellerReturns.jsx')],
  ['/seller/reviews', () => import('../../features/seller/SellerReviews.jsx')],
  ['/seller', () => import('../../features/seller/SellerDashboard.jsx')],
  ['/orders/', () => import('../../features/orders/OrderDetailPage.jsx')],
  ['/account/orders', () => import('../../features/account/MyOrdersPage.jsx')],
  ['/account/wishlist', () => import('../../features/wishlist/WishlistPage.jsx')],
  ['/account/sell', () => import('../../features/account/SellApplicationPage.jsx')],
  ['/account/rider', () => import('../../features/rider/RiderProfilePage.jsx')],
  ['/account', () => import('../../features/account/ProfilePage.jsx')],
  ['/deliveries', () => import('../../features/rider/DeliveriesPage.jsx')],
  ['/checkout', () => import('../../features/cart/CheckoutPage.jsx')],
  ['/compare', () => import('../../features/compare/ComparePage.jsx')],
  ['/loadout', () => import('../../features/loadout/LoadoutPage.jsx')],
  ['/login', () => import('../../features/auth/LoginPage.jsx')],
  ['/register', () => import('../../features/auth/RegisterPage.jsx')],
];

// How long a pointer rests on a link before it counts as intent (a pointer passing over a list shouldn't fetch every
// row). A touch or keyboard focus counts at once: on a phone the touch comes ~100ms before the click.
const DWELL = 80;

// Starts loading a page (its code and its data) when someone is about to open it: the pointer rests on its link, a
// finger touches it, or the keyboard focuses it. Nothing changes on screen; the page is just usually ready by the time
// the click lands. Skipped under data saver.
export function LinkPrefetch() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  useEffect(() => {
    if (navigator.connection?.saveData) return;
    const done = new Set(); // hrefs already warmed this visit; the query cache decides when data is stale again

    const warm = (a) => {
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || done.has(url.href)) return;
      done.add(url.href);
      setTimeout(() => done.delete(url.href), 30_000);
      const path = url.pathname;
      const fetchData = (options) => queryClient.prefetchQuery(options).catch(() => {});

      const chunk = CHUNKS.find(([start]) => path.startsWith(start));
      chunk?.[1]().catch(() => {});

      let m;
      if ((m = path.match(/^\/p\/([^/]+)$/))) fetchData(productQuery(decodeURIComponent(m[1])));
      else if ((m = path.match(/^\/s\/([^/]+)$/))) fetchData(shopQuery(decodeURIComponent(m[1])));
      else if (path === '/shop') fetchData(productsQuery(shopParams(url.searchParams)));
      else if ((m = path.match(/^\/orders\/([a-f0-9]{24})$/)) && user) fetchData(orderQuery(m[1]));
    };

    let timer = 0;
    const linkOf = (e) => e.target.closest?.('a[href]');
    const onOver = (e) => {
      const a = linkOf(e);
      if (!a || e.pointerType === 'touch') return;
      clearTimeout(timer);
      timer = setTimeout(() => warm(a), DWELL);
    };
    const onOut = (e) => {
      if (linkOf(e) && !linkOf(e).contains(e.relatedTarget)) clearTimeout(timer);
    };
    const onNow = (e) => {
      const a = linkOf(e);
      if (a) warm(a);
    };

    document.addEventListener('pointerover', onOver, { passive: true });
    document.addEventListener('pointerout', onOut, { passive: true });
    document.addEventListener('touchstart', onNow, { passive: true });
    document.addEventListener('focusin', onNow);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerover', onOver);
      document.removeEventListener('pointerout', onOut);
      document.removeEventListener('touchstart', onNow);
      document.removeEventListener('focusin', onNow);
    };
  }, [queryClient, user]);

  return null;
}
