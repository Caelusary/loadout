// Shared Canvas setup. three.js checks every shader's compile status right after compiling it, which
// waits on the GPU driver and undoes parallel compiling; keep that check for development only.
export function onCanvasCreated({ gl }) {
  gl.debug.checkShaderErrors = import.meta.env.DEV;
}

// The Canvas's onCreated, plus a watch for the GPU dropping the context (out of graphics memory, a driver reset,
// too many 3D canvases at once). The canvas goes blank when that happens and three.js can't recover on its own, so
// `onLost` lets the page fall back to its photo.
// A viewer that closes on purpose (switching back to Photo, leaving the page) also loses its context: three.js
// releases it on unmount. By then the canvas has left the page, so a loss on a detached canvas is ignored; treating
// it as a failure hid the 3D view after the first switch back to Photo.
export const watchContext = (onLost) => (state) => {
  onCanvasCreated(state);
  const canvas = state.gl.domElement;
  canvas.addEventListener(
    'webglcontextlost',
    (e) => {
      if (!canvas.isConnected) return;
      e.preventDefault();
      onLost?.();
    },
    { once: true },
  );
};
