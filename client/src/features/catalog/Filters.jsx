import { CaretDown } from '@phosphor-icons/react';
import { useId, useState } from 'react';
import {
  CATEGORIES,
  CATEGORY_LABELS,
  CONNECTIVITY,
  CONNECTIVITY_LABELS,
  LAYOUT_LABELS,
  LAYOUTS,
  RESOLUTION_LABELS,
  RESOLUTIONS,
  SWITCH_LABELS,
  SWITCH_TYPES,
} from '../../lib/constants.js';

// One filter as a section that opens and closes; opening pushes the ones below down. The header names what's picked,
// so a closed section still shows the filter in use. Sections start open when they're the category or in use.
function OptionList({ legend, name, options, labels, value, onChange, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen || Boolean(value));
  const panel = useId();
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panel}
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 w-full items-center justify-between gap-2 rounded-control px-2.5 text-left hover:bg-raised"
      >
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="text-[13px] font-medium text-ink-2">{legend}</span>
          {value && <span className="truncate text-[13px] text-accent-ink">{labels[value] ?? value}</span>}
        </span>
        <CaretDown
          size={14}
          className={`shrink-0 text-ink-3 transition-transform duration-200 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {/* Height animates through the grid row (0fr to 1fr); inert keeps the hidden radios out of the tab order. */}
      <div
        id={panel}
        inert={!open}
        className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
      >
        <fieldset className="flex min-h-0 flex-col gap-0.5 overflow-hidden">
          <legend className="sr-only">{legend}</legend>
          {[['', 'Any'], ...options.map((o) => [o, labels[o]])].map(([optionValue, label]) => (
            <label
              key={optionValue || 'any'}
              className="flex h-9 cursor-pointer items-center gap-2.5 rounded-control px-2 text-sm text-ink-2 hover:bg-raised has-checked:text-ink"
            >
              <input
                type="radio"
                name={name}
                checked={(value ?? '') === optionValue}
                onChange={() => onChange(optionValue)}
                className="accent-accent-ink"
              />
              {label}
            </label>
          ))}
        </fieldset>
      </div>
    </div>
  );
}

// Every filter lives in the URL; this component only reads and writes search params.
export function Filters({ params, brands = [], onChange }) {
  const uid = useId();
  const category = params.get('category') ?? '';
  const set = (key) => (value) => onChange({ [key]: value });
  const showKeyboard = !category || category === 'keyboard';

  return (
    <div className="flex flex-col divide-y divide-seam/60">
      <OptionList
        legend="Category"
        name={`${uid}-category`}
        options={CATEGORIES}
        labels={CATEGORY_LABELS}
        value={category}
        defaultOpen
        // Spec filters from another category would hide everything, so drop them.
        onChange={(value) => onChange({ category: value, switchType: '', layout: '', resolution: '' })}
      />
      {showKeyboard && (
        <OptionList
          legend="Switch type"
          name={`${uid}-switchType`}
          options={SWITCH_TYPES}
          labels={SWITCH_LABELS}
          value={params.get('switchType')}
          onChange={set('switchType')}
        />
      )}
      {category === 'keyboard' && (
        <OptionList
          legend="Layout"
          name={`${uid}-layout`}
          options={LAYOUTS}
          labels={LAYOUT_LABELS}
          value={params.get('layout')}
          onChange={set('layout')}
        />
      )}
      {category === 'webcam' && (
        <OptionList
          legend="Resolution"
          name={`${uid}-resolution`}
          options={RESOLUTIONS}
          labels={RESOLUTION_LABELS}
          value={params.get('resolution')}
          onChange={set('resolution')}
        />
      )}
      {category !== 'mousepad' && (
        <OptionList
          legend="Connectivity"
          name={`${uid}-connectivity`}
          options={CONNECTIVITY}
          labels={CONNECTIVITY_LABELS}
          value={params.get('connectivity')}
          onChange={set('connectivity')}
        />
      )}
      {brands.length > 1 && (
        <OptionList
          legend="Brand"
          name={`${uid}-brand`}
          options={brands}
          labels={Object.fromEntries(brands.map((b) => [b, b]))}
          value={params.get('brand')}
          onChange={set('brand')}
        />
      )}
    </div>
  );
}
