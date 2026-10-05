import { ButtonLink } from '../ui/Button.jsx';
import { useTitle } from './Page.jsx';

export function NotFound() {
  useTitle('Page not found');
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-24 text-center">
      <h1 className="wide text-2xl font-bold">This page doesn&apos;t exist</h1>
      <p className="text-sm text-ink-2">The link may be old, or the product may have been removed.</p>
      <ButtonLink to="/shop" variant="secondary" className="mt-2">
        Browse the shop
      </ButtonLink>
    </div>
  );
}
