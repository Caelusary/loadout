import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import { SRGBColorSpace, WebGLRenderTarget } from 'three';

const SIZE = 48;

// How light the model actually looks, from 0 to 1: renders the scene once into a small offscreen
// target and averages the opaque pixels (the soft shadow is mostly transparent, so it doesn't count).
// Measuring the render rather than the materials copes with texture atlases, vertex colours and metals.
function measure(gl, scene, camera) {
  const target = new WebGLRenderTarget(SIZE, SIZE);
  target.texture.colorSpace = SRGBColorSpace;
  const previous = gl.getRenderTarget();
  const clearAlpha = gl.getClearAlpha();
  gl.setRenderTarget(target);
  gl.setClearAlpha(0);
  gl.clear();
  gl.render(scene, camera);
  const pixels = new Uint8Array(SIZE * SIZE * 4);
  gl.readRenderTargetPixels(target, 0, 0, SIZE, SIZE, pixels);
  gl.setRenderTarget(previous);
  gl.setClearAlpha(clearAlpha);
  target.dispose();
  let sum = 0;
  let count = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 230) continue;
    sum += (0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2]) / 255;
    count += 1;
  }
  return count ? sum / count : 0;
}

// Measures a few frames after `active` turns true (once the model is visible) and reports it once.
export function BrightnessProbe({ active, onMeasure }) {
  const { gl, scene, camera } = useThree();
  const frames = useRef(0);
  const done = useRef(false);
  useFrame(() => {
    if (!active || done.current) return;
    frames.current += 1;
    if (frames.current < 3) return;
    done.current = true;
    onMeasure(measure(gl, scene, camera));
  });
  return null;
}

// Dark models get the white rim light so they don't vanish into the dark product cards; light ones
// already stand out and keep the plain neon look. Measured with the rim on, the way it starts.
const RIM_CUTOFF = 0.45;
export const needsRim = (brightness) => brightness < RIM_CUTOFF;
