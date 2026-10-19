import { useQuery } from '@tanstack/react-query';
import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router';
import { Footer } from './components/layout/Footer.jsx';
import { api } from './lib/api.js';
import {
  adminArea,
  adminOnly,
  canShop,
  GuestOnly,
  RequireAuth,
  riderOnly,
  sellerOnly,
} from './components/layout/guards.jsx';
import { PageErrorBoundary } from './components/layout/PageErrorBoundary.jsx';
import { PageSkeleton } from './components/layout/PageSkeleton.jsx';
import { Navbar } from './components/layout/Navbar.jsx';
import { PanelLayout } from './components/layout/PanelLayout.jsx';
import { useAdminLinks } from './components/layout/adminLinks.js';
import { BackToTop, ScrollProgress } from './components/layout/ScrollExtras.jsx';
import { NeonBackdrop } from './components/layout/NeonBackdrop.jsx';
import { NeonCursor } from './components/layout/NeonCursor.jsx';
import { PerformanceSuggestion } from './components/layout/PerformanceSuggestion.jsx';
import { DeliveryPrompt } from './features/orders/DeliveryPrompt.jsx';
import { usePerformance } from './providers/PerformanceProvider.jsx';
import { CompareTray } from './features/compare/CompareTray.jsx';
import { MobileTabBar } from './components/layout/MobileTabBar.jsx';
import { NotFound } from './components/layout/NotFound.jsx';
import { useAuth } from './providers/AuthProvider.jsx';
import HomePage from './features/home/HomePage.jsx';
import ShopPage from './features/catalog/ShopPage.jsx';
import ProductPage from './features/catalog/ProductPage.jsx';
import StorefrontPage from './features/catalog/StorefrontPage.jsx';
import CartPage from './features/cart/CartPage.jsx';

// Seller Center and Admin load as separate chunks; most visitors never open them.
const SellerDashboard = lazy(() => import('./features/seller/SellerDashboard.jsx'));
const SellerProducts = lazy(() => import('./features/seller/SellerProducts.jsx'));
const ProductFormPage = lazy(() => import('./features/seller/ProductFormPage.jsx'));
// Form-heavy pages (react-hook-form + zod) load on demand to keep them out of the first download.
const CheckoutPage = lazy(() => import('./features/cart/CheckoutPage.jsx'));
const OrderConfirmedPage = lazy(() => import('./features/cart/OrderConfirmedPage.jsx'));
const LoginPage = lazy(() => import('./features/auth/LoginPage.jsx'));
const RegisterPage = lazy(() => import('./features/auth/RegisterPage.jsx'));
const OrderDetailPage = lazy(() => import('./features/orders/OrderDetailPage.jsx'));
const ProfilePage = lazy(() => import('./features/account/ProfilePage.jsx'));
const MyOrdersPage = lazy(() => import('./features/account/MyOrdersPage.jsx'));
const SellApplicationPage = lazy(() => import('./features/account/SellApplicationPage.jsx'));
const ComparePage = lazy(() => import('./features/compare/ComparePage.jsx'));
const LoadoutPage = lazy(() => import('./features/loadout/LoadoutPage.jsx'));
const WishlistPage = lazy(() => import('./features/wishlist/WishlistPage.jsx'));
const AdminCoupons = lazy(() => import('./features/admin/AdminCoupons.jsx'));
const SellerOrders = lazy(() => import('./features/seller/SellerOrders.jsx'));
const DeliveriesPage = lazy(() => import('./features/rider/DeliveriesPage.jsx'));
const RiderProfilePage = lazy(() => import('./features/rider/RiderProfilePage.jsx'));
const AdminApprovals = lazy(() => import('./features/admin/AdminApprovals.jsx'));
const AdminRiderDetail = lazy(() => import('./features/admin/AdminRiderDetail.jsx'));
const AdminComplaints = lazy(() => import('./features/admin/AdminComplaints.jsx'));
const AdminDashboard = lazy(() => import('./features/admin/AdminDashboard.jsx'));
const AdminProducts = lazy(() => import('./features/admin/AdminProducts.jsx'));
const AdminOrders = lazy(() => import('./features/admin/AdminOrders.jsx'));
const AdminUsers = lazy(() => import('./features/admin/AdminUsers.jsx'));
const AdminActivity = lazy(() => import('./features/admin/AdminActivity.jsx'));
const AdminReturns = lazy(() => import('./features/admin/AdminReturns.jsx'));
const SellerReturns = lazy(() => import('./features/seller/SellerReturns.jsx'));
const SellerReviews = lazy(() => import('./features/seller/SellerReviews.jsx'));
const ForgotPasswordPage = lazy(() => import('./features/auth/ForgotPasswordPage.jsx'));
const ResetPasswordPage = lazy(() => import('./features/auth/ResetPasswordPage.jsx'));
const ShotPage = import.meta.env.DEV ? lazy(() => import('./features/home/ShotPage.jsx')) : null;

// Everything a rider has: their deliveries, the orders on them, and their account and rider profile. The storefront
// is for people who can buy, so any other page sends a rider back to their deliveries.
const RIDER_PATHS = /^\/(deliveries|account(\/rider)?|orders\/[^/]+|reset-password)\/?$/;

