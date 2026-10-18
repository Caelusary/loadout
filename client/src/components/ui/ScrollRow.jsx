import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const FADE = 28; // px of fade at an edge that has more to scroll to

// A row that scrolls sideways when it doesn't fit (tabs, filter chips, a panel's section nav). Whichever edge has
// more items fades out, so a cut-off tab reads as "there's more" rather than as a bug, and the active item
// (aria-current, aria-selected or data-active) is scrolled into view. With nothing to scroll there's no fade.
export function ScrollRow({ as: Tag = 'div', className = '', style, children, ...props }) {
  const ref = useRef(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  useEffect(() => {
    const el = ref.current;
    const update = () => {
      const start = el.scrollLeft > 2;
      const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
      setEdges((e) => (e.start === start && e.end === end ? e : { start, end }));
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, []);

  // Bring the active item into view without scrolling the page itself; only when it changes, so a row the
  // visitor scrolled by hand isn't yanked back on every re-render.
  const lastActive = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const active = el.querySelector(
      '[aria-current="page"], [aria-selected="true"], [aria-pressed="true"], [data-active]',
    );
    if (!active || active === lastActive.current) return;
    lastActive.current = active;
    if (el.scrollWidth <= el.clientWidth) return;
    const left = active.offsetLeft; // the row is relative, so this is measured from its start
    if (left < el.scrollLeft + FADE || left + active.offsetWidth > el.scrollLeft + el.clientWidth - FADE)
      el.scrollLeft = left - (el.clientWidth - active.offsetWidth) / 2;
  });

  const from = edges.start ? `transparent 0, #000 ${FADE}px` : '#000 0';
  const to = edges.end ? `#000 calc(100% - ${FADE}px), transparent 100%` : '#000 100%';
  const mask = edges.start || edges.end ? `linear-gradient(to right, ${from}, ${to})` : undefined;

  return (
    <Tag
      ref={ref}
      className={`relative overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
      style={{ ...style, maskImage: mask, WebkitMaskImage: mask }}
      {...props}
    >
      {children}
    </Tag>
  );
}