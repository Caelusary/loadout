import { Skeleton } from '../ui/feedback.jsx';

// Shown while a lazily loaded page's code arrives; shaped like a typical page so nothing jumps.
export function PageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 pt-10 sm:px-6" role="status" aria-label="Loading page">
      <Skeleton className="mb-3 h-9 w-64" />
      <Skeleton className="mb-10 h-4 w-96 max-w-full" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <Skeleton className="mt-8 h-64" />
    </div>
  );
}
