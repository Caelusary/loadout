import { MagnifyingGlass } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../../lib/api.js';
import { formatMoney } from '../../lib/format.js';
import { ProductImage } from '../ui/ProductImage.jsx';

function useDebounced(value, ms) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

// Search with suggestions (ARIA combobox). Typing is debounced, and TanStack Query cancels superseded
// requests through the abort signal, so slow answers can't overwrite newer ones.
export function SearchBox() {
  const navigate = useNavigate();
  const listId = useId();
  const box = useRef(null);
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const q = useDebounced(text.trim(), 220);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['search', q],
    queryFn: ({ signal }) => api(`/products?q=${encodeURIComponent(q)}&limit=6`, { signal }).then((r) => r.items),
    enabled: q.length >= 2,
    staleTime: 60_000,
  });

  useEffect(() => {
    const onDown = (e) => !box.current?.contains(e.target) && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, []);

  const showList = open && q.length >= 2;
  const options = [...results.map((p) => ({ type: 'product', product: p })), { type: 'all' }];

  const go = (option) => {
    setOpen(false);
    setActive(-1);
    if (option?.type === 'product') {
      setText('');
      navigate(`/p/${option.product.slug}`);
    } else {
      navigate(text.trim() ? `/shop?q=${encodeURIComponent(text.trim())}` : '/shop');
    }
  };

  const onKeyDown = (e) => {
    if (!showList) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (i + 1) % options.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i <= 0 ? options.length - 1 : i - 1));
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={box} className="relative hidden w-full max-w-xs md:block">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          go(active >= 0 ? options[active] : { type: 'all' });
        }}
      >
        <MagnifyingGlass size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" />
        <input
          type="search"
          role="combobox"
          aria-label="Search products"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search keyboards, mice, brands"
          className="h-10 w-full rounded-control border border-seam bg-plate pr-3 pl-9 text-sm text-ink placeholder:text-ink-3 transition-colors hover:border-edge focus:border-accent-ink focus:outline-none focus:placeholder:text-transparent"
        />
      </form>
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute top-12 right-0 left-0 z-40 overflow-hidden rounded-panel border border-seam bg-plate p-1.5 shadow-[0_12px_32px_-16px_rgb(0_0_0/0.45)]"
        >
          {results.length === 0 && (
            <li className="px-3 py-3 text-sm text-ink-3">{isFetching ? 'Searching…' : `No products match "${q}"`}</li>
          )}
          {options.map((option, i) => (
            <li
              key={option.type === 'product' ? option.product._id : 'all'}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={active === i}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => go(option)}
              onMouseEnter={() => setActive(i)}
              className="flex cursor-pointer items-center gap-3 rounded-control px-2 py-2 text-sm aria-selected:bg-raised"
            >
              {option.type === 'product' ? (
                <>
                  <ProductImage src={option.product.images?.[0]?.url} className="size-10 shrink-0 rounded-control" size={80} />
                  <span className="min-w-0 flex-1 truncate text-ink">{option.product.name}</span>
                  <span className="font-mono text-[13px] text-ink-2 tabular-nums">{formatMoney(option.product.priceCents)}</span>
                </>
              ) : (
                <span className="px-1 text-accent-ink">See all results for &quot;{text.trim()}&quot;</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
