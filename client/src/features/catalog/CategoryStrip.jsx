import { X } from '@phosphor-icons/react';
import { CATEGORY_LABELS, CONNECTIVITY_LABELS, RESOLUTION_LABELS, SWITCH_LABELS } from '../../lib/constants.js';
import { CATEGORY_MODELS } from '../home/categoryModels.js';

const SWITCH_DOT = { linear: 'bg-linear', tactile: 'bg-tactile', clicky: 'bg-clicky', magnetic: 'bg-magnetic' };
const CONNECTION = ['wired', 'wireless', 'bluetooth'].map((v) => [v, CONNECTIVITY_LABELS[v]]);
const UNDER = [
  ['1000', '₱1,000'],
  ['2000', '₱2,000'],
  ['4000', '₱4,000'],
];

// The one-line pitch and the filter people reach for first in each category.
const STRIP = {
  keyboard: {
    line: 'Mechanical boards from 60% to full-size. Start with how you want the switches to feel.',
    key: 'switchType',
    label: 'Switch',
    options: Object.entries(SWITCH_LABELS),
  },
  mouse: { line: 'Light, fast and ergonomic. Weight and sensor are listed on every one.', key: 'connectivity', label: 'Connection', options: CONNECTION },
  headset: { line: 'Closed and open-back headsets for games, calls and music.', key: 'connectivity', label: 'Connection', options: CONNECTION },
  webcam: {
    line: 'Desk webcams from 720p to 4K. Frame rate matters as much as resolution.',
    key: 'resolution',
    label: 'Resolution',
    options: ['1080p', '1440p', '4k'].map((v) => [v, RESOLUTION_LABELS[v]]),
  },
  mousepad: { line: 'Cloth for control, speed weave for pace.', key: 'maxPrice', label: 'Under', options: UNDER },
  accessory: { line: 'Cables, numpads and the small things that finish a desk.', key: 'maxPrice', label: 'Under', options: UNDER },
};

// Header for a category page: what the category is, how many products, and its most-used filter as chips.
export function CategoryStrip({ category, total, params, onChange }) {
  const { icon: Icon } = CATEGORY_MODELS[category];
  const { line, key, label, options } = STRIP[category];
  const current = params.get(key);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex items-start gap-4">
        <span className="grid size-14 shrink-0 place-items-center rounded-panel border border-b-[3px] border-seam bg-plate text-accent-ink">
          <Icon size={28} />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <h1 className="wide text-[28px] leading-tight font-bold sm:text-[32px]">{CATEGORY_LABELS[category]}</h1>
            <p className="font-mono text-[13px] text-ink-3 tabular-nums" aria-live="polite">
              {total == null ? ' ' : `${total} product${total === 1 ? '' : 's'}`}
            </p>
          </div>
          <p className="max-w-xl text-[15px] text-ink-2">{line}</p>
        </div>
      </div>

      <div
        className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden"
        role="group"
        aria-label={`Quick filter: ${label}`}
      >
        <span className="mr-1 shrink-0 font-mono text-[12px] tracking-[0.06em] text-ink-3 uppercase">{label}</span>
        {options.map(([value, text]) => {
          const on = current === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={on}
              onClick={() => onChange({ [key]: on ? '' : value })}
              className="inline-flex h-9 shrink-0 items-center gap-2 rounded-control border border-b-2 border-seam bg-plate px-3 text-[14px] text-ink-2 transition-colors duration-150 hover:border-edge hover:text-ink aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-on-accent"
            >
              {SWITCH_DOT[value] && <span className={`size-2 rounded-[2px] ${SWITCH_DOT[value]}`} aria-hidden="true" />}
              {text}
              {on && <X size={12} weight="bold" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
