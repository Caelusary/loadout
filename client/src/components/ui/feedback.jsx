import { ArrowClockwise } from '@phosphor-icons/react';
import { Button } from './Button.jsx';

export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-control bg-raised ${className}`} aria-hidden="true" />;
}

// A list of cards while it loads, drawn like the cards it will hold: a title with a line of details under it, then
// `lines` of body text. `actions` buttons sit on the right (under it on phones), `media` puts a photo first, `field`
// adds a note box with a button (as on items an admin marks reviewed), and `compact` is a one-line row.
export function CardsSkeleton({
  count = 3,
  lines = 1,
  actions = 0,
  media = false,
  field = false,
  compact = false,
}) {
  return (
    <ul className="flex flex-col gap-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <li
          key={i}
          className={`flex rounded-panel border border-seam ${compact ? 'items-center gap-3 px-4 py-3' : 'flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between'}`}
        >
          {compact ? (
            <>
              <Skeleton className="h-4 w-28" />
              <Skeleton className={`h-4 ${['w-56', 'w-48', 'w-64'][i % 3]} max-w-[50%]`} />
              <Skeleton className="ml-auto h-3 w-20" />
            </>
          ) : (
            <>
              <div className="flex min-w-0 flex-1 gap-4">
                {media && <Skeleton className="size-20 shrink-0 rounded-control sm:size-24" />}
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <Skeleton className={`h-4 ${['w-40', 'w-32', 'w-48'][i % 3]}`} />
                  <Skeleton className={`h-3 ${['w-64', 'w-56', 'w-72'][i % 3]} max-w-full`} />
                  {Array.from({ length: lines }, (_, l) => (
                    <Skeleton
                      key={l}
                      className={`h-4 ${l === lines - 1 ? 'w-2/3' : 'w-full'} max-w-[60ch]`}
                    />
                  ))}
                  {field && (
                    <div className="mt-1 flex items-end gap-2">
                      <Skeleton className="h-10 flex-1" />
                      <Skeleton className="h-10 w-28" />
                    </div>
                  )}
                </div>
              </div>
              {actions > 0 && (
                <div className="flex shrink-0 gap-2">
                  {Array.from({ length: actions }, (_, a) => (
                    <Skeleton key={a} className="h-9 w-24" />
                  ))}
                </div>
              )}
            </>
          )}
        </li>
      ))}
    </ul>
  );
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
      <p className="max-w-sm text-sm text-ink-2">
        {error?.message ?? "That didn't work. Try again in a moment."}
      </p>
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
