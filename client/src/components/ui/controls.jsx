import { CaretLeft, CaretRight, Minus, Plus, Star } from '@phosphor-icons/react';
import { useId } from 'react';
import { MAX_QTY } from '../../lib/constants.js';
import { Button } from './Button.jsx';

export function QtyStepper({ value, onChange, max = MAX_QTY, label = 'Quantity' }) {
  const limit = Math.max(1, Math.min(MAX_QTY, max));
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex h-11 items-center rounded-control border border-edge bg-bg"
    >
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        disabled={value <= 1}
        aria-label="Decrease quantity"
        className="grid size-11 place-items-center text-ink-2 transition-colors hover:text-ink disabled:opacity-35"
      >
        <Minus size={14} weight="bold" />
      </button>
      <span className="w-8 text-center font-mono text-sm tabular-nums" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={value >= limit}
        aria-label="Increase quantity"
        className="grid size-11 place-items-center text-ink-2 transition-colors hover:text-ink disabled:opacity-35"
      >
        <Plus size={14} weight="bold" />
      </button>
    </div>
  );
}

export function RatingDisplay({ value = 0, count, size = 14 }) {
  const rounded = Math.round(value);
  return (
    <span className="inline-flex items-center gap-1.5" aria-label={`Rated ${value.toFixed(1)} out of 5`}>
      <span className="flex text-accent-ink" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((n) => (
          <Star key={n} size={size} weight={n <= rounded ? 'fill' : 'regular'} className={n <= rounded ? '' : 'text-edge'} />
        ))}
      </span>
      {count !== undefined && <span className="font-mono text-[12px] text-ink-3 tabular-nums">({count})</span>}
    </span>
  );
}

export function RatingInput({ value, onChange, error }) {
  const name = useId();
  return (
    <fieldset>
      <legend className="mb-1.5 text-[13px] font-medium text-ink-2">Rating</legend>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="grid size-10 cursor-pointer place-items-center rounded-control hover:bg-raised">
            <input
              type="radio"
              name={name}
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
              className="peer sr-only"
            />
            <Star
              size={22}
              weight={n <= value ? 'fill' : 'regular'}
              className={`${n <= value ? 'text-accent-ink' : 'text-edge'} rounded-sm peer-focus-visible:outline-2 peer-focus-visible:outline-accent-ink`}
            />
            <span className="sr-only">
              {n} star{n > 1 ? 's' : ''}
            </span>
          </label>
        ))}
      </div>
      {error && <p className="mt-1 text-[13px] text-bad">{error}</p>}
    </fieldset>
  );
}

export function Pagination({ page, pages, onPage }) {
  if (pages <= 1) return null;
  return (
    <nav className="flex items-center justify-center gap-3 pt-8" aria-label="Pagination">
      <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        <CaretLeft size={14} /> Previous
      </Button>
      <span className="font-mono text-[13px] text-ink-3 tabular-nums">
        Page {page} of {pages}
      </span>
      <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Next <CaretRight size={14} />
      </Button>
    </nav>
  );
}
