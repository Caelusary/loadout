import { useEffect, useRef } from 'react';
import { useThemeColors } from '../../providers/ThemeProvider.jsx';

// A page-wide neon backdrop: a slowly drifting magenta/cyan haze with a soft glow that follows the
// cursor. One full-screen fragment shader drawn at reduced resolution; it pauses with the tab and holds
// a single still frame for reduced motion.

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `
precision mediump float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uMouse;
uniform vec3 uBg;
uniform vec3 uCyan;
uniform vec3 uPink;
uniform float uLight;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
// Dark mode adds neon like light; light mode mixes it in like ink, darkening toward the colour,
// since adding light to a pale page only washes it out.
vec3 neon(vec3 c, float a){ return mix(c, -(1.0 - c) * 0.8, uLight) * a; }

float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  float aspect = uRes.x / uRes.y;
  vec2 q = vec2(uv.x * aspect, uv.y);
  vec2 m = vec2(uMouse.x * aspect, uMouse.y);
  // Light pages carry dense text, so the backdrop there is a faint hint rather than a scene.
  float strength = mix(1.0, 0.35, uLight);

  // Haze: two slow noise fields, magenta low and cyan high.
  float n1 = fbm(q * 1.6 + vec2(uTime * 0.02, -uTime * 0.015));
  float n2 = fbm(q * 2.4 - vec2(uTime * 0.017, uTime * 0.01) + 4.0);
  vec3 col = uBg;
  col += neon(uPink, smoothstep(0.45, 0.95, n1) * (1.0 - uv.y) * 0.22 * strength);
  col += neon(uCyan, smoothstep(0.5, 1.0, n2) * uv.y * 0.14 * strength);

  // A soft glow that follows the cursor.
  col += neon(uCyan, exp(-distance(q, m) * 5.0) * 0.07 * strength);

  // A vignette to darken the corners.
  col *= mix(1.0, 1.0 - smoothstep(0.35, 1.35, length(uv - 0.5) * 1.4), 0.55 * (1.0 - uLight)); // smoothstep needs edge0 < edge1 in GLSL ES
  gl_FragColor = vec4(col, 1.0);
}`;

const MAX_PIXELS = 960 * 540;
const IDLE_FRAME_MS = 1000 / 30 - 2; // a little under 30 fps so rAF jitter never skips two frames

const toRgb = (hex) => {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
};

export function NeonBackdrop() {
  const canvas = useRef(null);
  const colors = useThemeColors();
  const state = useRef({ colors });

  // The render loop reads the latest theme without restarting.
  useEffect(() => {
    state.current.colors = colors;
    state.current.redraw?.();
  }, [colors]);

  useEffect(() => {
    const el = canvas.current;
    const gl = el.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
    if (!gl) return;

    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);

    // Asking for LINK_STATUS right away stalls the main thread until the driver has compiled the shader
    // (~250 ms on an integrated GPU under Windows/ANGLE). With KHR_parallel_shader_compile the compile runs
    // on a driver thread and is polled once a frame instead. The canvas stays hidden until its first frame.
    const parallel = gl.getExtension('KHR_parallel_shader_compile');
    let poll = 0;
    let stop = null;
    el.style.visibility = 'hidden';
    const whenLinked = () => {
      if (parallel && !gl.getProgramParameter(prog, parallel.COMPLETION_STATUS_KHR)) {
        poll = requestAnimationFrame(whenLinked);
        return;
      }
      if (gl.getProgramParameter(prog, gl.LINK_STATUS)) stop = start();
    };
    whenLinked();
    return () => {
      cancelAnimationFrame(poll);
      stop?.();
      // Free the GPU objects but keep the context: a canvas hands back the same context on the next
      // mount (Strict Mode remounts in development), and a lost one would never draw again.
      gl.deleteProgram(prog);
    };

    function start() {
      gl.useProgram(prog);

      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'p');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      const u = Object.fromEntries(['uRes', 'uTime', 'uMouse', 'uBg', 'uCyan', 'uPink', 'uLight'].map((n) => [n, gl.getUniformLocation(prog, n)]));

      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const mouse = { x: 0.5, y: 0.3, tx: 0.5, ty: 0.3 };
      let frame = 0;
      let last = 0;
      const start = performance.now();

      const resize = () => {
        // Half resolution: the backdrop is soft, so the saving is free. Capped at the pixel count of a
        // half-res 1080p screen, so a high-DPI laptop's integrated GPU isn't filling 1M+ pixels a frame.
        const scale = Math.min(Math.min(devicePixelRatio, 2) * 0.5, Math.sqrt(MAX_PIXELS / (innerWidth * innerHeight)));
        el.width = Math.round(innerWidth * scale);
        el.height = Math.round(innerHeight * scale);
        gl.viewport(0, 0, el.width, el.height);
      };

      const draw = (now) => {
        const { colors: c } = state.current;
        // The glow eases 8% of the way per 60 Hz frame, scaled by elapsed time so skipped frames don't slow it.
        const k = 1 - Math.pow(0.92, Math.min(now - last, 100) / (1000 / 60));
        last = now;
        mouse.x += (mouse.tx - mouse.x) * k;
        mouse.y += (mouse.ty - mouse.y) * k;
        gl.uniform2f(u.uRes, el.width, el.height);
        gl.uniform1f(u.uTime, reduced ? 12 : (now - start) / 1000);
        gl.uniform2f(u.uMouse, mouse.x, mouse.y);
        gl.uniform3fv(u.uBg, toRgb(c.bg));
        gl.uniform3fv(u.uCyan, toRgb(c.accent));
        gl.uniform3fv(u.uPink, toRgb(c.neon));
        gl.uniform1f(u.uLight, c.theme === 'light' ? 1 : 0);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        el.style.visibility = '';
      };

      const loop = (now) => {
        frame = requestAnimationFrame(loop);
        // Every frame while the glow is chasing the cursor; once it settles only the slow haze moves,
        // which looks the same at ~30 fps and halves the GPU work on an idle page.
        const chasing = Math.abs(mouse.tx - mouse.x) + Math.abs(mouse.ty - mouse.y) > 0.001;
        if (chasing || now - last >= IDLE_FRAME_MS) draw(now);
      };
      const play = () => {
        cancelAnimationFrame(frame);
        if (reduced) draw(performance.now());
        else if (!document.hidden) frame = requestAnimationFrame(loop);
      };
      state.current.redraw = () => reduced && draw(performance.now());

      const onMove = (e) => {
        mouse.tx = e.clientX / innerWidth;
        mouse.ty = 1 - e.clientY / innerHeight;
      };
      const onResize = () => {
        resize();
        if (reduced) draw(performance.now());
      };

      resize();
      play();
      addEventListener('pointermove', onMove, { passive: true });
      addEventListener('resize', onResize);
      document.addEventListener('visibilitychange', play);
      return () => {
        cancelAnimationFrame(frame);
        removeEventListener('pointermove', onMove);
        removeEventListener('resize', onResize);
        document.removeEventListener('visibilitychange', play);
        gl.deleteBuffer(buffer);
      };
    }
  }, []);

  return <canvas ref={canvas} aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 size-full" />;
}
