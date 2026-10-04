import { RoundedBox } from '@react-three/drei';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { CatmullRomCurve3, Curve, Object3D, Vector3 } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { colorwayFor } from './colorways.js';
import { keyboardLayout } from './keyboardLayout.js';

// Every model is built from the product's own data (specs, name, description), so two products in the
// same category look different in the ways their listings say they differ.

function Plastic({ color, rough = 0.55, coat = 0.25 }) {
  return <meshPhysicalMaterial color={color} roughness={rough} clearcoat={coat} clearcoatRoughness={0.4} />;
}
function Metal({ color }) {
  return <meshPhysicalMaterial color={color} roughness={0.38} metalness={0.35} clearcoat={0.3} />;
}

const keycapGeometry = new RoundedBoxGeometry(1, 1, 1, 2, 0.18);
const scratch = new Object3D();

function Keycaps({ keys, color, height }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    keys.forEach((k, i) => {
      scratch.position.set(k.x + k.w / 2, height / 2, k.z + 0.5);
      scratch.scale.set(k.w - 0.12, height, 0.88);
      scratch.updateMatrix();
      ref.current.setMatrixAt(i, scratch.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.computeBoundingBox();
    ref.current.computeBoundingSphere();
  }, [keys, height]);
  if (keys.length === 0) return null;
  return (
    <instancedMesh ref={ref} args={[keycapGeometry, undefined, keys.length]}>
      <Plastic color={color} rough={0.5} coat={0.35} />
    </instancedMesh>
  );
}

function Keyboard({ product, colors }) {
  const { keys, width, depth } = useMemo(
    () => keyboardLayout(product.specs?.layout),
    [product.specs?.layout],
  );
  const regular = useMemo(() => keys.filter((k) => !k.accent), [keys]);
  const accent = useMemo(() => keys.filter((k) => k.accent), [keys]);
  const pad = 0.55;
  const knob = /knob/i.test(product.description ?? '');
  return (
    // Tilted toward the camera like a product shot, far edge raised.
    <group rotation={[0.95, 0, 0]}>
      <RoundedBox
        args={[width + pad * 2, 0.9, depth + pad * 2]}
        radius={0.3}
        smoothness={4}
        position={[0, -0.45, 0]}
      >
        <Metal color={colors.body} />
      </RoundedBox>
      <group position={[-width / 2, 0, -depth / 2]}>
        <Keycaps keys={regular} color={colors.keys} height={0.62} />
        <Keycaps keys={accent} color={colors.accent} height={0.62} />
      </group>
      {knob && (
        <mesh position={[width / 2 - 0.2, 0.45, -depth / 2 - 0.05]}>
          <cylinderGeometry args={[0.42, 0.42, 0.9, 40]} />
          <Metal color={colors.accent} />
        </mesh>
      )}
    </group>
  );
}

function mouseShape(product) {
  const name = product.name.toLowerCase();
  if (/ergo/.test(name)) return 'ergo';
  if (/travel|drift/.test(name)) return 'travel';
  if (/mini/.test(name)) return 'mini';
  return 'symmetric';
}

const MOUSE_SHELL = {
  symmetric: { scale: [0.6, 0.44, 1.05], tilt: 0 },
  mini: { scale: [0.56, 0.42, 0.88], tilt: 0 },
  travel: { scale: [0.58, 0.24, 1.0], tilt: 0 },
  ergo: { scale: [0.66, 0.62, 1.02], tilt: -0.42 }, // rolled toward the thumb, like a vertical-leaning ergonomic mouse
};

function Mouse({ product, colors }) {
  const shape = mouseShape(product);
  const shell = MOUSE_SHELL[shape];
  const wired = product.specs?.connectivity === 'wired';
  const top = shell.scale[1] - 0.06;
  const cable = useMemo(
    () =>
      new CatmullRomCurve3([
        new Vector3(0, 0.08, -1.0),
        new Vector3(0.05, 0.05, -1.5),
        new Vector3(0.35, 0.02, -2.0),
        new Vector3(0.1, 0.02, -2.6),
      ]),
    [],
  );
  return (
    // Three-quarter view from the front so the hump, buttons and wheel all read.
    <group rotation={[0.32, Math.PI * 0.8, 0]}>
      <group rotation={[-0.1, 0, shell.tilt]}>
        <mesh scale={shell.scale}>
          <sphereGeometry args={[1, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <Plastic color={colors.body} rough={0.62} coat={0.15} />
        </mesh>
        <mesh position={[0, top - 0.02, -0.5 * (shell.scale[2] / 1.05)]} rotation={[-0.42, 0, 0]}>
          <boxGeometry args={[0.022, 0.03, 0.55]} />
          <meshStandardMaterial color={colors.trim} roughness={0.8} />
        </mesh>
        {shape !== 'travel' && (
          <mesh position={[0, top + 0.01, -0.46 * (shell.scale[2] / 1.05)]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.1, 0.1, 0.085, 36]} />
            <Plastic color={colors.accent} rough={0.45} coat={0.5} />
          </mesh>
        )}
        {shape === 'travel' && (
          <mesh position={[0, top + 0.012, -0.45]}>
            <boxGeometry args={[0.07, 0.012, 0.16]} />
            <Plastic color={colors.accent} />
          </mesh>
        )}
        {[-0.18, 0.02].map((z) => (
          <mesh
            key={z}
            position={[shell.scale[0] - 0.03, 0.2 * (shell.scale[1] / 0.44), z]}
            rotation={[0, 0, -0.35]}
          >
            <boxGeometry args={[0.04, 0.07, 0.17]} />
            <Plastic color={colors.trim} />
          </mesh>
        ))}
        {shape === 'ergo' && (
          // Thumb rest shelf
          <mesh position={[shell.scale[0] - 0.05, 0.02, 0.1]} scale={[0.22, 0.05, 0.7]}>
            <sphereGeometry args={[1, 32, 16]} />
            <Plastic color={colors.trim} rough={0.7} coat={0} />
          </mesh>
        )}
      </group>
      <mesh scale={[shell.scale[0] + 0.03, 0.05, shell.scale[2] + 0.03]} position={[0, -0.005, 0]}>
        <sphereGeometry args={[1, 64, 16]} />
        <Plastic color={colors.trim} rough={0.7} coat={0} />
      </mesh>
      {wired && (
        <mesh>
          <tubeGeometry args={[cable, 64, 0.03, 10]} />
          <Plastic color={colors.trim} rough={0.8} coat={0} />
        </mesh>
      )}
    </group>
  );
}

function Headset({ product, colors }) {
  const name = product.name.toLowerCase();
  const open = /open/.test(name);
  const lite = /lite/.test(name);
  const boomMic = /boom mic/i.test(product.description ?? '');
  const cupRadius = lite ? 0.26 : 0.34;
  const cupDepth = lite ? 0.14 : 0.24;
  const mic = useMemo(
    () =>
      new CatmullRomCurve3([
        new Vector3(-0.84, -0.3, 0.05),
        new Vector3(-0.8, -0.55, 0.35),
        new Vector3(-0.55, -0.7, 0.62),
        new Vector3(-0.3, -0.72, 0.72),
      ]),
    [],
  );
  return (
    <group rotation={[0.1, -0.55, 0]}>
      <mesh position={[0, 0.2, 0]}>
        <torusGeometry args={[0.72, lite ? 0.045 : 0.07, 24, 96, Math.PI]} />
        <Metal color={colors.body} />
      </mesh>
      {!lite && (
        <mesh position={[0, 0.2, 0]} scale={[0.94, 0.94, 1]}>
          <torusGeometry args={[0.7, 0.05, 16, 96, Math.PI]} />
          <Plastic color={colors.trim} rough={0.8} coat={0} />
        </mesh>
      )}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.74, -0.25, 0]}>
          <mesh position={[0, 0.3, 0]}>
            <boxGeometry args={[0.06, 0.34, 0.12]} />
            <Metal color={colors.trim} />
          </mesh>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[cupRadius, cupRadius, cupDepth, 64]} />
            <Plastic color={colors.body} coat={0.45} />
          </mesh>
          {open ? (
            // Open-back grille: a dark mesh face with concentric rings.
            <group position={[side * (cupDepth / 2 + 0.005), 0, 0]} rotation={[0, Math.PI / 2, 0]}>
              <mesh>
                <circleGeometry args={[cupRadius * 0.86, 48]} />
                <meshStandardMaterial color="#141210" roughness={0.9} side={2} />
              </mesh>
              {[0.3, 0.55, 0.8].map((r) => (
                <mesh key={r}>
                  <torusGeometry args={[cupRadius * r, 0.008, 8, 48]} />
                  <Metal color={colors.accent} />
                </mesh>
              ))}
            </group>
          ) : (
            <mesh position={[side * (cupDepth / 2 + 0.005), 0, 0]} rotation={[0, Math.PI / 2, 0]}>
              <torusGeometry args={[cupRadius * 0.7, 0.018, 12, 64]} />
              <Plastic color={colors.accent} coat={0.6} />
            </mesh>
          )}
          <mesh position={[-side * (cupDepth / 2 + 0.03), 0, 0]} rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[cupRadius * 0.7, lite ? 0.06 : 0.09, 20, 64]} />
            <Plastic color={colors.trim} rough={0.9} coat={0} />
          </mesh>
        </group>
      ))}
      {boomMic && (
        <>
          <mesh>
            <tubeGeometry args={[mic, 48, 0.02, 10]} />
            <Metal color={colors.trim} />
          </mesh>
          <mesh position={[-0.3, -0.72, 0.72]}>
            <capsuleGeometry args={[0.045, 0.08, 8, 16]} />
            <Plastic color={colors.trim} rough={0.8} coat={0} />
          </mesh>
        </>
      )}
    </group>
  );
}

