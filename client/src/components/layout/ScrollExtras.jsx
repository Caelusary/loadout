import { ArrowUp } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';

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

export function BackToTop() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const sentinel = document.getElementById('top-sentinel');
    if (!sentinel) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(!entry.isIntersecting));
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);
  return (
    <button
      type="button"
      aria-label="Back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })}
      className={`fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 grid size-11 max-sm:hidden place-items-center rounded-full border border-seam bg-plate text-ink-2 shadow-[0_6px_16px_-8px_rgb(0_0_0/0.4)] transition-[opacity,transform,color] duration-200 ease-out hover:text-ink active:scale-95 sm:right-6 ${
        visible ? 'opacity-100' : 'pointer-events-none translate-y-2 opacity-0'
      }`}
    >
      <ArrowUp size={18} />
    </button>
  );
}
