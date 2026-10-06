import { useEffect, useRef } from 'react';

// An element marked data-cursor-box is locked onto as a whole, even when the pointer is over a control inside it.
// Labels only count when the label is the control (a checkbox or radio row, a rating star). Text-field
// labels are full-width captions, and locking onto them framed an invisible box beside the field.
// Browsers without :has() skip labels entirely.
const CONTROL_LABEL = CSS.supports('selector(:has(a))') ? ', label:has(input[type="checkbox"], input[type="radio"])' : '';
const INTERACTIVE = `a, button, [role="button"], [role="option"], summary, select${CONTROL_LABEL}`;
const IDLE = 26; // reticle size while free, px
const PAD = 6; // gap between a locked-on element and the brackets
const CORNERS = ['top-0 left-0 border-t-2 border-l-2', 'top-0 right-0 border-t-2 border-r-2', 'bottom-0 left-0 border-b-2 border-l-2', 'right-0 bottom-0 border-r-2 border-b-2'];

// A targeting-reticle cursor: a dot on the pointer, four corner brackets trailing it that lock onto
// whatever clickable thing is under the pointer, and a neon pulse on click. Only for a mouse or
// trackpad, never under reduced motion; the native cursor is hidden only once this is running.
export function NeonCursor() {
  const dot = useRef(null);
  const reticle = useRef(null);
  const pulses = useRef(null);

  useEffect(() => {
    if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    document.documentElement.classList.add('neon-cursor');

    const p = { x: innerWidth / 2, y: innerHeight / 2 };
    const r = { x: p.x, y: p.y, w: IDLE, h: IDLE };
    let target = null;
    let frame = 0; // 0 while the loop is asleep
    let shown = false;

    const onMove = (e) => {
      p.x = e.clientX;
      p.y = e.clientY;
      dot.current.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
      if (!shown) {
        shown = true;
        Object.assign(r, { x: p.x, y: p.y });
        dot.current.style.opacity = reticle.current.style.opacity = '1';
      }
      target = e.target.closest?.('[data-cursor-box]') ?? e.target.closest?.(INTERACTIVE) ?? null;
      wake();
    };

    const tick = () => {
      // Locked on: follow the element's box (it may move while scrolling). Free: a small square on the pointer.
      let goal = { x: p.x, y: p.y, w: IDLE, h: IDLE };
      if (target?.isConnected) {
        const b = target.getBoundingClientRect();
        goal = { x: b.left + b.width / 2, y: b.top + b.height / 2, w: b.width + PAD * 2, h: b.height + PAD * 2 };
      }
      const k = 0.5; // how quickly the brackets catch up: a slight trail, not a lag
      r.x += (goal.x - r.x) * k;
      r.y += (goal.y - r.y) * k;
      r.w += (goal.w - r.w) * k;
      r.h += (goal.h - r.h) * k;
      const s = reticle.current.style;
      s.transform = `translate3d(${r.x - r.w / 2}px, ${r.y - r.h / 2}px, 0)`;
      s.width = `${r.w}px`;
      s.height = `${r.h}px`;
      const locked = target ? 'true' : 'false';
      if (reticle.current.dataset.locked !== locked) reticle.current.dataset.locked = locked;
      // Sleep once the brackets have caught up, so an idle pointer costs nothing; movement or scrolling wakes it.
      const settled = Math.abs(goal.x - r.x) + Math.abs(goal.y - r.y) + Math.abs(goal.w - r.w) + Math.abs(goal.h - r.h) < 0.5;
      frame = settled ? 0 : requestAnimationFrame(tick);
    };
    const wake = () => {
      if (!frame) frame = requestAnimationFrame(tick);
    };

    const onDown = (e) => {
      const ring = document.createElement('span');
      ring.className = 'neon-pulse';
      ring.style.left = `${e.clientX}px`;
      ring.style.top = `${e.clientY}px`;
      ring.addEventListener('animationend', () => ring.remove());
      pulses.current.append(ring);
    };
    const onLeave = () => {
      shown = false;
      dot.current.style.opacity = reticle.current.style.opacity = '0';
    };

    addEventListener('pointermove', onMove, { passive: true });
    addEventListener('scroll', wake, { passive: true, capture: true });
    addEventListener('pointerdown', onDown, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(frame);
      removeEventListener('pointermove', onMove);
      removeEventListener('scroll', wake, { capture: true });
      removeEventListener('pointerdown', onDown);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      document.documentElement.classList.remove('neon-cursor');
    };
  }, []);

  return (
    <div aria-hidden="true" className="neon-layer pointer-events-none fixed inset-0 z-[100] overflow-hidden">
      <div ref={pulses} />
      <div
        ref={reticle}
        data-locked="false"
        className="group absolute top-0 left-0 opacity-0 transition-opacity duration-200 will-change-transform"
      >
        {CORNERS.map((c) => (
          <span
            key={c}
            className={`absolute size-2.5 border-accent-ink drop-shadow-[0_0_4px_var(--color-accent)] transition-[width,height] duration-200 group-data-[locked=true]:size-3.5 ${c}`}
          />
        ))}
      </div>
      <div
        ref={dot}
        className="absolute -top-[3px] -left-[3px] size-1.5 rounded-full bg-accent-ink opacity-0 shadow-[0_0_8px_2px_var(--color-accent)] transition-opacity duration-200 will-change-transform"
      />
    </div>
  );
}
