import { BufferAttribute, BufferGeometry, Mesh, OrthographicCamera, PMREMGenerator } from 'three';

const warmed = new WeakMap();

// Compiles three.js's environment-map shaders (the cube-to-PMREM conversion and its GGX blur) on the
// driver's background threads before the environment is first used. Otherwise the first frame that
// needs the environment blocks for most of a second linking the blur shader.
// Relies on PMREMGenerator internals (three 0.186); if those change, this resolves straight away and
// the only cost is the old stall.
export function warmEnvironment(gl, cubeSize) {
  if (warmed.has(gl)) return warmed.get(gl);
  let ready = Promise.resolve();
  try {
    const pmrem = new PMREMGenerator(gl);
    pmrem._setSize(cubeSize);
    pmrem._allocateTargets().dispose(); // creates the GGX blur material for this size
    // Programs are cached by details of the draw, so compile the way the real conversion draws: into a
    // render target (it sets the output colour space) with geometry that has positions.
    const previous = gl.getRenderTarget();
    gl.setRenderTarget(pmrem._pingPongRenderTarget);
    pmrem.compileCubemapShader(); // creates the cube-to-PMREM material
    const geometry = new BufferGeometry().setAttribute('position', new BufferAttribute(new Float32Array(9), 3));
    const camera = new OrthographicCamera();
    const materials = [pmrem._cubemapMaterial, pmrem._ggxMaterial].filter(Boolean);
    const compiling = materials.map((m) => gl.compileAsync(new Mesh(geometry, m), camera));
    gl.setRenderTarget(previous);
    // The generator is kept (not disposed) so its programs stay cached until the real environment uses them.
    ready = Promise.all(compiling).then(() => undefined);
  } catch {
    // Unknown internals: fall back to compiling on first use.
  }
  warmed.set(gl, ready);
  return ready;
}
