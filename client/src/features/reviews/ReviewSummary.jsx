import { Camera, Star } from '@phosphor-icons/react';
import { RatingDisplay } from '../../components/ui/controls.jsx';

// The average, how many rated it, and a bar per star. Tapping a bar shows only those reviews (again shows all).
export function ReviewSummary({ product, breakdown, stars, onStars, children }) {
  const total = product.ratingCount;
  return (
    <div className="flex flex-col gap-5 rounded-panel border border-seam bg-plate p-5">
      {total > 0 ? (
        <div className="flex items-center gap-4">
          <span className="font-mono text-5xl leading-none text-ink tabular-nums">
            {product.ratingAvg.toFixed(1)}
          </span>
          <span className="flex flex-col gap-1">
            <RatingDisplay value={product.ratingAvg} />
            <span className="text-[13px] text-ink-3">
              from {total} buyer{total === 1 ? '' : 's'}
            </span>
          </span>
        </div>
      ) : (
        <p className="text-sm text-ink-2">No ratings yet.</p>
      )}
      {total > 0 && breakdown && (
        <ul className="flex flex-col gap-1" aria-label="Ratings by stars">
          {[5, 4, 3, 2, 1].map((n) => {
            const count = breakdown[n] ?? 0;
            const on = stars === n;
            return (
              <li key={n}>
                <button
                  type="button"
                  aria-pressed={on}
                  disabled={!count}
                  onClick={() => onStars(on ? null : n)}
                  aria-label={`${count} ${n}-star review${count === 1 ? '' : 's'}${on ? ', showing only these' : ''}`}
                  className="grid h-8 w-full grid-cols-[2.25rem_minmax(0,1fr)_2rem] items-center gap-3 rounded-control px-1.5 text-[13px] text-ink-2 transition-colors enabled:hover:bg-raised disabled:opacity-50 aria-pressed:bg-accent/10 aria-pressed:text-ink"
                >
                  <span className="flex items-center gap-1 font-mono tabular-nums">
                    {n} <Star size={12} weight="fill" className="text-accent-ink" />
                  </span>
                  <span className="h-2 overflow-hidden rounded-full bg-raised">
                    <span
                      className="block h-full rounded-full bg-accent-ink transition-[width] duration-500"
                      style={{ width: `${(count / total) * 100}%` }}
                    />
                  </span>
                  <span className="text-left font-mono text-ink-3 tabular-nums">{count}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {children && <div className={total > 0 ? 'border-t border-seam pt-5' : ''}>{children}</div>}
    </div>
  );
}

// The filter row: All, each star level that has reviews (phones, where the bars don't fit), and With photos, as one
// segmented control. The picked one is lit; counts sit beside each label in a quieter mono.
export function ReviewFilters({ breakdown, photoCount, stars, photosOnly, onChange, withStars = false }) {
  const seg =
    'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[7px] px-3 text-[13px] text-ink-2 transition-colors hover:text-ink aria-pressed:bg-plate aria-pressed:text-ink aria-pressed:shadow-[inset_0_0_0_1px_var(--color-accent-ink)]';
  const count = 'font-mono text-[12px] text-ink-3 tabular-nums';
  const levels = withStars ? [5, 4, 3, 2, 1].filter((n) => breakdown?.[n]) : [];
  return (
    <div
      role="group"
      aria-label="Filter reviews"
      className="no-scrollbar flex max-w-full gap-0.5 overflow-x-auto rounded-control border border-seam bg-raised/50 p-0.5"
    >
      <button type="button" aria-pressed={!stars && !photosOnly} onClick={() => onChange({})} className={seg}>
        All
      </button>
      {levels.map((n) => (
        <button
          key={n}
          type="button"
          aria-pressed={stars === n}
          onClick={() => onChange({ stars: stars === n ? null : n, photos: photosOnly })}
          className={seg}
        >
          {n}
          <Star size={12} weight="fill" className="text-accent-ink" />
          <span className={count}>{breakdown[n]}</span>
        </button>
      ))}
      {photoCount > 0 && (
        <button
          type="button"
          aria-pressed={photosOnly}
          onClick={() => onChange({ stars, photos: !photosOnly })}
          className={seg}
        >
          <Camera size={14} className="text-accent-ink" /> Photos <span className={count}>{photoCount}</span>
        </button>
      )}
    </div>
  );
}
