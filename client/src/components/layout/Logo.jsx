import { Link } from 'react-router';

// A keycap mark plus the wordmark. `compact` drops the wordmark on phones to make room.
export function Logo({ compact = false }) {
  return (
    // min 40px square so the compact mark is a comfortable tap target, not just the 28px tile.
    <Link
      to="/"
      className="flex min-h-10 min-w-10 shrink-0 items-center justify-center gap-2.5 rounded-control"
      aria-label="Loadout home"
    >
      <svg viewBox="0 0 32 32" className="size-7" aria-hidden="true">
        <rect x="3" y="3" width="26" height="26" rx="6" fill="var(--color-accent)" />
        <rect x="7" y="5.5" width="18" height="16" rx="3.5" fill="var(--color-accent-soft)" />
      </svg>
      <span className={`widest text-[18px] leading-none font-extrabold tracking-tight ${compact ? 'max-sm:hidden' : ''}`}>Loadout</span>
    </Link>
  );
}
