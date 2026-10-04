import { Environment, Lightformer } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import { warmEnvironment } from './warmEnvironment.js';

const ENV_SIZE = 256;

// Calls onReady a couple of frames after the environment is in, once its reflections have rendered.
function EnvironmentReady({ onReady }) {
  const frames = useRef(0);
  useFrame(() => {
    frames.current += 1;
    if (frames.current === 2) onReady?.();
  });
  return null;
}

// A cool key light from the front-right with neon rims: magenta from behind-left, cyan from the right,
// and white back lights from behind that outline dark products against the dark cards.
// Reflections come from Lightformer panels rendered once, so no HDR file is downloaded. The panels
// only render once their blur shaders have compiled in the background (see warmEnvironment); scenes
// wait for onReady before showing models, so each model compiles once, against the finished lighting.
// `rim` turns the white back lights off for light products. They stay in the scene at zero intensity,
// since adding or removing a light would recompile every shader.
export function StudioLighting({ onReady, rim = true }) {
  const gl = useThree((s) => s.gl);
  const [warm, setWarm] = useState(false);
  useEffect(() => {
    let live = true;
    warmEnvironment(gl, ENV_SIZE).then(() => live && setWarm(true));
    return () => {
      live = false;
    };
  }, [gl]);
  return (
    <>
      <ambientLight intensity={0.28} />
      <directionalLight position={[3, 5, 6]} intensity={1.9} color="#eef4ff" />
      <directionalLight position={[-5, 2.5, -4]} intensity={2.2} color="#ff2bd6" />
      <directionalLight position={[5, 1, -2]} intensity={1.6} color="#00f0ff" />
      <directionalLight position={[0, -3, 4]} intensity={0.25} color="#7a8cff" />
      <directionalLight position={[-4, 2.5, -5]} intensity={rim ? 4.6 : 0} color="#e6eeff" />
      <directionalLight position={[4, 2.5, -5]} intensity={rim ? 4.6 : 0} color="#e6eeff" />
      {warm && (
        <>
          <Environment resolution={ENV_SIZE} frames={1}>
            <Lightformer
              form="rect"
              intensity={2}
              position={[0, 4, 3]}
              scale={[9, 2.5, 1]}
              rotation-x={Math.PI / 3}
            />
            <Lightformer
              form="rect"
              intensity={1.4}
              color="#ff2bd6"
              position={[-5, 1, 1]}
              scale={[3, 6, 1]}
              rotation-y={Math.PI / 2}
            />
            <Lightformer
              form="rect"
              intensity={1.4}
              color="#00f0ff"
              position={[5, 1, -1]}
              scale={[3, 6, 1]}
              rotation-y={-Math.PI / 2}
            />
          </Environment>
          <EnvironmentReady onReady={onReady} />
        </>
      )}
    </>
  );
}
