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

    // A mouse wheel only scrolls up and down, which would leave a cut-off row unreachable on a desktop. While the
    // row has room that way, the wheel moves it sideways instead; at its ends the page scrolls as usual.
    const onWheel = (e) => {
      if (e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; // pinch zoom, or a trackpad already sideways
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0) return;
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      if ((dy < 0 && el.scrollLeft <= 0) || (dy > 0 && el.scrollLeft >= max - 1)) return;
      e.preventDefault();
      el.scrollLeft += dy;
    };
    // Dragging with the mouse scrolls it too (touch already does). A drag doesn't count as a click on what it ends on.
    let drag = null;
    const onDown = (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0 || el.scrollWidth <= el.clientWidth) return;
      drag = { x: e.clientX, left: el.scrollLeft, moved: false };
    };
    const onMove = (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      if (!drag.moved && Math.abs(dx) < 5) return;
      drag.moved = true;
      el.scrollLeft = drag.left - dx;
    };
    const onUp = () => {
      if (drag?.moved) {
        const swallow = (ev) => {
          ev.stopPropagation();
          ev.preventDefault();
        };
        el.addEventListener('click', swallow, { capture: true, once: true });
        setTimeout(() => el.removeEventListener('click', swallow, { capture: true }), 0);
      }
      drag = null;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      el.removeEventListener('scroll', update);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
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
