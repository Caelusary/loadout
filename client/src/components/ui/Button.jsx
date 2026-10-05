import { Link } from 'react-router';

const BASE =
  'relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-control font-medium transition-[transform,background-color,border-color,color] duration-150 ease-out active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45';

const VARIANTS = {
  primary: 'bg-accent text-on-accent hover:bg-accent-soft',
  secondary: 'border border-seam bg-raised text-ink hover:border-edge',
  ghost: 'text-ink-2 hover:bg-raised hover:text-ink',
  danger: 'border border-bad/50 text-bad hover:bg-bad/10',
};

const SIZES = {
  sm: 'h-9 px-3 text-[13px]',
  md: 'h-11 px-4 text-sm',
  lg: 'h-12 px-6 text-[15px]',
  icon: 'size-11',
};

const buttonClass = ({ variant = 'primary', size = 'md', className = '' } = {}) =>
  `${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`;

function Spinner() {
  return (
    <span className="absolute inset-0 grid place-items-center" aria-hidden="true">
      <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
    </span>
  );
}

export function Button({ variant, size, loading = false, disabled, className, children, type = 'button', ...props }) {
  return (
    <button
      type={type}
      className={buttonClass({ variant, size, className })}
      aria-busy={loading || undefined}
      // Taken out of props so a caller's disabled={false} can't re-enable the button while it's loading.
      disabled={loading || disabled}
      {...props}
    >
      {loading && <Spinner />}
      {/* Label stays in the layout while loading so the button keeps its width. */}
      <span className={`inline-flex items-center gap-2 ${loading ? 'invisible' : ''}`}>{children}</span>
    </button>
  );
}

export function ButtonLink({ variant, size, className, children, ...props }) {
  return (
    <Link className={buttonClass({ variant, size, className })} {...props}>
      {children}
    </Link>
  );
}
