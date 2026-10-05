import { useId } from 'react';
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

function OptionList({ legend, name, options, labels, value, onChange }) {
  return (
    <fieldset className="flex flex-col gap-0.5">
      <legend className="mb-2 text-[13px] font-medium text-ink-3">{legend}</legend>
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
  );
}

// Every filter lives in the URL; this component only reads and writes search params.
export function Filters({ params, brands = [], onChange }) {
  const uid = useId();
  const category = params.get('category') ?? '';
  const set = (key) => (value) => onChange({ [key]: value });
  const showKeyboard = !category || category === 'keyboard';

  return (
    <div className="flex flex-col gap-7">
      <OptionList
        legend="Category"
        name={`${uid}-category`}
        options={CATEGORIES}
        labels={CATEGORY_LABELS}
        value={category}
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
      <PriceFilter
        key={`${params.get('minPrice')}-${params.get('maxPrice')}`}
        min={params.get('minPrice') ?? ''}
        max={params.get('maxPrice') ?? ''}
        onApply={(minPrice, maxPrice) => onChange({ minPrice, maxPrice })}
      />
      <label className="flex h-9 cursor-pointer items-center gap-2.5 px-2 text-sm text-ink-2">
        <input
          type="checkbox"
          checked={params.get('inStock') === '1'}
          onChange={(e) => onChange({ inStock: e.target.checked ? '1' : '' })}
          className="accent-accent-ink"
        />
        In stock only
      </label>
      <label className="flex h-9 cursor-pointer items-center gap-2.5 px-2 text-sm text-ink-2">
        <input
          type="checkbox"
          checked={params.get('onSale') === '1'}
          onChange={(e) => onChange({ onSale: e.target.checked ? '1' : '' })}
          className="accent-accent-ink"
        />
        On sale
      </label>
    </div>
  );
}

function PriceFilter({ min, max, onApply }) {
  const apply = (form) => {
    const data = new FormData(form);
    const clean = (v) => (/^\d+$/.test(String(v).trim()) ? String(v).trim() : '');
    onApply(clean(data.get('min')), clean(data.get('max')));
  };
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        apply(e.currentTarget);
      }}
      onBlur={(e) => apply(e.currentTarget)}
    >
      <p className="text-[13px] font-medium text-ink-3">Price (₱)</p>
      <div className="flex items-center gap-2">
        <input
          name="min"
          defaultValue={min}
          inputMode="numeric"
          placeholder="Min"
          aria-label="Minimum price in pesos"
          className="h-10 w-full rounded-control border border-edge bg-bg px-3 font-mono text-sm tabular-nums placeholder:font-sans placeholder:text-ink-3 focus:border-accent-ink focus:outline-none"
        />
        <span className="text-ink-3">to</span>
        <input
          name="max"
          defaultValue={max}
          inputMode="numeric"
          placeholder="Max"
          aria-label="Maximum price in pesos"
          className="h-10 w-full rounded-control border border-edge bg-bg px-3 font-mono text-sm tabular-nums placeholder:font-sans placeholder:text-ink-3 focus:border-accent-ink focus:outline-none"
        />
      </div>
    </form>
  );
}
