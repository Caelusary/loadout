// Shared Canvas setup. three.js checks every shader's compile status right after compiling it, which
// waits on the GPU driver and undoes parallel compiling; keep that check for development only.
export function onCanvasCreated({ gl }) {
  gl.debug.checkShaderErrors = import.meta.env.DEV;
}

// The Canvas's onCreated, plus a watch for the GPU dropping the context (out of graphics memory, a driver reset,
// too many 3D canvases at once). The canvas goes blank when that happens and three.js can't recover on its own, so
// `onLost` lets the page fall back to its photo.
export const watchContext = (onLost) => (state) => {
  onCanvasCreated(state);
  state.gl.domElement.addEventListener(
    'webglcontextlost',
    (e) => {
      e.preventDefault();
      onLost?.();
    },
    { once: true },
  );
};
