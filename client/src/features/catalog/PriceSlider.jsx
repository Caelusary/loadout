import { useEffect, useRef, useState } from 'react';

// The track covers the whole catalogue; the top handle at the end means "no maximum". A typed price can go past
// the track's end (the handle just stays there).
const TOP = 10000;
const STEP = 250;

const parse = (v) =>
  /^\d+$/.test(
    String(v ?? '')
      .replaceAll(',', '')
      .trim(),
  )
    ? Number(String(v).replaceAll(',', '').trim())
    : null;
const fmt = (n) => (n == null ? '' : n.toLocaleString('en-PH'));
const pct = (n) => (Math.min(n, TOP) / TOP) * 100;

// The handles are drawn from state; the range inputs underneath only take keyboard and screen-reader input.
// Pointer input goes through the track: pressing a handle grabs it where you pressed and it follows the pointer
// smoothly, then settles on the nearest ₱250 when let go; pressing anywhere else glides the nearest handle there
// and keeps dragging from that spot.
const RANGE = 'pointer-events-none absolute inset-0 h-full w-full appearance-none bg-transparent opacity-0';

function PriceBox({ value, placeholder, label, onCommit }) {
  const [text, setText] = useState(fmt(value));
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setText(fmt(value));
  }
  const commit = () => {
    const n = parse(text);
    if (text.trim() !== '' && n == null) return setText(fmt(value)); // not a number: put the last good value back
    onCommit(n);
  };
  return (
    <label className="flex h-7 w-[5.5rem] shrink-0 items-center gap-1 rounded-[6px] border border-edge bg-bg px-2 focus-within:border-accent-ink">
      <span className="text-[12px] text-ink-3">₱</span>
      <input
        value={text}
        // Digits only (commas allowed, since the box shows 1,000); anything else typed or pasted is dropped.
        onChange={(e) => setText(e.target.value.replace(/[^\d,]/g, ''))}
        spellCheck={false}
        autoComplete="off"
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        inputMode="numeric"
        placeholder={placeholder}
        aria-label={label}
        className="w-full min-w-0 bg-transparent font-mono text-[12px] tabular-nums outline-none placeholder:font-sans placeholder:text-ink-3"
      />
    </label>
  );
}

