import { ArrowsIn, Cube, ImageSquare, Minus, Plus } from '@phosphor-icons/react';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { ProductImage } from '../../components/ui/ProductImage.jsx';
import { assetUrl } from '../../lib/api.js';
import { ThreeGuard } from '../home/models/ThreeGuard.jsx';
import { usePerformance } from '../../providers/PerformanceProvider.jsx';
import { canRender3D } from '../home/capabilities.js';

const loadViewer = () => import('../home/ModelViewer.jsx');
const ModelViewer = lazy(loadViewer);

// Fetches the 3D viewer's code and this product's model ahead of the switch, so opening 3D only has to draw it.
// Download only, once per model; the browser cache hands the file to the viewer.
const warmed = new Set();
function warm3D(product) {
  loadViewer().catch(() => {});
  const url = product.modelUrl && assetUrl(product.modelUrl);
  if (!url || warmed.has(url)) return;
  warmed.add(url);
  fetch(url, { priority: 'low' }).catch(() => warmed.delete(url));
}

// The product's photos with click-to-zoom and pan, and its 3D model when the device can show one.
const ZOOM_STEPS = [1, 2, 3];
const MIN = ZOOM_STEPS[0];
const MAX = ZOOM_STEPS.at(-1);
const CLICK_SLOP = 5; // px a press can move and still count as a click (more is a pan)

// Click zoom: a click zooms one step into the spot clicked, + and - step around the last spot (or the
// centre), the mouse wheel zooms smoothly toward the pointer, and a zoomed photo pans by dragging. The photo
// always covers its frame, so panning stops at the edges. Switching photos remounts this (keyed by URL), which
// resets the zoom.
function ZoomablePhoto({ image, onZoom }) {
  const frame = useRef(null);
  const press = useRef(null);
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 }); // x, y: top-left offset in px
  const [focus, setFocus] = useState(null); // last spot clicked, in frame px
  const [panning, setPanning] = useState(false);
  const [wheeling, setWheeling] = useState(false); // the wheel moves in small steps, so no easing between them
  const { scale } = view;

  const size = () => {
    const r = frame.current.getBoundingClientRect();
    return [r.width, r.height];
  };
  const clamp = (x, y, s) => {
    const [w, h] = size();
    return [Math.min(0, Math.max(w * (1 - s), x)), Math.min(0, Math.max(h * (1 - s), y))];
  };
  // Keeps the photo point under (px, py) in place while the scale changes.
  const scaled = (v, target, px, py) => {
    const s = Math.min(MAX, Math.max(MIN, target));
    const [x, y] = clamp(px - ((px - v.x) / v.scale) * s, py - ((py - v.y) / v.scale) * s, s);
    return { scale: s, x, y };
  };
  const zoomTo = (target, px, py) => setView((v) => scaled(v, target, px, py));
  // The + and - buttons and clicks go to the next whole step (1×, 2×, 3×) from wherever the wheel left it.
  const stepUp = () => ZOOM_STEPS.find((z) => z > scale + 0.01) ?? MAX;
  const stepDown = () => ZOOM_STEPS.findLast((z) => z < scale - 0.01) ?? MIN;

  // The wheel zooms toward the pointer: up zooms in, down zooms out, stopping at 1× and 3×. (The gallery keeps the
  // page from scrolling while the pointer is on the viewer.) Attached by hand, like the gallery's, because React's
  // wheel listener can't cancel scrolling.
  const latest = useRef({ view, onZoom });
  useEffect(() => {
    latest.current = { view, onZoom };
  });
  useEffect(() => {
    const el = frame.current;
    let idle = 0;
    const onWheel = (e) => {
      const v = latest.current.view;
      const zoomingIn = e.deltaY < 0;
      if ((zoomingIn && v.scale >= MAX) || (!zoomingIn && v.scale <= MIN)) return;
      const r = el.getBoundingClientRect();
      const px = e.clientX - r.left;
      const py = e.clientY - r.top;
      // Trackpads send many small deltas, mice a few big ones; both come out about the same per gesture.
      const factor = Math.exp(-Math.max(-100, Math.min(100, e.deltaY)) * 0.0025);
      setView((cur) => scaled(cur, cur.scale * factor, px, py));
      setFocus([px, py]);
      setWheeling(true);
      clearTimeout(idle);
      idle = setTimeout(() => setWheeling(false), 150);
      latest.current.onZoom?.();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      clearTimeout(idle);
      el.removeEventListener('wheel', onWheel);
    };
    // clamp/scaled only read the frame's size, which they measure each time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const aim = () => {
    const [w, h] = size();
    return focus ?? [w / 2, h / 2];
  };

  return (
    <div className="relative size-full">
      <div
        ref={frame}
        className={`size-full overflow-hidden select-none ${scale > 1 ? (panning ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-zoom-in'}`}
        // Unzoomed, a vertical swipe still scrolls the page; zoomed, drags pan the photo instead.
        style={{ touchAction: scale > 1 ? 'none' : 'pan-y' }}
        onPointerDown={(e) => {
          if (e.button > 0) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          press.current = {
            id: e.pointerId,
            startX: e.clientX,
            startY: e.clientY,
            x: view.x,
            y: view.y,
            moved: false,
          };
        }}
        onPointerMove={(e) => {
          const p = press.current;
          if (!p || p.id !== e.pointerId) return;
          const dx = e.clientX - p.startX;
          const dy = e.clientY - p.startY;
          if (!p.moved && Math.hypot(dx, dy) < CLICK_SLOP) return;
          p.moved = true;
          if (scale === 1) return;
          setPanning(true);
          const [x, y] = clamp(p.x + dx, p.y + dy, scale);
          setView((v) => ({ ...v, x, y }));
        }}
        onPointerUp={(e) => {
          const p = press.current;
          press.current = null;
          setPanning(false);
          if (!p || p.moved) return;
          const r = e.currentTarget.getBoundingClientRect();
          const spot = [e.clientX - r.left, e.clientY - r.top];
          setFocus(spot);
          if (scale < MAX) zoomTo(stepUp(), ...spot);
        }}
        onPointerCancel={() => {
          press.current = null;
          setPanning(false);
        }}
        // Otherwise the browser starts dragging the image itself and cancels the pan.
        onDragStart={(e) => e.preventDefault()}
      >
        <ProductImage
          src={image?.url}
          alt={image?.alt}
          eager
          className="size-full"
          style={{
            transform: `translate(${view.x}px, ${view.y}px) scale(${scale})`,
            transformOrigin: '0 0',
            transition: panning || wheeling ? 'opacity 300ms' : 'transform 220ms ease-out, opacity 300ms',
          }}
        />
      </div>
      <div className="absolute right-3 bottom-3 flex items-center gap-1 rounded-control border border-seam bg-plate/90 p-1 backdrop-blur-sm">
        {scale > 1 && (
          <button
            type="button"
            onClick={() => {
              setView({ scale: 1, x: 0, y: 0 });
              setFocus(null);
            }}
            aria-label="Reset zoom"
            className="grid size-9 place-items-center rounded-[4px] text-ink-2 hover:bg-raised hover:text-ink"
          >
            <ArrowsIn size={16} />
          </button>
        )}
        <button
          type="button"
          onClick={() => zoomTo(stepDown(), ...aim())}
          disabled={scale <= MIN}
          aria-label="Zoom out"
          className="grid size-9 place-items-center rounded-[4px] text-ink-2 hover:bg-raised hover:text-ink disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <Minus size={16} weight="bold" />
        </button>
        <span className="w-7 text-center font-mono text-[12px] text-ink-2 tabular-nums" aria-live="polite">
          {Number.isInteger(Math.round(scale * 10) / 10) ? Math.round(scale) : scale.toFixed(1)}×
        </span>
        <button
          type="button"
          onClick={() => zoomTo(stepUp(), ...aim())}
          disabled={scale >= MAX}
          aria-label="Zoom in"
          className="grid size-9 place-items-center rounded-[4px] text-ink-2 hover:bg-raised hover:text-ink disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <Plus size={16} weight="bold" />
        </button>
      </div>
    </div>
  );
}

