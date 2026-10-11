import { ArrowUp } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';

// A thin bar across the top that fills as the page scrolls. Uses a CSS scroll-driven animation where the
// browser supports it (no JavaScript on scroll); otherwise falls back to a passive, rAF-throttled listener.
const scrollTimelineSupported = typeof CSS !== 'undefined' && CSS.supports('animation-timeline: scroll()');

function useScrollFraction(enabled) {
  const [fraction, setFraction] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setFraction(max > 0 ? Math.min(1, window.scrollY / max) : 0);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [enabled]);
  return fraction;
}

export function ScrollProgress() {
  const fraction = useScrollFraction(!scrollTimelineSupported);
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-x-0 top-0 z-50 h-[3px] origin-left bg-accent glow ${
        scrollTimelineSupported ? '[animation:scroll-progress_linear_both] [animation-timeline:scroll(root)]' : ''
      }`}
      style={scrollTimelineSupported ? undefined : { transform: `scaleX(${fraction})` }}
    />
  );
}

// Pages where a floating button would sit on the actions that matter (row menus, Check out, Place order). They're
// short or have their own navigation, so there's nothing to gain from it there.
const NO_BACK_TO_TOP = /^\/(admin|seller|deliveries|account|orders|cart|checkout)(\/|$)/;

export function BackToTop() {
  const { pathname } = useLocation();
  const [past, setPast] = useState(false); // scrolled beyond the first screen or so
  const [goingUp, setGoingUp] = useState(false);
  useEffect(() => {
    const sentinel = document.getElementById('top-sentinel');
    if (!sentinel) return;
    const observer = new IntersectionObserver(([entry]) => setPast(!entry.isIntersecting));
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);
  // Only while scrolling back up: someone heading for the top gets the shortcut, someone reading down the page
  // doesn't get a button parked over the corner of whatever they're looking at.
  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (Math.abs(y - last) < 8) return;
      setGoingUp(y < last);
      last = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const visible = past && goingUp && !NO_BACK_TO_TOP.test(pathname);
  return (
    <button
      type="button"
      aria-label="Back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })}
      className={`fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 grid size-11 max-sm:hidden place-items-center rounded-full border border-seam bg-plate text-ink-2 shadow-[0_6px_16px_-8px_rgb(0_0_0/0.4)] transition-[opacity,transform,color] duration-200 ease-out hover:text-ink active:scale-95 sm:right-6 max-lg:[:root:has([data-buybar])_&]:hidden ${
        visible ? 'opacity-100' : 'pointer-events-none translate-y-2 opacity-0'
      }`}
    >
      <ArrowUp size={18} />
    </button>
  );
}
