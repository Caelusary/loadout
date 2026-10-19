import { Children, cloneElement, isValidElement } from 'react';
import { Skeleton } from './feedback.jsx';

// Wider screens get a table. Phones get one card per row: the first cell is the card's title and every
// other cell sits on its own line under its column name, so nothing hides off the right edge.
// Rows must be <tr> elements whose cells line up with `columns` (conditional cells included).
// Giving columns a `width` (px) fits the table to its container instead of scrolling sideways: those columns keep
// their width and the ones without one share the rest (truncate long text in them with min-w-0 + truncate).
export function Table({ columns, children, empty }) {
  const fitted = columns.some((c) => c.width);
  const rows = Children.map(children, (row) => {
    if (!isValidElement(row)) return row;
    const cells = Children.toArray(row.props.children).map((cell, i) =>
      isValidElement(cell) ? cloneElement(cell, { label: columns[i]?.label }) : cell,
    );
    return cloneElement(row, {}, cells);
  });

  return (
    <div className="rounded-panel border border-seam sm:overflow-x-auto">
      <table
        className={`w-full border-collapse text-left text-sm max-sm:block ${fitted ? 'sm:table-fixed' : 'sm:min-w-[640px]'}`}
      >
        <thead className="bg-raised max-sm:hidden">
          <tr>
            {columns.map((c) => (
              <th
                key={c.label}
                scope="col"
                style={c.width ? { width: c.width } : undefined}
                className={`px-4 py-3 text-[12px] font-medium tracking-wide text-ink-3 ${c.align === 'right' ? 'text-right' : ''}`}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&>tr]:border-seam max-sm:block max-sm:[&>tr]:block max-sm:[&>tr]:py-3 [&>tr:not(:last-child)]:border-b">
          {rows}
        </tbody>
      </table>
      {empty}
    </div>
  );
}

// The same table while its rows load: the real column headers (and phone card layout), with each cell a placeholder
// shaped like what it will hold. A column's `skeleton` says which: 'two' (a name over an email), 'thumb' (a photo
// beside two lines), 'tag' (a status pill), 'button', 'short' (a number or date), or 'line' (the default; the first
// column defaults to 'two').
// Fixed widths: a table column sizes to its content, so a percentage bar would shrink to nothing.
const WIDTHS = ['w-20', 'w-16', 'w-24', 'w-14', 'w-20', 'w-16'];
function Placeholder({ kind, n, right }) {
  const end = right ? 'ml-auto' : '';
  const w = WIDTHS[n % WIDTHS.length];
  if (kind === 'two' || kind === 'thumb') {
    const lines = (
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Skeleton className={`h-4 ${['w-28', 'w-32', 'w-24'][n % 3]} max-w-full`} />
        <Skeleton className={`h-3 ${['w-36', 'w-32', 'w-40'][n % 3]} max-w-full`} />
      </span>
    );
    return kind === 'thumb' ? (
      <span className="flex items-center gap-3">
        <Skeleton className="size-12 shrink-0 rounded-control" />
        {lines}
      </span>
    ) : (
      lines
    );
  }
  if (kind === 'tag') return <Skeleton className={`h-6 w-16 rounded-full ${end}`} />;
  if (kind === 'button') return <Skeleton className={`h-9 w-24 ${end}`} />;
  if (kind === 'short') return <Skeleton className={`h-4 w-14 ${end}`} />;
  return <Skeleton className={`h-4 ${w} ${end}`} />;
}

export function TableSkeleton({ columns, rows = 6 }) {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Table columns={columns}>
        {Array.from({ length: rows }, (_, r) => (
          <tr key={r}>
            {columns.map((c, i) => (
              <Cell key={c.label} align={c.align}>
                <Placeholder
                  kind={c.skeleton ?? (i === 0 ? 'two' : 'line')}
                  n={r + i}
                  right={c.align === 'right'}
                />
              </Cell>
            ))}
          </tr>
        ))}
      </Table>
    </div>
  );
}

// On phones each cell is a "label ........ value" line; the first cell drops its label and leads the card.
export function Cell({ children, align, className = '', label }) {
  return (
    <td
      data-label={label || undefined}
      className={`px-4 py-3 align-middle ${align === 'right' ? 'text-right' : ''} max-sm:flex max-sm:min-h-9 max-sm:items-center max-sm:justify-between max-sm:gap-4 max-sm:py-1 max-sm:text-right max-sm:before:shrink-0 max-sm:before:text-left max-sm:before:text-[12px] max-sm:before:text-ink-3 max-sm:before:content-[attr(data-label)] max-sm:first:pb-2 max-sm:first:text-left max-sm:first:before:hidden ${className}`}
    >
      {children}
    </td>
  );
}
