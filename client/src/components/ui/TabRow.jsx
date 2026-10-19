import { ScrollRow } from './ScrollRow.jsx';

// A row of filter tabs with an optional count on each, scrolling sideways on a phone. `tabs` is [[value, label]];
// `counts` is keyed by value. The list it filters sits right under it.
export function TabRow({ tabs, value, onChange, counts, label = 'Filter' }) {
  return (
    <ScrollRow role="tablist" aria-label={label} className="mb-5 flex gap-1">
      {tabs.map(([key, text]) => (
        <button
          key={key || 'all'}
          type="button"
          role="tab"
          aria-selected={value === key}
          onClick={() => onChange(key)}
          className="h-9 shrink-0 rounded-control px-3 text-[13px] whitespace-nowrap text-ink-2 transition-colors hover:text-ink aria-selected:bg-raised aria-selected:text-ink"
        >
          {text}
          {counts?.[key] !== undefined && <span className="ml-1.5 font-mono text-ink-3">{counts[key]}</span>}
        </button>
      ))}
    </ScrollRow>
  );
}
