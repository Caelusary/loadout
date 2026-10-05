import { Children, cloneElement, isValidElement } from 'react';

// Wider screens get a table. Phones get one card per row: the first cell is the card's title and every
// other cell sits on its own line under its column name, so nothing hides off the right edge.
// Rows must be <tr> elements whose cells line up with `columns` (conditional cells included).
export function Table({ columns, children, empty }) {
  const rows = Children.map(children, (row) => {
    if (!isValidElement(row)) return row;
    const cells = Children.toArray(row.props.children).map((cell, i) =>
      isValidElement(cell) ? cloneElement(cell, { label: columns[i]?.label }) : cell,
    );
    return cloneElement(row, {}, cells);
  });

  return (
    <div className="rounded-panel border border-seam sm:overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm max-sm:block sm:min-w-[640px]">
        <thead className="bg-raised max-sm:hidden">
          <tr>
            {columns.map((c) => (
              <th
                key={c.label}
                scope="col"
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
