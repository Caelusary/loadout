import { useThree } from '@react-three/fiber';
import { useLayoutEffect } from 'react';

// Compiles every model's shaders on the driver's background threads (KHR_parallel_shader_compile)
// before the first frame, so the first render doesn't block the main thread on shader compiles.
export function Warmup({ onDone }) {
  const { gl, scene, camera } = useThree();
  useLayoutEffect(() => {
    let live = true;
    const done = () => live && onDone(true);
    gl.compileAsync(scene, camera).then(done, done);
    return () => {
      live = false;
    };
  }, [gl, scene, camera, onDone]);
  return null;
}
