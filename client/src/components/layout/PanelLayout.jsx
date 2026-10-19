import { NavLink, Outlet } from 'react-router';
import { ScrollRow } from '../ui/ScrollRow.jsx';

// Side navigation for the account, Seller Center and Admin areas. Becomes a scrolling tab row on phones, unless
// `phoneNav` is off because the tab bar and menu already hold these links there (the admin panel).
export function PanelLayout({ title, links, phoneNav = true }) {
  // A nav with a single link (a rider's or admin's account is only Settings) is just noise, so it's left out, and the page sits centred like the rider's Deliveries.
  if (links.length < 2) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 pt-8 pb-4 sm:px-6">
        <Outlet />
      </div>
    );
  }
  return (
    <div className="mx-auto grid w-full max-w-[1280px] grid-cols-[minmax(0,1fr)] gap-6 px-4 pt-8 sm:px-6 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-10">
      <aside className={`lg:sticky lg:top-24 lg:self-start ${phoneNav ? '' : 'max-sm:hidden'}`}>
        <p className="mb-3 hidden text-[13px] font-medium text-ink-3 lg:block">{title}</p>
        <ScrollRow
          as="nav"
          aria-label={title}
          className="-mx-4 flex gap-1 border-b border-seam px-4 pb-3 lg:mx-0 lg:flex-col lg:border-0 lg:p-0"
        >
          {links.map(({ to, label, end, count }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex h-10 shrink-0 items-center gap-2 rounded-control px-3 text-sm whitespace-nowrap transition-colors lg:justify-between ${
                  isActive ? 'bg-raised text-ink' : 'text-ink-2 hover:bg-raised/60 hover:text-ink'
                }`
              }
            >
              {label}
              {/* How many things on this page are waiting for someone. */}
              {count > 0 && (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1.5 font-mono text-[11px] font-semibold text-on-accent tabular-nums">
                  {count > 99 ? '99+' : count}
                  <span className="sr-only"> waiting</span>
                </span>
              )}
            </NavLink>
          ))}
        </ScrollRow>
      </aside>
      <div className="min-w-0 pb-4">
        <Outlet />
      </div>
    </div>
  );
}

// Heading used inside panel pages.
export function PanelHeader({ title, description, action }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="wide text-2xl font-bold">{title}</h1>
        {description && <p className="text-sm text-ink-2">{description}</p>}
      </div>
      {action}
    </div>
  );
}
