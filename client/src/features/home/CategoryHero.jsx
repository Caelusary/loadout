import { ArrowRight, HandGrabbing } from '@phosphor-icons/react';
import { ArcArrowLink } from '../../components/ui/ArcArrowLink.jsx';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Container } from '../../components/layout/Page.jsx';
import { ButtonLink } from '../../components/ui/Button.jsx';
import { CATEGORIES, CATEGORY_LABELS, PHOTO_VERSION } from '../../lib/constants.js';
import { usePerformance } from '../../providers/PerformanceProvider.jsx';
import { canRender3D, useActiveOnScreen, useMediaQuery, useReducedMotion } from './capabilities.js';
import { CATEGORY_MODELS } from './categoryModels.js';
import { HeroSearch } from './HeroSearch.jsx';

const CategoryScene = lazy(() => import('./CategoryScene.jsx'));

const DRAG_TO_RADIANS = 0.01;
const DRAG_SLOP = 6; // px of sideways movement before a press counts as a drag
const ENGAGED_KEY = 'loadout:stage-engaged';

// Whether the shopper has already met the stage this session, so coming back from another page
// doesn't bring the "Drag to turn" hint back. Storage can be unavailable (private windows); then the
// hint just shows again on the next visit.
const readEngaged = () => {
  try {
    return sessionStorage.getItem(ENGAGED_KEY) === '1';
  } catch {
    return false;
  }
};
const LEFT = CATEGORIES.slice(0, 3);
const RIGHT = CATEGORIES.slice(3);

// Clicking a tile puts its category on the stage; only the arrow goes to the shop.
function CategoryTile({ category, active, onSelect }) {
  const { icon: Icon, blurb } = CATEGORY_MODELS[category];
  const label = CATEGORY_LABELS[category];
  return (
    <div
      data-cursor-box
      data-active={active || undefined}
      className="group flex items-center rounded-panel border border-transparent transition-colors duration-150 hover:bg-raised data-active:border-seam data-active:bg-plate"
    >
      <button
        type="button"
        aria-pressed={active}
        onClick={() => onSelect(category)}
        className="flex min-h-[60px] min-w-0 flex-1 items-center gap-3 rounded-panel py-3 pl-4 text-left sm:min-h-[76px] sm:gap-3.5"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-control border border-b-[3px] border-seam bg-bg text-ink-2 transition-colors group-data-active:border-accent group-data-active:text-accent-ink">
          <Icon size={22} />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="wide truncate text-[15px] leading-tight font-bold sm:text-[17px]">{label}</span>
          <span className="truncate text-[13px] text-ink-3 max-sm:hidden">{blurb}</span>
        </span>
      </button>
      <ArcArrowLink
        to={`/shop?category=${category}`}
        label={`Shop ${label.toLowerCase()}`}
        className="mr-2.5 ml-1 group-data-active:text-accent-ink max-sm:size-9"
      />
    </div>
  );
}

