import { ArrowClockwise } from '@phosphor-icons/react';
import { Button } from './Button.jsx';

export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-control bg-raised ${className}`} aria-hidden="true" />;
}

export function EmptyState({ title, children, action }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <h3 className="wide text-lg font-bold text-ink">{title}</h3>
      {children && <p className="max-w-sm text-sm text-ink-2">{children}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, title = "This didn't load" }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <h3 className="wide text-lg font-bold text-ink">{title}</h3>
      <p className="max-w-sm text-sm text-ink-2">{error?.message ?? 'Something went wrong.'}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <ArrowClockwise size={16} /> Try again
        </Button>
      )}
    </div>
  );
}

export function FormError({ message }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-control border border-bad/40 bg-bad/10 px-3 py-2.5 text-sm text-ink">
      {message}
    </p>
  );
}
