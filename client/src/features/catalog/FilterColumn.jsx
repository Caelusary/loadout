import { useEffect, useRef } from 'react';

// The desktop filter column: a card pinned beside the products that scrolls on its own, without a visible bar.
// Its height is fitted to the screen from wherever it starts (lower at the top of the page, under the header once
// pinned), so its bottom edge is always in view; the bottom fades only while there's more to scroll to. Both are set
// on the elements directly, since they change on every scroll.
export function FilterColumn({ header, children }) {
  const aside = useRef(null);
  const scroller = useRef(null);

  useEffect(() => {
    const box = aside.current;
    const list = scroller.current;
    let frame = 0;
    const fit = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!box.offsetParent) return; // hidden below the lg breakpoint
        const top = Math.max(box.getBoundingClientRect().top, 96); // 96px = top-24, where it pins
        box.style.maxHeight = `${window.innerHeight - top - 16}px`;
        list.dataset.more = String(list.scrollTop + list.clientHeight < list.scrollHeight - 4);
      });
    };
    fit();
    window.addEventListener('scroll', fit, { passive: true });
    window.addEventListener('resize', fit);
    list.addEventListener('scroll', fit, { passive: true });
    // Opening or closing a section changes the height.
    const observer = new ResizeObserver(fit);
    observer.observe(list.firstElementChild);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', fit);
      window.removeEventListener('resize', fit);
      list.removeEventListener('scroll', fit);
      observer.disconnect();
    };
  }, []);

  return (
    <aside
      ref={aside}
      aria-label="Filters"
      className="hidden lg:sticky lg:top-24 lg:flex lg:flex-col lg:self-start lg:overflow-hidden lg:rounded-panel lg:border lg:border-seam lg:bg-plate"
    >
      {header}
      <div
        ref={scroller}
        className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5 data-[more=true]:fade-bottom"
      >
        {children}
      </div>
    </aside>
  );
}