export function CategoryHero() {
  // One selected category drives the stage and the search's starter chips; the tiles set it.
  const [active, setActive] = useState('keyboard');
  // Categories whose model has been drawn; until the selected one has, its photo shows instead.
  const [shown, setShown] = useState(() => new Set());
  const markShown = useCallback((c) => setShown((s) => (s.has(c) ? s : new Set(s).add(c))), []);
  const sceneReady = shown.has(active);
  // Start the 3D scene once the page is idle: three.js's environment setup blocks for most of a second,
  // and the product shot already stands in until the scene fades in.
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    if (window.requestIdleCallback) {
      const id = requestIdleCallback(() => setIdle(true), { timeout: 2000 });
      return () => cancelIdleCallback(id);
    }
    const id = setTimeout(() => setIdle(true), 400);
    return () => clearTimeout(id);
  }, []);
  const canThreeD = useMemo(() => canRender3D(), []);
  // Performance mode shows the category photo instead, so the 3D engine and models never load.
  const performanceMode = usePerformance().on;
  const threeD = canThreeD && !performanceMode;
  const reducedMotion = useReducedMotion();
  const compact = useMediaQuery('(max-width: 1023px)');
  const stage = useRef(null);
  const running = useActiveOnScreen(stage);
  const spinRef = useRef({ offset: 0, phase: 0, dragging: false });
  const drag = useRef(null);
  // Like a 360° post: the model sits dimmed under a "Drag to turn" hint until the first tap, drag, or
  // category pick. A vertical scroll that starts on the stage doesn't count (the browser cancels the pointer).
  const [engaged, setEngagedState] = useState(readEngaged);
  const engage = useCallback(() => {
    setEngagedState(true);
    try {
      sessionStorage.setItem(ENGAGED_KEY, '1');
    } catch {
      // not remembered; harmless
    }
  }, []);
  const endDrag = () => {
    drag.current = null;
    spinRef.current.dragging = false;
  };
  const pick = (c) => {
    setActive(c);
    engage();
  };
  const label = CATEGORY_LABELS[active];
  // Dimmed while the hint is up; full strength once the shopper has touched the stage.
  const dim = threeD && !engaged ? 'opacity-35' : 'opacity-100';

  const tile = (c) => <CategoryTile key={c} category={c} active={c === active} onSelect={pick} />;
  // Phones and tablets pick a category from a chip strip under the search, right above the starters it drives.
  const picker = (
    <ul
      aria-label="Categories"
      className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:scroll-px-6 sm:px-6 lg:hidden [&::-webkit-scrollbar]:hidden"
    >
      {CATEGORIES.map((c) => {
        const { icon: Icon } = CATEGORY_MODELS[c];
        const on = c === active;
        return (
          <li key={c} className="snap-start">
            <button
              type="button"
              aria-pressed={on}
              onClick={() => pick(c)}
              className={`flex h-11 items-center gap-2 rounded-full border px-4 text-[14px] font-medium whitespace-nowrap transition-colors ${
                on ? 'border-accent-ink bg-plate text-accent-ink' : 'border-seam text-ink-2 active:bg-raised'
              }`}
            >
              <Icon size={18} weight={on ? 'fill' : 'regular'} />
              {CATEGORY_LABELS[c]}
            </button>
          </li>
        );
      })}
    </ul>
  );

  return (
    <section aria-labelledby="hero-title" className="relative">
      <Container className="pt-8 sm:pt-12">
        <HeroSearch category={active} picker={picker} />
      </Container>

      <Container className="mt-4 grid sm:mt-8 gap-3 lg:grid-cols-[264px_minmax(0,1fr)_264px] lg:items-center">
        {/* Desktop flanks the stage with two columns of tiles; phones and tablets use the strip under the search. */}
        <ul aria-label="Categories" className="hidden grid-cols-1 gap-1.5 lg:order-1 lg:grid">
          {LEFT.map((c) => (
            <li key={c}>{tile(c)}</li>
          ))}
        </ul>
        <ul aria-label="More categories" className="hidden grid-cols-1 gap-1.5 lg:order-3 lg:grid">
          {RIGHT.map((c) => (
            <li key={c}>{tile(c)}</li>
          ))}
        </ul>

        <div
          ref={stage}
          onPointerDown={(e) => {
            if (e.button > 0 || e.target.closest('a, button')) return;
            // Capture, so letting go anywhere (over a tile, outside the window) still ends the drag.
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = { id: e.pointerId, x: e.clientX, startX: e.clientX };
            spinRef.current.dragging = true;
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d || d.id !== e.pointerId) return;
            // No button held means the release was missed (e.g. an alert or a switch of windows).
            if (e.pointerType === 'mouse' && e.buttons === 0) return endDrag();
            spinRef.current.offset += (e.clientX - d.x) * DRAG_TO_RADIANS;
            d.x = e.clientX;
            if (Math.abs(e.clientX - d.startX) > DRAG_SLOP) engage();
          }}
          onPointerUp={() => {
            // A tap or click counts too.
            if (drag.current) engage();
            endDrag();
          }}
          onPointerCancel={endDrag}
          onLostPointerCapture={endDrag}
          className="relative isolate order-1 h-[clamp(200px,29vh,260px)] sm:h-[clamp(260px,40vh,440px)] lg:h-[clamp(300px,48vh,500px)] touch-pan-y overflow-hidden select-none lg:order-2"
        >
          {/* Without 3D (no WebGL, or Performance mode) the stage shows the category's photo. With it, the
              stage stays empty until the model has drawn and then fades in at full size; a photo first
              would flash a smaller keyboard. */}
          {!threeD && (
            <img
              fetchPriority="high"
              src={`/products/${CATEGORY_MODELS[active].shot}.webp?v=${PHOTO_VERSION}`}
              alt=""
              draggable="false"
              className="absolute inset-[8%] m-auto size-[84%] object-contain"
            />
          )}
          {threeD && idle && (
            <div
              className={`absolute inset-0 transition-opacity duration-500 ease-out ${sceneReady ? dim : 'opacity-0'}`}
            >
              <Suspense fallback={null}>
                <CategoryScene
                  active={active}
                  compact={compact}
                  reducedMotion={reducedMotion}
                  running={running}
                  spinRef={spinRef}
                  onReady={markShown}
                />
              </Suspense>
            </div>
          )}

          {/* Mounted with the first model, so the hand's nudge plays while it's visible. */}
          {threeD && shown.size > 0 && (
            <div
              aria-hidden="true"
              className={`pointer-events-none absolute inset-0 grid place-items-center transition-opacity duration-500 ease-out starting:opacity-0 ${engaged ? 'opacity-0' : 'opacity-100'}`}
            >
              <span className="flex flex-col items-center gap-2.5">
                <span className="grid size-14 place-items-center rounded-full border border-edge bg-plate/80 text-ink">
                  <HandGrabbing size={26} className="animate-[nudge_1.8s_ease-in-out_3]" />
                </span>
                <span className="font-mono text-[13px] text-ink-2">Drag to turn</span>
              </span>
            </div>
          )}

          <div className="absolute inset-x-0 bottom-0 flex items-end justify-center gap-4 p-3 sm:p-4">
            <ButtonLink to="/loadout" variant="ghost" size="sm">
              Build a loadout
            </ButtonLink>
            <ButtonLink to={`/shop?category=${active}`} variant="secondary" size="sm">
              Shop {label.toLowerCase()}
              <ArrowRight size={15} />
            </ButtonLink>
          </div>
        </div>
      </Container>
    </section>
  );
}
