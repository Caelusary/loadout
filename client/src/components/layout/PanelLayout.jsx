import { NavLink, Outlet } from 'react-router';

// Side navigation for the account, Seller Center and Admin areas. Becomes a scrolling tab row on phones.
export function PanelLayout({ title, links }) {
  return (
    <div className="mx-auto grid w-full max-w-[1280px] grid-cols-[minmax(0,1fr)] gap-6 px-4 pt-8 sm:px-6 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-10">
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <p className="mb-3 hidden text-[13px] font-medium text-ink-3 lg:block">{title}</p>
        <nav
          aria-label={title}
          className="-mx-4 flex gap-1 overflow-x-auto border-b border-seam px-4 pb-3 lg:mx-0 lg:flex-col lg:border-0 lg:p-0"
        >
          {links.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex h-10 shrink-0 items-center rounded-control px-3 text-sm whitespace-nowrap transition-colors ${
                  isActive ? 'bg-raised text-ink' : 'text-ink-2 hover:bg-raised/60 hover:text-ink'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
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
