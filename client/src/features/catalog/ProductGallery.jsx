import { ArrowsIn, Cube, ImageSquare, Minus, Plus } from '@phosphor-icons/react';
import { lazy, Suspense, useRef, useState } from 'react';
import { Skeleton } from '../../components/ui/feedback.jsx';
import { ProductImage } from '../../components/ui/ProductImage.jsx';
import { usePerformance } from '../../providers/PerformanceProvider.jsx';
import { canRender3D } from '../home/capabilities.js';

const ModelViewer = lazy(() => import('../home/ModelViewer.jsx'));

// The product's photos with click-to-zoom and pan, and its 3D model when the device can show one.
const ZOOM_STEPS = [1, 2, 3];
const CLICK_SLOP = 5; // px a press can move and still count as a click (more is a pan)

// Click zoom: a click zooms one step into the spot clicked, + and - step around the last spot (or the
// centre), and a zoomed photo pans by dragging. The photo always covers its frame, so panning stops at
// the edges. Switching photos remounts this (keyed by URL), which resets the zoom.
function ZoomablePhoto({ image }) {
  const frame = useRef(null);
  const press = useRef(null);
  const [view, setView] = useState({ step: 0, x: 0, y: 0 }); // x, y: top-left offset in px
  const [focus, setFocus] = useState(null); // last spot clicked, in frame px
  const [panning, setPanning] = useState(false);
  const scale = ZOOM_STEPS[view.step];

  const size = () => {
    const r = frame.current.getBoundingClientRect();
    return [r.width, r.height];
  };
  const clamp = (x, y, s) => {
    const [w, h] = size();
    return [Math.min(0, Math.max(w * (1 - s), x)), Math.min(0, Math.max(h * (1 - s), y))];
  };
  // Keeps the photo point under (px, py) in place while the scale changes.
  const zoomTo = (step, px, py) => {
    const next = Math.max(0, Math.min(ZOOM_STEPS.length - 1, step));
    const s = ZOOM_STEPS[next];
    const ux = (px - view.x) / scale;
    const uy = (py - view.y) / scale;
    const [x, y] = clamp(px - ux * s, py - uy * s, s);
    setView({ step: next, x, y });
  };
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
          if (view.step < ZOOM_STEPS.length - 1) zoomTo(view.step + 1, ...spot);
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
            transition: panning ? 'opacity 300ms' : 'transform 220ms ease-out, opacity 300ms',
          }}
        />
      </div>
      <div className="absolute right-3 bottom-3 flex items-center gap-1 rounded-control border border-seam bg-plate/90 p-1 backdrop-blur-sm">
        {scale > 1 && (
          <button
            type="button"
            onClick={() => {
              setView({ step: 0, x: 0, y: 0 });
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
          onClick={() => zoomTo(view.step - 1, ...aim())}
          disabled={view.step === 0}
          aria-label="Zoom out"
          className="grid size-9 place-items-center rounded-[4px] text-ink-2 hover:bg-raised hover:text-ink disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <Minus size={16} weight="bold" />
        </button>
        <span className="w-7 text-center font-mono text-[12px] text-ink-2 tabular-nums" aria-live="polite">
          {scale}×
        </span>
        <button
          type="button"
          onClick={() => zoomTo(view.step + 1, ...aim())}
          disabled={view.step === ZOOM_STEPS.length - 1}
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
  const images = product.images ?? [];
  const current = images[index] ?? images[0];
  // Performance mode keeps the product to photos: no 3D view button, and an open 3D view closes.
  const performanceMode = usePerformance().on;
  const threeD = canRender3D() && !performanceMode;
  const showing3D = threeD && mode === '3d';

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-square overflow-hidden rounded-panel bg-plate">
        {showing3D ? (
          <Suspense fallback={<Skeleton className="size-full rounded-none" />}>
            <ModelViewer product={product} />
          </Suspense>
        ) : (
          <ZoomablePhoto key={current?.url} image={current} />
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {images.length > 1 &&
          images.map((img, i) => (
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
        {threeD && (
          <div
            className="ml-auto inline-flex rounded-control border border-seam p-0.5"
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
                onClick={() => setMode(value)}
                className="flex h-9 items-center gap-1.5 rounded-[4px] px-3 text-[13px] text-ink-2 transition-colors aria-pressed:bg-raised aria-pressed:text-ink"
              >
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="text-[13px] text-ink-3">
        {showing3D
          ? 'Drag to turn it around.'
          : `${matchMedia('(hover: hover)').matches ? 'Click' : 'Tap'} a spot to zoom in, drag to look around. Photos are rendered from the product model.`}
      </p>
    </div>
  );
}