export function Gallery({ product }) {
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState('photo');
  // With the pointer on the viewer the wheel belongs to it (zooming the photo or the model), never the page; the
  // page scrolls again once the pointer leaves. Non-passive, so it can cancel the scroll.
  const stage = useRef(null);
  useEffect(() => {
    const el = stage.current;
    const stop = (e) => e.preventDefault();
    el.addEventListener('wheel', stop, { passive: false });
    return () => el.removeEventListener('wheel', stop);
  }, []);
  // Each view's hint shows until it's first used (the 3D one says something different, so it gets its own turn).
  const [used, setUsed] = useState({ photo: false, '3d': false });
  const images = product.images ?? [];
  const current = images[index] ?? images[0];
  // Performance mode keeps the product to photos: no 3D view button, and an open 3D view closes.
  const performanceMode = usePerformance().on;
  // A 3D view that breaks on this device (an error, or the GPU dropping the context) goes back to the photo and the
  // 3D button goes away for this visit, rather than the page crashing.
  const [failed3D, setFailed3D] = useState(false);
  const threeD = canRender3D() && !performanceMode && !failed3D;
  const showing3D = threeD && mode === '3d';
  // The photo stays up under the 3D view until the model is drawn, then fades out: no blank frame in between.
  const [modelReady, setModelReady] = useState(false);
  // With a mouse and room to spare (not data saver), the 3D view gets ready once the page has settled. Phones wait
  // for a touch on the 3D button instead, so a shopper who only looks at photos doesn't pay for the model.
  useEffect(() => {
    if (!threeD || navigator.connection?.saveData || !matchMedia('(pointer: fine)').matches) return;
    const idle = window.requestIdleCallback ?? ((fn) => setTimeout(fn, 1500));
    const cancel = window.cancelIdleCallback ?? clearTimeout;
    const id = idle(() => warm3D(product), { timeout: 4000 });
    return () => cancel(id);
  }, [threeD, product]);

  const hinted = used[showing3D ? '3d' : 'photo'];
  // Switching view isn't using it, so the Photo / 3D buttons don't count.
  const markUsed = (e) => {
    if (e.target.closest?.('[aria-label="View"]') || hinted) return;
    setUsed((u) => ({ ...u, [showing3D ? '3d' : 'photo']: true }));
  };
  const hint = showing3D
    ? 'Drag to turn it around · scroll to zoom'
    : matchMedia('(hover: hover)').matches
      ? 'Click or scroll to zoom · drag to look around'
      : 'Tap to zoom · drag to look around';

  return (
    // The photo, thumbnails and note share one width, so their edges line up. The square is never taller than about
    // 70% of the screen, so a landscape phone still shows the price and Buy.
    <div className="mx-auto flex w-full max-w-[70svh] flex-col gap-3">
      {/* The viewer's own controls sit on it: Photo / 3D view top-left, zoom bottom-right, and a how-to hint
          bottom-left that fades away after the first zoom, drag or spin. */}
      <div
        ref={stage}
        className="relative aspect-square w-full overflow-hidden rounded-panel bg-plate"
        onPointerDownCapture={markUsed}
        // Zooming the model counts as using the 3D view (the photo reports its own wheel zoom).
        onWheel={() => showing3D && !used['3d'] && setUsed((u) => ({ ...u, '3d': true }))}
      >
        {showing3D ? (
          <>
            <ProductImage
              src={current?.url}
              alt=""
              eager
              className={`pointer-events-none absolute inset-0 size-full transition-opacity duration-300 ${modelReady ? 'opacity-0' : 'opacity-100'}`}
            />
            <ThreeGuard onFail={() => setFailed3D(true)}>
              <Suspense fallback={null}>
                <ModelViewer
                  product={product}
                  onReady={() => setModelReady(true)}
                  onLost={() => setFailed3D(true)}
                />
              </Suspense>
            </ThreeGuard>
          </>
        ) : (
          <ZoomablePhoto
            key={current?.url}
            image={current}
            onZoom={() => !used.photo && setUsed((u) => ({ ...u, photo: true }))}
          />
        )}
        {threeD && (
          <div
            className="absolute top-3 left-3 inline-flex rounded-control border border-seam bg-plate/90 p-0.5 backdrop-blur-sm"
            role="group"
            aria-label="View"
          >
            {[
              ['photo', 'Photo', ImageSquare],
              ['3d', '3D view', Cube],
            ].map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                aria-pressed={mode === value}
                onClick={() => {
                  if (value === '3d' && mode !== '3d') setModelReady(false); // a fresh viewer draws again
                  setMode(value);
                }}
                // Intent to open 3D (resting on it, touching it, tabbing to it) starts loading it.
                onPointerEnter={value === '3d' ? () => warm3D(product) : undefined}
                onTouchStart={value === '3d' ? () => warm3D(product) : undefined}
                onFocus={value === '3d' ? () => warm3D(product) : undefined}
                className="flex h-9 items-center gap-1.5 rounded-[4px] px-3 text-[13px] text-ink-2 transition-colors aria-pressed:bg-raised aria-pressed:text-ink"
              >
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>
        )}
        <p
          aria-hidden={hinted}
          className={`pointer-events-none absolute bottom-3 left-3 flex h-11 items-center rounded-control border border-seam bg-plate/90 px-3 text-[12px] text-ink-3 backdrop-blur-sm transition-opacity duration-500 motion-reduce:transition-none ${hinted ? 'opacity-0' : 'opacity-100'}`}
        >
          {hint}
        </p>
      </div>
      {images.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          {images.map((img, i) => (
            <button
              key={img.url}
              type="button"
              onClick={() => {
                setIndex(i);
                setMode('photo');
              }}
              aria-label={`Show ${img.alt || `image ${i + 1}`}`}
              aria-current={!showing3D && i === index}
              className="overflow-hidden rounded-control ring-offset-2 ring-offset-bg aria-[current=true]:ring-2 aria-[current=true]:ring-accent-ink"
            >
              <ProductImage src={img.url} className="size-16" size={160} />
            </button>
          ))}
        </div>
      )}
      <p className="text-[12px] text-ink-3">Photos are rendered from the product model.</p>
    </div>
  );
}
