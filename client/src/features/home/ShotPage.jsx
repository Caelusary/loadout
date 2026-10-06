import { Shadow } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useProduct } from '../catalog/queries.js';
import { MODEL_TILT } from './models/pose.js';
import { onCanvasCreated } from './models/glSetup.js';
import { BrightnessProbe, needsRim } from './models/brightness.js';
import { ProductModel } from './models/ProductModel.jsx';
import { StudioLighting } from './models/StudioLighting.jsx';

// Dev-only route used by `npm run shots` to render product photos from the same models the carousel uses.
// Transparent background, so the photos sit on either theme's plate colour.
// ?angle=0 three-quarter front, 1 side, 2 from above.
const ANGLES = [
  { rotation: [0, 0.25, 0], camera: [0, 0.35, 5.4] },
  { rotation: [0, 1.25, 0], camera: [0, 0.35, 5.4] },
  { rotation: [0.55, -0.35, 0], camera: [0, 0.35, 5.4] },
];

// Turn first, then tip toward the camera (three applies X after Y in local space), so a flat
// keyboard seen from the side is still tipped up instead of edge-on.
// The top-down angle tips flat gear toward the camera, but tipped that far a webcam stares at the
// ceiling, so webcams get a gentler tip and more of a turn.
const WEBCAM_ABOVE = [0.22, -0.55, 0];

function pose(product, angle) {
  let [x, y, z] = product.category === 'keyboard' && angle === ANGLES[0] ? [0, 0, 0] : angle.rotation;
  if (product.category === 'webcam' && angle === ANGLES[2]) [x, y, z] = WEBCAM_ABOVE;
  const tilt = product.modelUrl ? (MODEL_TILT[product.category] ?? 0) : 0;
  return [x + tilt, y, z];
}

function Ready() {
  const frames = useRef(0);
  useFrame(() => {
    frames.current += 1;
    if (frames.current === 12) window.__shotReady = true;
  });
  return null;
}

export default function ShotPage() {
  const [params] = useSearchParams();
  const { data: product } = useProduct(params.get('slug'));
  const angle = ANGLES[Number(params.get('angle')) || 0] ?? ANGLES[0];
  // Models stay hidden until their textures and shaders are ready, so frames only count after that.
  const [loaded, setLoaded] = useState(false);
  const markLoaded = useCallback(() => setLoaded(true), []);
  const [rim, setRim] = useState(true);
  const measured = useCallback((brightness) => {
    setRim(needsRim(brightness));
  }, []);
  // Photos need the reflections, so the model only mounts once the lighting's environment is in.
  const [lit, setLit] = useState(false);
  const markLit = useCallback(() => setLit(true), []);

  useEffect(() => {
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
  }, []);

  return (
    <div style={{ width: 800, height: 800 }}>
      {product && (
        <Canvas
          onCreated={onCanvasCreated}
          dpr={1}
          gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
          camera={{ position: angle.camera, fov: 30 }}
        >
          <StudioLighting onReady={markLit} rim={rim} />
          <group rotation={pose(product, angle)}>
            {lit && (
              <ProductModel product={product} fit={2.1} tilt={0} showStandIn={false} onLoaded={markLoaded} />
            )}
          </group>
          <Shadow
            position={[0, -1.2, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            scale={[2.6, 2.6, 1]}
            opacity={0.45}
            colorStop={0}
            color="#000000"
            fog={false}
          />
          <BrightnessProbe active={loaded} onMeasure={measured} />
          {loaded && <Ready />}
        </Canvas>
      )}
    </div>
  );
}
