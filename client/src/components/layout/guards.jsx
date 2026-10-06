import { Navigate, Outlet, useLocation, useSearchParams } from 'react-router';
import { useAuth } from '../../providers/AuthProvider.jsx';
import { ButtonLink } from '../ui/Button.jsx';
import { ErrorState } from '../ui/feedback.jsx';
import { useTitle } from './Page.jsx';

export function PageSpinner() {
  return (
    <div className="grid min-h-[50vh] place-items-center" role="status" aria-label="Loading">
      <span className="size-6 animate-spin rounded-full border-2 border-edge border-t-accent-ink" />
    </div>
  );
}

function Forbidden() {
  useTitle('No access');
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-24 text-center">
      <h1 className="wide text-2xl font-bold">You don&apos;t have access to this page</h1>
      <p className="text-sm text-ink-2">It belongs to a different kind of account.</p>
      <ButtonLink to="/" variant="secondary" className="mt-2">
        Back to the shop
      </ButtonLink>
    </div>
  );
}

// `allow` receives the auth context ({ user, isSeller, isAdmin, can, ... }) and returns whether this route is permitted.
export function RequireAuth({ allow }) {
  const auth = useAuth();
  const location = useLocation();
  if (auth.status === 'loading') return <PageSpinner />;
  if (auth.status === 'error') return <ErrorState title="Can't reach the server" onRetry={auth.retry} />;
  if (!auth.user) {
    // Someone who just signed out lands on the home page, not on a login screen for the page they left.
    if (auth.signedOut) return <Navigate to="/" replace />;
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }
  if (allow && !allow(auth)) return <Forbidden />;
  return <Outlet />;
}

export function GuestOnly() {
  const { status, user } = useAuth();
  const [params] = useSearchParams();
  if (status === 'loading') return <PageSpinner />;
  if (user) return <Navigate to={safeNext(params.get('next'))} replace />;
  return <Outlet />;
}

// Only same-site paths, so ?next= can't send someone to another website.
export const safeNext = (next) => (next?.startsWith('/') && !next.startsWith('//') ? next : '/');

export const canShop = ({ isAdmin }) => !isAdmin;
export const sellerOnly = ({ isSeller }) => isSeller;
export const adminOnly = ({ isAdmin }) => isAdmin;
export const adminArea = (area) => (auth) => auth.can(area);
