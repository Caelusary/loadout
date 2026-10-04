// Shared Canvas setup. three.js checks every shader's compile status right after compiling it, which
// waits on the GPU driver and undoes parallel compiling; keep that check for development only.
export function onCanvasCreated({ gl }) {
  gl.debug.checkShaderErrors = import.meta.env.DEV;
}
