import { lazy, Suspense, useEffect } from 'react';
import { Outlet, Route, Routes, useLocation } from 'react-router';
import { Footer } from './components/layout/Footer.jsx';
import { adminArea, adminOnly, canShop, GuestOnly, RequireAuth, riderOnly, sellerOnly } from './components/layout/guards.jsx';
import { PageErrorBoundary } from './components/layout/PageErrorBoundary.jsx';
import { PageSkeleton } from './components/layout/PageSkeleton.jsx';
import { Navbar } from './components/layout/Navbar.jsx';
import { PanelLayout } from './components/layout/PanelLayout.jsx';
import { BackToTop, ScrollProgress } from './components/layout/ScrollExtras.jsx';
import { NeonBackdrop } from './components/layout/NeonBackdrop.jsx';
import { NeonCursor } from './components/layout/NeonCursor.jsx';
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
const AdminDashboard = lazy(() => import('./features/admin/AdminDashboard.jsx'));
const AdminSellers = lazy(() => import('./features/admin/AdminSellers.jsx'));
const AdminProducts = lazy(() => import('./features/admin/AdminProducts.jsx'));
const AdminOrders = lazy(() => import('./features/admin/AdminOrders.jsx'));
const AdminUsers = lazy(() => import('./features/admin/AdminUsers.jsx'));
const AdminActivity = lazy(() => import('./features/admin/AdminActivity.jsx'));
const AdminReturns = lazy(() => import('./features/admin/AdminReturns.jsx'));
const SellerReturns = lazy(() => import('./features/seller/SellerReturns.jsx'));
const ForgotPasswordPage = lazy(() => import('./features/auth/ForgotPasswordPage.jsx'));
const ResetPasswordPage = lazy(() => import('./features/auth/ResetPasswordPage.jsx'));
const ShotPage = import.meta.env.DEV ? lazy(() => import('./features/home/ShotPage.jsx')) : null;

function Layout() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return (
    <div className="flex min-h-dvh flex-col pb-[var(--dock)]">
      <span id="top-sentinel" className="absolute top-[120vh] h-px w-px" aria-hidden="true" />
      <NeonBackdrop />
      <ScrollProgress />
      <NeonCursor />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-control focus:bg-accent focus:px-3 focus:py-2 focus:text-on-accent"
      >
        Skip to content
      </a>
      <Navbar />
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

function AccountLayout() {
  const { user, canShop } = useAuth();
  const links = [
    { to: '/account', label: 'Profile', end: true },
    ...(canShop ? [{ to: '/account/orders', label: 'My orders' }, { to: '/account/wishlist', label: 'Wishlist' }] : []),
    ...(user?.role === 'customer' || user?.sellerProfile ? [{ to: '/account/sell', label: 'Selling' }] : []),
  ];
  return <PanelLayout title="Account" links={links} />;
}

const SELLER_LINKS = [
  { to: '/seller', label: 'Dashboard', end: true },
  { to: '/seller/products', label: 'Products' },
  { to: '/seller/orders', label: 'Orders' },
  { to: '/seller/returns', label: 'Returns' },
];
// `area` links show only to admins the owner has given that area (see ADMIN_AREAS on the server).
const ADMIN_LINKS = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/sellers', label: 'Sellers', area: 'sellers' },
  { to: '/admin/products', label: 'Products', area: 'products' },
  { to: '/admin/orders', label: 'Orders', area: 'orders' },
  { to: '/admin/returns', label: 'Returns', area: 'orders' },
  { to: '/admin/coupons', label: 'Discount codes', area: 'coupons' },
  { to: '/admin/users', label: 'Users', area: 'users' },
  { to: '/admin/activity', label: 'Activity' },
];

function AdminPanel() {
  const { can } = useAuth();
  return <PanelLayout title="Admin" links={ADMIN_LINKS.filter((l) => !l.area || can(l.area))} />;
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
          </Route>
        </Route>

        <Route element={<RequireAuth allow={sellerOnly} />}>
          <Route path="seller" element={<PanelLayout title="Seller Center" links={SELLER_LINKS} />}>
            <Route index element={<SellerDashboard />} />
            <Route path="products" element={<SellerProducts />} />
            <Route path="products/new" element={<ProductFormPage />} />
            <Route path="products/:id/edit" element={<ProductFormPage />} />
            <Route path="orders" element={<SellerOrders />} />
            <Route path="returns" element={<SellerReturns />} />
          </Route>
        </Route>

        <Route element={<RequireAuth allow={riderOnly} />}>
          <Route path="deliveries" element={<DeliveriesPage />} />
        </Route>

        <Route element={<RequireAuth allow={adminOnly} />}>
          <Route path="admin" element={<AdminPanel />}>
            <Route index element={<AdminDashboard />} />
            {[
              ['sellers', <AdminSellers key="sellers" />],
              ['products', <AdminProducts key="products" />],
              ['orders', <AdminOrders key="orders" />],
              ['returns', <AdminReturns key="returns" />, 'orders'],
              ['coupons', <AdminCoupons key="coupons" />],
              ['users', <AdminUsers key="users" />],
            ].map(([path, page, area = path]) => (
              <Route key={path} element={<RequireAuth allow={adminArea(area)} />}>
                <Route path={path} element={page} />
              </Route>
            ))}
            <Route path="activity" element={<AdminActivity />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