function Lens({ radius, z }) {
  return (
    <>
      <mesh position={[0, 0, z]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[radius * 1.35, radius * 1.35, 0.08, 48]} />
        <meshPhysicalMaterial color="#2b2721" roughness={0.35} metalness={0.4} />
      </mesh>
      <mesh position={[0, 0, z + 0.045]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[radius, radius, 0.02, 48]} />
        <meshPhysicalMaterial color="#07090c" roughness={0.05} clearcoat={1} metalness={0.2} />
      </mesh>
    </>
  );
}

function Webcam({ product, colors }) {
  const resolution = product.specs?.resolution ?? '1080p';
  if (resolution === '720p') {
    // Small rounded cube on a little stand
    return (
      <group rotation={[0.12, -0.45, 0]}>
        <RoundedBox args={[0.62, 0.5, 0.42]} radius={0.12} smoothness={5}>
          <Plastic color={colors.body} coat={0.4} />
        </RoundedBox>
        <Lens radius={0.11} z={0.2} />
        <mesh position={[0, -0.36, -0.02]}>
          <cylinderGeometry args={[0.05, 0.05, 0.22, 16]} />
          <Plastic color={colors.trim} />
        </mesh>
        <mesh position={[0, -0.48, -0.02]}>
          <cylinderGeometry args={[0.22, 0.24, 0.04, 32]} />
          <Plastic color={colors.trim} />
        </mesh>
      </group>
    );
  }
  const large = resolution === '4k' || resolution === '1440p';
  const length = large ? 1.1 : 0.85;
  const radius = large ? 0.26 : 0.21;
  return (
    <group rotation={[0.12, -0.4, 0]}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <capsuleGeometry args={[radius, length, 12, 32]} />
        <Plastic color={colors.body} coat={0.4} />
      </mesh>
      <Lens radius={large ? 0.14 : 0.11} z={radius - 0.04} />
      <mesh position={[0, 0, radius + 0.015]}>
        <torusGeometry args={[large ? 0.18 : 0.145, 0.013, 12, 48]} />
        <Plastic color={colors.accent} coat={0.6} />
      </mesh>
      {/* Microphone holes either side of the lens */}
      {[-1, 1].map((side) => (
        <group key={side}>
          {[0, 1, 2].map((i) => (
            <mesh
              key={i}
              position={[side * (0.32 + i * 0.05), 0.02, radius - 0.01]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <cylinderGeometry args={[0.012, 0.012, 0.02, 8]} />
              <meshStandardMaterial color="#141210" />
            </mesh>
          ))}
        </group>
      ))}
      {large && (
        // Privacy shutter slider on top
        <RoundedBox args={[0.28, 0.05, 0.12]} radius={0.02} position={[0, radius + 0.01, 0.06]}>
          <Plastic color={colors.accent} />
        </RoundedBox>
      )}
      <mesh position={[0, -radius - 0.12, -0.08]} rotation={[0.25, 0, 0]}>
        <boxGeometry args={[0.34, 0.3, 0.08]} />
        <Plastic color={colors.trim} />
      </mesh>
      <mesh position={[0, -radius - 0.28, 0.05]}>
        <boxGeometry args={[0.34, 0.05, 0.36]} />
        <Plastic color={colors.trim} />
      </mesh>
    </group>
  );
}

// Reads "900 × 400 mm" style sizes from the description so the pad has the right proportions.
function padSize(product) {
  const match = (product.description ?? '').match(/(\d{3,4})\s*[×x]\s*(\d{3,4})/);
  if (!match) return [2.4, 1.7];
  const [w, d] = [Number(match[1]), Number(match[2])];
  return [2.4, (2.4 * d) / w];
}

function Mousepad({ product, colors }) {
  const glass = /glass/i.test(product.name);
  const [w, d] = padSize(product);
  return (
    <group rotation={[1.0, 0, 0]}>
      <RoundedBox args={[w, glass ? 0.05 : 0.06, d]} radius={glass ? 0.04 : 0.028} smoothness={4}>
        {glass ? (
          <meshPhysicalMaterial
            color={colors.keys}
            roughness={0.08}
            clearcoat={1}
            clearcoatRoughness={0.05}
            metalness={0.1}
          />
        ) : (
          <Plastic color={colors.body} rough={0.85} coat={0} />
        )}
      </RoundedBox>
      {!glass && (
        // Stitched edge
        <RoundedBox args={[w + 0.04, 0.045, d + 0.04]} radius={0.02} smoothness={4} position={[0, -0.01, 0]}>
          <Plastic color={colors.trim} rough={0.9} coat={0} />
        </RoundedBox>
      )}
      <mesh position={[w / 2 - 0.28, 0.032, d / 2 - 0.12]}>
        <boxGeometry args={[0.34, 0.004, 0.08]} />
        <meshStandardMaterial color={colors.accent} />
      </mesh>
    </group>
  );
}

class Helix extends Curve {
  constructor(turns, radius, length) {
    super();
    Object.assign(this, { turns, radius, length });
  }
  getPoint(t, target = new Vector3()) {
    const angle = t * Math.PI * 2 * this.turns;
    return target.set(
      t * this.length - this.length / 2,
      Math.cos(angle) * this.radius,
      Math.sin(angle) * this.radius,
    );
  }
}

function CoiledCable({ colors }) {
  const coil = useMemo(() => new Helix(9, 0.16, 0.95), []);
  const leadLeft = useMemo(
    () =>
      new CatmullRomCurve3([
        new Vector3(-0.475, 0.16, 0),
        new Vector3(-0.75, 0.3, 0.1),
        new Vector3(-1.1, 0.05, 0.25),
      ]),
    [],
  );
  const leadRight = useMemo(
    () =>
      new CatmullRomCurve3([coil.getPoint(1), new Vector3(0.8, -0.25, 0.05), new Vector3(1.1, -0.05, 0.3)]),
    [coil],
  );
  return (
    <group rotation={[0.35, -0.3, 0.12]}>
      <mesh>
        <tubeGeometry args={[coil, 600, 0.04, 12]} />
        <Plastic color={colors.keys} rough={0.75} coat={0} />
      </mesh>
      {[leadLeft, leadRight].map((curve, i) => (
        <mesh key={i}>
          <tubeGeometry args={[curve, 64, 0.04, 12]} />
          <Plastic color={colors.keys} rough={0.75} coat={0} />
        </mesh>
      ))}
      <group position={[-1.18, 0.02, 0.28]} rotation={[0, 0.5, 0]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.07, 0.07, 0.2, 32]} />
          <Metal color={colors.accent} />
        </mesh>
      </group>
      <RoundedBox
        args={[0.22, 0.09, 0.14]}
        radius={0.03}
        position={[1.2, -0.04, 0.34]}
        rotation={[0, -0.4, 0]}
      >
        <Metal color="#9aa1ac" />
      </RoundedBox>
    </group>
  );
}

function WristRest({ colors }) {
  return (
    <group rotation={[0.75, 0, 0]}>
      <RoundedBox args={[2.6, 0.24, 0.72]} radius={0.1} smoothness={5}>
        <meshPhysicalMaterial color="#6d4a33" roughness={0.42} clearcoat={0.5} />
      </RoundedBox>
      <RoundedBox args={[2.56, 0.04, 0.68]} radius={0.02} position={[0, -0.13, 0]}>
        <Plastic color={colors.trim} rough={0.95} coat={0} />
      </RoundedBox>
    </group>
  );
}

export function ProceduralModel({ product }) {
  const colors = colorwayFor(product._id);
  switch (product.category) {
    case 'keyboard':
      return <Keyboard product={product} colors={colors} />;
    case 'mouse':
      return <Mouse product={product} colors={colors} />;
    case 'headset':
      return <Headset product={product} colors={colors} />;
    case 'webcam':
      return <Webcam product={product} colors={colors} />;
    case 'mousepad':
      return <Mousepad product={product} colors={colors} />;
    default:
      return /wrist|rest/i.test(product.name) ? (
        <WristRest colors={colors} />
      ) : (
        <CoiledCable colors={colors} />
      );
  }
}
