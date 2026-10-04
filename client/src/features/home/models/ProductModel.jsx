import { useGLTF } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { Component, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Box3, Vector3 } from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { assetUrl } from '../../../lib/api.js';
import { MODEL_TILT } from './pose.js';
import { ProceduralModel } from './procedural.jsx';

const bounds = new Box3();
const size = new Vector3();
const center = new Vector3();

// Centers any model and scales it so its largest side is `fit` units, measured in its own space
// (ignoring whatever transforms its parents have), so every product sits at the same size.
// With `box` ([width, height]) it instead fills that frame as far as it can while turning on its y axis.
function Fit({ fit = 1.8, box, children, token }) {
  const outer = useRef(null);
  const inner = useRef(null);
  useLayoutEffect(() => {
    const obj = inner.current;
    const parent = obj.parent;
    obj.position.set(0, 0, 0);
    obj.parent = null;
    obj.updateMatrixWorld(true);
    // Bounding boxes, not every vertex: a precise pass over a rigged model runs each vertex through its bones.
    bounds.setFromObject(obj);
    obj.parent = parent;
    bounds.getSize(size);
    bounds.getCenter(center);
    const scale = box
      ? Math.min(box[0] / Math.max(size.x, size.z, 1e-3), box[1] / Math.max(size.y, 1e-3))
      : fit / Math.max(size.x, size.y, size.z, 1e-3);
    outer.current.scale.setScalar(scale);
    obj.position.set(-center.x, -center.y, -center.z);
  }, [fit, box, token]);
  return (
    <group ref={outer}>
      <group ref={inner}>{children}</group>
    </group>
  );
}

function GltfModel({ url, tilt = 0, onLoaded }) {
  // Meshopt-compressed .glb; the decoder ships with three, so nothing loads from a CDN.
  const { scene } = useGLTF(url, false, true);
  const { gl, camera, scene: world } = useThree();
  // The cached scene is shared, so render a clone instead of moving the original around. SkeletonUtils
  // rebinds rigged meshes to their cloned bones; a plain clone would leave them invisible.
  const clone = useMemo(() => cloneSkinned(scene), [scene]);
  const [ready, setReady] = useState(false);
  const onLoadedRef = useRef(onLoaded);
  useLayoutEffect(() => {
    onLoadedRef.current = onLoaded;
  });

  // Stay hidden until the GPU is ready: textures upload now, and shaders compile on the driver's
  // background threads (KHR_parallel_shader_compile), so the first frame that shows the model
  // doesn't stall the page compiling them.
  useLayoutEffect(() => {
    let live = true;
    clone.traverse((obj) => {
      for (const material of [obj.material].flat()) {
        for (const value of Object.values(material ?? {})) if (value?.isTexture) gl.initTexture(value);
      }
    });
    const show = () => {
      if (!live) return;
      setReady(true);
      onLoadedRef.current?.();
    };
    // Compile against the whole scene: programs depend on its environment map, so compiling the clone on
    // its own would build shaders the first real frame throws away and rebuilds synchronously.
    gl.compileAsync(world, camera).then(show, show);
    return () => {
      live = false;
    };
  }, [clone, gl, camera, world]);

  return (
    <group rotation={[tilt, 0, 0]} visible={ready}>
      <primitive object={clone} />
    </group>
  );
}

// Reports that a model other than a downloaded one (procedural, or the stand-in after a failed load) is up.
function Loaded({ onLoaded }) {
  useEffect(() => onLoaded?.(), [onLoaded]);
  return null;
}

class ModelBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

// `tilt` poses a downloaded model toward the camera (defaults to its category's MODEL_TILT; procedural
// ones are built already posed); it is applied before measuring so the fit accounts for it.
// While a .glb downloads, the procedural model stands in, unless `showStandIn` is false (the hero keeps
// its photo up instead). `onLoaded` fires once whatever the final model is has been drawn-ready.
export function ProductModel({
  product,
  fit = 1.8,
  box,
  tilt = MODEL_TILT[product.category] ?? 0,
  showStandIn = true,
  onLoaded,
}) {
  const procedural = <ProceduralModel product={product} />;
  if (!product.modelUrl) {
    return (
      <Fit fit={fit} box={box} token={`${product._id}-${product.specs?.layout ?? ''}`}>
        {procedural}
        <Loaded onLoaded={onLoaded} />
      </Fit>
    );
  }
  const url = assetUrl(product.modelUrl);
  return (
    <ModelBoundary
      fallback={
        <Fit fit={fit} box={box} token="fallback">
          {procedural}
          <Loaded onLoaded={onLoaded} />
        </Fit>
      }
    >
      <Suspense
        fallback={
          showStandIn ? (
            <Fit fit={fit} box={box} token="loading">
              {procedural}
            </Fit>
          ) : null
        }
      >
        <Fit fit={fit} box={box} token={url}>
          <GltfModel url={url} tilt={tilt} onLoaded={onLoaded} />
        </Fit>
      </Suspense>
    </ModelBoundary>
  );
}
