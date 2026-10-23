import { Shadow, OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useCallback, useEffect, useState } from 'react';
import { useReducedMotion } from './capabilities.js';
import { watchContext } from './models/glSetup.js';
import { BrightnessProbe, needsRim } from './models/brightness.js';
import { ProductModel } from './models/ProductModel.jsx';
import { StudioLighting } from './models/StudioLighting.jsx';
import { Warmup } from './models/Warmup.jsx';

// Product page "3D view": one model the shopper can turn around.
// `onReady` fires once the model is loaded and drawing, so whatever stood in for it (the product photo) can go;
// `onLost` if the GPU drops the 3D context, so the page can go back to the photo.
export default function ModelViewer({ product, onReady, onLost }) {
  const reducedMotion = useReducedMotion();
  // Hold frames until shaders have compiled off the main thread, so opening the 3D view doesn't stall.
  const [warm, setWarm] = useState(false);
  // The model waits for the lighting, so it compiles once against the finished environment.
  const [lit, setLit] = useState(false);
  const markLit = useCallback(() => setLit(true), []);
  // Same rule as the photos (ShotPage), so the 3D view matches them.
  const [rim, setRim] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const markLoaded = useCallback(() => setLoaded(true), []);
  const measured = useCallback((brightness) => setRim(needsRim(brightness)), []);
  useEffect(() => {
    if (loaded && warm) onReady?.();
  }, [loaded, warm, onReady]);
  return (
    <Canvas
      onCreated={watchContext(onLost)}
      frameloop={warm ? 'always' : 'never'}
      className="cursor-grab active:cursor-grabbing"
      // Capped at 1.5: on a high-DPI laptop 2x quadruples the GPU memory for little visible gain.
      dpr={[1, 1.5]}
      gl={{ alpha: true, antialias: true }}
      camera={{ position: [0, 0.4, 5.2], fov: 30 }}
    >
      <StudioLighting onReady={markLit} rim={rim} />
      {/* No procedural stand-in while a .glb loads, so the real model never pops in over a fake one. */}
      {lit && <ProductModel product={product} fit={2} showStandIn={false} onLoaded={markLoaded} />}
      <Shadow
        position={[0, -1.15, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[2.6, 2.6, 1]}
        opacity={0.5}
        colorStop={0}
        color="#000000"
        fog={false}
      />
      <BrightnessProbe active={loaded} onMeasure={measured} />
      <Warmup onDone={setWarm} />
      <OrbitControls
        enablePan={false}
        // The wheel zooms in up to about twice as close; the camera starts at its farthest.
        enableZoom
        zoomSpeed={1.6}
        minDistance={2.6}
        maxDistance={5.25}
        autoRotate={!reducedMotion}
        autoRotateSpeed={0.8}
        minPolarAngle={Math.PI / 4}
        maxPolarAngle={Math.PI / 1.8}
      />
    </Canvas>
  );
}
