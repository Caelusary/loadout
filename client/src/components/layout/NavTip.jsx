// A navbar label that names an icon button on hover or keyboard focus. It's visual only (the button keeps its own
// aria-label), shows only on devices that can hover, and hides while the button's own dropdown is open.
export function NavTip({ label, className = '', children }) {
  return (
    <span className={`group/tip relative inline-flex ${className}`}>
      {children}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-full left-1/2 z-40 mt-2 -translate-x-1/2 translate-y-1 rounded-control border border-seam bg-raised px-2.5 py-1 text-[12px] font-medium whitespace-nowrap text-ink opacity-0 shadow-[0_8px_24px_-12px_rgb(0_0_0/0.7)] transition-[opacity,translate] duration-150 ease-out group-hover/tip:translate-y-0 group-hover/tip:opacity-100 group-hover/tip:delay-150 group-has-[:focus-visible]/tip:translate-y-0 group-has-[:focus-visible]/tip:opacity-100 group-has-[[aria-expanded=true]]/tip:hidden motion-reduce:transition-none"
      >
        {label}
      </span>
    </span>
  );
}