// Min box, slider, max box, side by side next to Sort. Typing applies on Enter or leaving the box; the slider
// applies once the handles stop moving, so dragging doesn't fire a request per step.
export function PriceSlider({ min = '', max = '', onChange }) {
  const [lo, setLo] = useState(parse(min) ?? 0);
  const [hi, setHi] = useState(parse(max)); // null = no maximum
  // Follows the address bar when it changes from outside (Clear filters, Back), without resetting a drag.
  const [seen, setSeen] = useState(`${min}-${max}`);
  if (seen !== `${min}-${max}`) {
    setSeen(`${min}-${max}`);
    setLo(parse(min) ?? 0);
    setHi(parse(max));
  }
  const timer = useRef(0);
  const rail = useRef(null);
  const grab = useRef(null); // { which, offset } while a handle is held
  const [drag, setDrag] = useState(null); // { which, at } — where the held handle is drawn, between steps
  useEffect(() => () => clearTimeout(timer.current), []);

  const apply = (nextLo, nextHi, wait = 400) => {
    clearTimeout(timer.current);
    const send = () => onChange(nextLo > 0 ? String(nextLo) : '', nextHi != null ? String(nextHi) : '');
    if (wait) timer.current = setTimeout(send, wait);
    else send();
  };

  const hiPos = hi ?? TOP;
  const setFromSlider = (which, raw) => {
    const v = Math.round(Math.min(Math.max(raw, 0), TOP) / STEP) * STEP;
    if (which === 'lo') {
      const next = Math.min(v, hiPos - STEP);
      setLo(next);
      apply(next, hi);
    } else {
      const next = Math.max(v, lo + STEP);
      const nextHi = next >= TOP ? null : next;
      setHi(nextHi);
      apply(lo, nextHi);
    }
  };

  const valueAt = (clientX) => {
    const r = rail.current.getBoundingClientRect();
    return ((clientX - r.left) / r.width) * TOP;
  };
  // Keeps the held handle on its own side of the other one.
  const bound = (which, v) =>
    which === 'lo' ? Math.min(Math.max(v, 0), hiPos - STEP) : Math.min(Math.max(v, lo + STEP), TOP);
  const moveTo = (which, v) => {
    setDrag({ which, at: bound(which, v) });
    setFromSlider(which, v);
  };
  const onPointerDown = (e) => {
    const v = valueAt(e.clientX);
    // The closer handle takes the press; on a tie (both at the same spot) the side you pressed toward wins.
    const dLo = Math.abs(v - Math.min(lo, TOP));
    const dHi = Math.abs(v - Math.min(hiPos, TOP));
    const which = dLo < dHi || (dLo === dHi && v < lo) ? 'lo' : 'hi';
    const at = which === 'lo' ? Math.min(lo, TOP) : Math.min(hiPos, TOP);
    // Pressed on the handle itself (within its radius plus a little): hold it where it was grabbed, no jump.
    const onHandle = (Math.abs(v - at) / TOP) * rail.current.getBoundingClientRect().width <= 12;
    grab.current = { which, offset: onHandle ? at - v : 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
    if (onHandle) setDrag({ which, at });
    else setFromSlider(which, v); // glides there (the transition is on while nothing is held)
  };
  const onPointerMove = (e) => {
    if (!grab.current) return;
    const { which, offset } = grab.current;
    moveTo(which, valueAt(e.clientX) + offset);
  };
  const onPointerUp = () => {
    grab.current = null;
    setDrag(null); // the handle settles on its step
  };
  const shown = (which, v) => (drag?.which === which ? drag.at : Math.min(v, TOP));
  const glide = drag ? '' : 'transition-[left,right] duration-150 ease-out motion-reduce:transition-none';

  const typedLo = (n) => {
    const next = Math.min(n ?? 0, hi ?? Infinity);
    setLo(next);
    apply(next, hi, 0);
  };
  const typedHi = (n) => {
    const next = n == null ? null : Math.max(n, lo);
    setHi(next);
    apply(lo, next, 0);
  };

  return (
    <div className="flex h-9 w-full items-center gap-2.5 rounded-control border border-seam bg-raised px-1.5 sm:w-auto">
      <PriceBox value={lo || null} placeholder="Min" label="Lowest price in pesos" onCommit={typedLo} />
      {/* The padding makes the whole of each handle grabbable, even at the ends where it overhangs the rail. */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onLostPointerCapture={onPointerUp}
        className={`-mx-1 h-7 min-w-24 flex-1 touch-none px-2 select-none sm:w-36 sm:flex-none ${drag ? 'cursor-grabbing' : 'cursor-pointer'}`}
      >
        <div ref={rail} className="relative h-full">
          <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-seam" />
          <div
            className={`absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-accent-ink ${glide}`}
            style={{ left: `${pct(shown('lo', lo))}%`, right: `${100 - pct(shown('hi', hiPos))}%` }}
          />
          {[
            ['lo', lo, 'Lowest price', `₱${fmt(lo)}`],
            ['hi', hiPos, 'Highest price', hi == null ? 'No maximum' : `₱${fmt(hi)}`],
          ].map(([which, v, label, text]) => (
            <div key={which}>
              <input
                type="range"
                min={0}
                max={TOP}
                step={STEP}
                value={Math.min(v, TOP)}
                onChange={(e) => setFromSlider(which, Number(e.target.value))}
                aria-label={label}
                aria-valuetext={text}
                className={`${RANGE} peer`}
              />
              <span
                aria-hidden="true"
                className={`pointer-events-none absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-accent-ink bg-plate peer-focus-visible:ring-2 peer-focus-visible:ring-accent-ink/50 ${glide} ${drag?.which === which ? 'scale-125 shadow-[0_0_10px_var(--color-accent-ink)]' : ''}`}
                style={{ left: `${pct(shown(which, v))}%` }}
              />
            </div>
          ))}
        </div>
      </div>
      <PriceBox value={hi} placeholder="Max" label="Highest price in pesos" onCommit={typedHi} />
    </div>
  );
}
