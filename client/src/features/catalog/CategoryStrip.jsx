import { CATEGORY_LABELS } from '../../lib/constants.js';
import { CATEGORY_MODELS } from '../home/categoryModels.js';

// The one-line pitch for each category.
const LINE = {
  keyboard: 'Mechanical boards from 60% to full-size. Start with how you want the switches to feel.',
  mouse: 'Light, fast and ergonomic. Weight and sensor are listed on every one.',
  headset: 'Closed and open-back headsets for games, calls and music.',
  webcam: 'Desk webcams from 720p to 4K. Frame rate matters as much as resolution.',
  mousepad: 'Cloth for control, speed weave for pace.',
  accessory: 'Cables, numpads and the small things that finish a desk.',
};

// Header for a category page: what the category is and how many products. Its filters live in the filter column.
export function CategoryStrip({ category, total }) {
  const { icon: Icon } = CATEGORY_MODELS[category];
  return (
    <div className="flex min-w-0 items-start gap-4">
      <span className="grid size-14 shrink-0 place-items-center rounded-panel border border-b-[3px] border-seam bg-plate text-accent-ink">
        <Icon size={28} />
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h1 className="wide text-[28px] leading-tight font-bold sm:text-[32px]">
            {CATEGORY_LABELS[category]}
          </h1>
          <p className="font-mono text-[13px] text-ink-3 tabular-nums" aria-live="polite">
            {total == null ? ' ' : `${total} product${total === 1 ? '' : 's'}`}
          </p>
        </div>
        <p className="text-[15px] text-ink-2">{LINE[category]}</p>
      </div>
    </div>
  );
}
