import { ArrowRight, MagnifyingGlass } from '@phosphor-icons/react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { toQuery } from '../../lib/api.js';
import { CATEGORY_LABELS } from '../../lib/constants.js';

// Matches the server, which only reads the first 80 characters of a search.
const MAX_SEARCH = 80;

// Starter searches for the selected category, so a first visit shows what the shop can filter by
// before anyone types. Values match the shop's URL filters (specs match exactly on the server).
const STARTERS = {
  keyboard: [
    ['75% boards', { layout: '75' }],
    ['Tactile switches', { switchType: 'tactile' }],
    ['Tri-mode wireless', { connectivity: 'tri-mode' }],
    ['Under ₱5,000', { maxPrice: '5000' }],
  ],
  mouse: [
    ['Wireless', { connectivity: 'wireless' }],
    ['Bluetooth', { connectivity: 'bluetooth' }],
    ['Wired', { connectivity: 'wired' }],
    ['Under ₱2,500', { maxPrice: '2500' }],
  ],
  headset: [
    ['Wireless', { connectivity: 'wireless' }],
    ['Bluetooth', { connectivity: 'bluetooth' }],
    ['Wired', { connectivity: 'wired' }],
    ['Under ₱5,000', { maxPrice: '5000' }],
  ],
  webcam: [
    ['4K', { resolution: '4k' }],
    ['1080p', { resolution: '1080p' }],
    ['Under ₱3,000', { maxPrice: '3000' }],
  ],
  mousepad: [
    ['Under ₱1,500', { maxPrice: '1500' }],
    ['In stock', { inStock: '1' }],
  ],
  accessory: [
    ['Under ₱1,000', { maxPrice: '1000' }],
    ['In stock', { inStock: '1' }],
  ],
};

// `picker` is the phone/tablet category strip, placed between the field and the starters it drives.
export function HeroSearch({ category, picker }) {
  const navigate = useNavigate();
  const label = CATEGORY_LABELS[category].toLowerCase();
  const [q, setQ] = useState('');
  const [message, setMessage] = useState('');

  // One field, so it's validated here rather than pulling the form libraries into the first page load.
  // Typed words search every category; an empty search opens the selected one.
  const submit = (e) => {
    e.preventDefault();
    const text = q.trim();
    if (text.length > MAX_SEARCH) return setMessage(`Keep the search under ${MAX_SEARCH} characters`);
    navigate(`/shop${toQuery(text ? { q: text } : { category })}`);
  };

  return (
    <div className="flex flex-col gap-4">
      <h1
        id="hero-title"
        className="wide text-[clamp(1.75rem,3.4vw,2.9rem)] leading-[1.1] font-bold tracking-[-0.015em] text-balance"
      >
        Find your next piece of desk gear.
      </h1>
      <form
        role="search"
        aria-label="Search products"
        onSubmit={submit}
        noValidate
        className="flex flex-col gap-1.5"
      >
        <div className="flex gap-2">
          <label className="group relative flex min-w-0 flex-1 items-center">
            <span className="sr-only">Search products</span>
            <MagnifyingGlass
              size={20}
              className="pointer-events-none absolute left-4 text-ink-3 group-focus-within:text-accent-ink"
            />
            <input
              name="q"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                if (message) setMessage('');
              }}
              type="search"
              enterKeyHint="search"
              autoComplete="off"
              placeholder={`Search ${label}…`}
              aria-invalid={Boolean(message)}
              aria-describedby={message ? 'hero-search-error' : undefined}
              className="h-14 w-full rounded-control border border-edge bg-plate pr-4 pl-12 text-[16px] text-ink placeholder:text-ink-3 focus:border-accent-ink focus:outline-none aria-invalid:border-bad sm:text-[17px]"
            />
          </label>
          <button
            type="submit"
            className="glow inline-flex h-14 shrink-0 items-center gap-2 rounded-control bg-accent px-5 text-[15px] font-semibold text-on-accent transition-[filter,transform] duration-150 ease-out hover:brightness-105 active:scale-[0.98] max-sm:px-4"
          >
            <span className="max-sm:sr-only">Search</span>
            <ArrowRight size={18} weight="bold" />
          </button>
        </div>
        {message && (
          <p id="hero-search-error" className="text-[13px] text-bad">
            {message}
          </p>
        )}
      </form>
      {/* Phones scroll the starters sideways; wider screens wrap them. */}
      {picker}
      {/* Keyed by category so a new set fades in when a tile is picked. */}
      <ul
        key={category}
        aria-label={`Popular ${label} searches`}
        className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {STARTERS[category].map(([text, filters]) => (
          <li key={text} className="shrink-0 transition-opacity duration-300 ease-out starting:opacity-0">
            <Link
              to={`/shop${toQuery({ category, ...filters })}`}
              className="inline-flex h-9 items-center rounded-full border border-seam px-3.5 text-[14px] whitespace-nowrap text-ink-2 transition-colors hover:border-edge hover:bg-raised hover:text-ink"
            >
              {text}
            </Link>
          </li>
        ))}
        <li className="shrink-0 transition-opacity duration-300 ease-out starting:opacity-0">
          <Link
            to={`/shop${toQuery({ category })}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[14px] font-medium whitespace-nowrap text-accent-ink hover:underline"
          >
            All {label}
            <ArrowRight size={14} />
          </Link>
        </li>
      </ul>
    </div>
  );
}
