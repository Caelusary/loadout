import { expect } from '@playwright/test';

// Software WebGL (what headless Chrome and CI have) draws a frame every few seconds, so 3D tests get long timeouts.
export const SLOW = 300_000;

// Shared checks for the 3D views. A model counts as shown only when three things hold at once: the canvas fills
// the viewer (nothing pushed it out of the clipped stage), it's the topmost thing at the viewer's centre (no photo or
// overlay covering it), and its drawing buffer actually has the model in it.

export const STAGE = 'main [class*="aspect-square"]';

// How much of the canvas is drawn, read right after the page's own frame renders.
export const drawnPixels = (page, canvasSelector) =>
  page.evaluate(
    (sel) =>
      new Promise((resolve) => {
        const c = document.querySelector(sel);
        const gl = c?.getContext('webgl2') ?? c?.getContext('webgl');
        if (!gl || gl.isContextLost()) return resolve(0);
        requestAnimationFrame(() => {
          const w = gl.drawingBufferWidth;
          const h = gl.drawingBufferHeight;
          const px = new Uint8Array(w * h * 4);
          gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
          let n = 0;
          for (let i = 3; i < px.length; i += 4) if (px[i] > 8) n++;
          resolve(n);
        });
      }),
    canvasSelector,
  );

// Where the canvas sits against the viewer, and what's on top at the viewer's centre.
const layout = (page) =>
  page.evaluate((sel) => {
    const stage = document.querySelector(sel);
    const canvas = stage?.querySelector('canvas');
    if (!canvas) return null;
    const s = stage.getBoundingClientRect();
    const c = canvas.getBoundingClientRect();
    const top = document.elementFromPoint(s.left + s.width / 2, s.top + s.height / 2);
    return {
      offset: Math.max(Math.abs(s.left - c.left), Math.abs(s.top - c.top), Math.abs(s.width - c.width), Math.abs(s.height - c.height)),
      canvasOnTop: top === canvas,
    };
  }, STAGE);

export async function expectModelShown(page) {
  await expect
    .poll(async () => {
      const l = await layout(page);
      return Boolean(l && l.offset <= 1 && l.canvasOnTop);
    }, { message: 'the 3D canvas fills the viewer and nothing covers it', timeout: 30_000 })
    .toBe(true);
  await expect
    .poll(() => drawnPixels(page, `${STAGE} canvas`), { message: 'the model is drawn', timeout: 60_000 })
    .toBeGreaterThan(2000);
}

export const viewButton = (page, name) =>
  page.getByRole('group', { name: 'View' }).getByRole('button', { name, exact: true });
// The viewer itself: the gallery's square stage, the first one on the page (product cards further down use the same
// shape). Found this way rather than through the Photo / 3D switch, which is gone once 3D has failed.
export const stage = (page) => page.locator(STAGE).first();

export async function open3D(page) {
  await viewButton(page, '3D view').click();
  await expect(viewButton(page, '3D view')).toHaveAttribute('aria-pressed', 'true');
  await expectModelShown(page);
}

export async function openPhoto(page) {
  await viewButton(page, 'Photo').click();
  await expect(viewButton(page, 'Photo')).toHaveAttribute('aria-pressed', 'true');
  await expect(stage(page).locator('canvas')).toHaveCount(0);
  await expect(stage(page).locator('img').first()).toBeVisible();
}

export { watchErrors } from './helpers.js';
