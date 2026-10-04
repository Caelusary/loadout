import { Shadow, useGLTF } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { easing } from 'maath';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { assetUrl } from '../../lib/api.js';
import { onCanvasCreated } from './models/glSetup.js';
import { ProductModel } from './models/ProductModel.jsx';
import { StudioLighting } from './models/StudioLighting.jsx';
import { CATEGORY_MODELS, categoryModel } from './categoryModels.js';

const SWAY = 0.55; // rad either side of facing forward
const SWAY_SPEED = 0.45;

// Share of the visible stage (at the model's depth) that every model is fitted into. Kept a little short
// and lifted, because near edges render larger in perspective and the stage's button row sits at the bottom.
const FILL = { wide: [0.64, 0.54], compact: [0.78, 0.66] };
const LIFT = 0.07; // share of stage height

function CategoryItem({ category, active, box, lift, reducedMotion, spinRef, onLoaded }) {
  const group = useRef(null);
  const turntable = useRef(null);
  const stand = useMemo(() => categoryModel(category), [category]);
  const { fill } = CATEGORY_MODELS[category];
  const fitBox = useMemo(() => [box[0] * fill, box[1] * fill], [box, fill]);
  // The model on stage when the scene opens starts at full size; only later switches grow in.
  const [startsOnStage] = useState(active);

  useFrame((_, delta) => {
    const g = group.current;
    const target = active ? 1 : 0.001;
    // The outgoing model clears out faster than the next one grows, so they don't overlap mid-swap.
    easing.damp3(g.scale, [target, target, target], reducedMotion ? 0.001 : active ? 0.2 : 0.07, delta);
    easing.damp(g.position, 'y', active ? lift : lift - 0.6, 0.2, delta);
    g.visible = g.scale.x > 0.01;
    if (!active || !g.visible) return;

    // The sway has its own clock that stops while the model is held, so a drag moves only what the pointer
    // moves, and on release the model keeps the angle it was left at and sways on from there.
    const s = spinRef.current;
    if (!s.dragging && !reducedMotion) s.phase += delta * SWAY_SPEED;
    const sway = reducedMotion ? 0 : Math.sin(s.phase) * SWAY;
    easing.damp(turntable.current.rotation, 'y', sway + s.offset, s.dragging ? 0.05 : 0.12, delta);
  });

  return (
    <group ref={group} scale={startsOnStage ? 1 : 0.001} position-y={startsOnStage ? lift : lift - 0.6}>
      <group ref={turntable}>
        <ProductModel product={stand} box={fitBox} showStandIn={false} onLoaded={onLoaded} />
      </group>
    </group>
  );
}

const ORDER = Object.keys(CATEGORY_MODELS);

function Stage({ active, compact, reducedMotion, spinRef, onActiveLoaded }) {
  // Only the selected category's model loads at first; the rest follow one at a time when the page is
  // idle, so their parsing and uploads never land together. Picking a tile loads its model right away.
  const [mounted, setMounted] = useState(() => [active]);
  if (!mounted.includes(active)) setMounted([...mounted, active]);
  const [loaded, setLoaded] = useState(() => new Set());
  const markLoaded = useMemo(
    () =>
      Object.fromEntries(ORDER.map((c) => [c, () => setLoaded((s) => (s.has(c) ? s : new Set(s).add(c)))])),
    [],
  );
  const activeLoaded = loaded.has(active);
  useEffect(() => {
    if (activeLoaded) onActiveLoaded(active);
  }, [active, activeLoaded, onActiveLoaded]);
  useEffect(() => {
    const next = ORDER.find((c) => !mounted.includes(c));
    // Wait until everything mounted so far has finished loading, then take the next one when idle.
    if (!next || mounted.some((c) => !loaded.has(c))) return;
    const add = () => setMounted((m) => (m.includes(next) ? m : [...m, next]));
    if (!window.requestIdleCallback) {
      const id = setTimeout(add, 600);
      return () => clearTimeout(id);
    }
    const id = requestIdleCallback(add, { timeout: 4000 });
    return () => cancelIdleCallback(id);
  }, [mounted, loaded]);

  const { viewport } = useThree();
  const [fw, fh] = compact ? FILL.compact : FILL.wide;
  const w = viewport.width * fw;
  const h = viewport.height * fh;
  // Rounded so small viewport jitter doesn't re-measure every model.
  const box = useMemo(() => [Math.round(w * 20) / 20, Math.round(h * 20) / 20], [w, h]);
  const lift = viewport.height * LIFT;
  return (
    <>
      {mounted.map((c) => (
        <CategoryItem
          key={c}
          category={c}
          active={c === active}
          box={box}
          lift={lift}
          reducedMotion={reducedMotion}
          spinRef={spinRef}
          onLoaded={markLoaded[c]}
        />
      ))}
      <Shadow
        position={[0, lift - box[1] / 2 - 0.15, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[box[0] * 0.8, box[0] * 0.5, 1]}
        opacity={0.35}
        colorStop={0}
        color="#000000"
      />
    </>
  );
}

// Tells the hero a category's model is on screen, a couple of frames after it loaded, so the photo
// underneath only fades once the model has actually been drawn.
function ReadyAfterFrames({ category, onReady }) {
  const frames = useRef(0);
  useFrame(() => {
    frames.current += 1;
    if (frames.current === 2) onReady(category);
  });
  return null;
}

export default function CategoryScene({ active, compact, reducedMotion, running, spinRef, onReady }) {
  const [loadedFor, setLoadedFor] = useState(null);
  // Models wait for the lighting, so they compile once against the finished environment.
  const [lit, setLit] = useState(false);
  const markLit = useCallback(() => setLit(true), []);
  // Start downloading the first model now, while the lighting's shaders compile.
  const [firstUrl] = useState(() => categoryModel(active).modelUrl);
  useEffect(() => {
    if (firstUrl) useGLTF.preload(assetUrl(firstUrl), false, true);
  }, [firstUrl]);
  return (
    <Canvas
      onCreated={onCanvasCreated}
      className="!absolute inset-0"
      frameloop={running ? 'always' : 'never'}
      dpr={[1, 1.75]}
      gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
      camera={{ position: [0, 0.2, 6], fov: 30 }}
      aria-hidden="true"
    >
      <StudioLighting onReady={markLit} />
      {lit && (
        <Stage
          active={active}
          compact={compact}
          reducedMotion={reducedMotion}
          spinRef={spinRef}
          onActiveLoaded={setLoadedFor}
        />
      )}
      {loadedFor && <ReadyAfterFrames key={loadedFor} category={loadedFor} onReady={onReady} />}
    </Canvas>
  );
}
