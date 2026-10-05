import { ArrowRight } from '@phosphor-icons/react';
import { Link } from 'react-router';

const R = 17;
const C = 2 * Math.PI * R;
const GAP = C * 0.24; // open on the side the arrow points to

// A round "go" link: an open ring around an arrow. The ring is open where the arrow points and
// closes on hover or focus, with the arrow nudging through.
export function ArcArrowLink({ to, label, className = '' }) {
  return (
    <Link
      to={to}
      aria-label={label}
      title={label}
      className={`group/arc relative grid size-10 shrink-0 place-items-center rounded-full text-ink-2 hover:text-accent-ink focus-visible:text-accent-ink ${className}`}
    >
      <svg viewBox="0 0 40 40" className="absolute inset-0 size-full" aria-hidden="true">
        <circle
          cx="20"
          cy="20"
          r={R}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          // Dash offset of arc + gap/2 centres the gap on the right, where the stroke starts.
          style={{ '--arc': C - GAP, '--gap': GAP, '--off': C - GAP / 2, '--c': C }}
          className="opacity-60 transition-[stroke-dasharray,stroke-dashoffset,opacity] duration-300 ease-out [stroke-dasharray:var(--arc)_var(--gap)] [stroke-dashoffset:var(--off)] group-hover/arc:opacity-100 group-hover/arc:[stroke-dasharray:var(--c)_0] group-hover/arc:[stroke-dashoffset:var(--c)] group-focus-visible/arc:opacity-100 group-focus-visible/arc:[stroke-dasharray:var(--c)_0] group-focus-visible/arc:[stroke-dashoffset:var(--c)]"
        />
      </svg>
      <ArrowRight size={16} weight="bold" className="transition-transform duration-200 ease-out group-hover/arc:translate-x-0.5" />
    </Link>
  );
}