function Layout() {
  const { pathname } = useLocation();
  const perf = usePerformance();
  const { isRider } = useAuth();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  if (isRider && !RIDER_PATHS.test(pathname)) return <Navigate to="/deliveries" replace />;
  return (
    <div className="flex min-h-dvh flex-col pb-[var(--dock)]">
      <span id="top-sentinel" className="absolute top-[120vh] h-px w-px" aria-hidden="true" />
      {/* Performance mode drops the animated backdrop; the page keeps its plain background. */}
      {!perf.on && <NeonBackdrop />}
      <ScrollProgress />
      <NeonCursor />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-control focus:bg-accent focus:px-3 focus:py-2 focus:text-on-accent"
      >
        Skip to content
      </a>
      <Navbar />
      <DeliveryPrompt />
      <PerformanceSuggestion />
      <main id="main" className="flex-1">
        <PageErrorBoundary key={pathname}>
          <Suspense fallback={<PageSkeleton />}>
            <Outlet />
          </Suspense>
        </PageErrorBoundary>
      </main>
      <Footer />
      <CompareTray />
      <BackToTop />
      <MobileTabBar />
    </div>
  );
}

// A rider's settings and delivery profile each stand alone (the navbar links the profile), so with one link left
// the panel shows no sidebar.
function AccountLayout() {
  const { user, canShop } = useAuth();
  const links = [
    { to: '/account', label: 'Settings', end: true },
    ...(canShop
      ? [
          { to: '/account/orders', label: 'My orders' },
          { to: '/account/wishlist', label: 'Wishlist' },
        ]
      : []),
    ...(user?.role === 'customer' || user?.sellerProfile
      ? [{ to: '/account/sell', label: 'Sell on Loadout' }]
      : []),
  ];
  return <PanelLayout title="Account" links={links} />;
}

const SELLER_LINKS = [
  { to: '/seller', label: 'Dashboard', end: true },
  { to: '/seller/products', label: 'Products' },
  { to: '/seller/orders', label: 'Orders' },
  { to: '/seller/returns', label: 'Returns' },
  { to: '/seller/reviews', label: 'Reviews' },
];

// The Reviews link shows how many reviews are still waiting on a reply, like the admin menu's counts.
function SellerPanel() {
  const { data } = useQuery({
    queryKey: ['reviews', 'shop', 'reply', 1],
    queryFn: ({ signal }) => api('/seller/reviews?needs=reply', { signal }),
    refetchInterval: 60_000,
  });
  const links = SELLER_LINKS.map((l) =>
    l.to === '/seller/reviews' ? { ...l, count: data?.counts?.needsReply } : l,
  );
  return <PanelLayout title="Seller Center" links={links} />;
}

function AdminPanel() {
  return <PanelLayout title="Admin" links={useAdminLinks()} phoneNav={false} />;
}

export default function App() {
  return (
    <Routes>
      {ShotPage && <Route path="/__shot" element={<ShotPage />} />}
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="shop" element={<ShopPage />} />
        <Route path="p/:slug" element={<ProductPage />} />
        <Route path="s/:slug" element={<StorefrontPage />} />
        <Route path="compare" element={<ComparePage />} />
        <Route path="loadout" element={<LoadoutPage />} />
        <Route path="reset-password" element={<ResetPasswordPage />} />
        <Route element={<GuestOnly />}>
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="forgot-password" element={<ForgotPasswordPage />} />
        </Route>

        <Route element={<RequireAuth allow={canShop} />}>
          <Route path="cart" element={<CartPage />} />
          <Route path="checkout" element={<CheckoutPage />} />
          <Route path="order-confirmed/:checkoutId" element={<OrderConfirmedPage />} />
        </Route>

        <Route element={<RequireAuth />}>
          <Route path="orders/:id" element={<OrderDetailPage />} />
          <Route path="account" element={<AccountLayout />}>
            <Route index element={<ProfilePage />} />
            <Route path="orders" element={<MyOrdersPage />} />
            <Route path="wishlist" element={<WishlistPage />} />
            <Route path="sell" element={<SellApplicationPage />} />
            <Route element={<RequireAuth allow={riderOnly} />}>
              <Route path="rider" element={<RiderProfilePage />} />
            </Route>
          </Route>
        </Route>

        <Route element={<RequireAuth allow={sellerOnly} />}>
          <Route path="seller" element={<SellerPanel />}>
            <Route index element={<SellerDashboard />} />
            <Route path="products" element={<SellerProducts />} />
            <Route path="products/new" element={<ProductFormPage />} />
            <Route path="products/:id/edit" element={<ProductFormPage />} />
            <Route path="orders" element={<SellerOrders />} />
            <Route path="returns" element={<SellerReturns />} />
            <Route path="reviews" element={<SellerReviews />} />
          </Route>
        </Route>

        <Route element={<RequireAuth allow={riderOnly} />}>
          <Route path="deliveries" element={<DeliveriesPage />} />
        </Route>

        <Route element={<RequireAuth allow={adminOnly} />}>
          <Route path="admin" element={<AdminPanel />}>
            <Route index element={<AdminDashboard />} />
            {[
              ['approvals', <AdminApprovals key="approvals" />, ['sellers', 'users']],
              ['products', <AdminProducts key="products" />],
              ['orders', <AdminOrders key="orders" />],
              ['returns', <AdminReturns key="returns" />, 'orders'],
              ['coupons', <AdminCoupons key="coupons" />],
              ['users', <AdminUsers key="users" />],
              ['riders/:id', <AdminRiderDetail key="rider" />, 'users'],
              ['complaints', <AdminComplaints key="complaints" />, ['users', 'orders']],
            ].map(([path, page, area = path]) => (
              <Route key={path} element={<RequireAuth allow={adminArea(...[area].flat())} />}>
                <Route path={path} element={page} />
              </Route>
            ))}
            <Route path="activity" element={<AdminActivity />} />
            {/* The old Sellers and Riders pages are tabs of Approvals now. */}
            <Route path="sellers" element={<Navigate to="/admin/approvals?tab=shops" replace />} />
            <Route path="riders" element={<Navigate to="/admin/approvals?tab=vehicles" replace />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
