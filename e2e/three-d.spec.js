import { expect, test } from '@playwright/test';
import { drawnPixels, expectModelShown, open3D, openPhoto, SLOW, stage, STAGE, viewButton, watchErrors } from './three-d.js';

test.describe.configure({ timeout: SLOW });

// The product page's 3D view and the home page's 3D stage, clicked through the way a shopper does.

test.describe('product 3D view', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/p/northpaw-ridge-75');
    await expect(page.getByRole('heading', { name: 'Northpaw Ridge 75' })).toBeVisible();
  });

  test('opens inside the viewer and stays there when the model is clicked and dragged', async ({ page }) => {
    const errors = watchErrors(page);
    await open3D(page);
    const box = await stage(page).boundingBox();
    const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await page.mouse.click(centre.x, centre.y);
    await expectModelShown(page);
    await page.mouse.move(centre.x, centre.y);
    await page.mouse.down();
    await page.mouse.move(centre.x + 80, centre.y + 10, { steps: 8 });
    await page.mouse.up();
    await expectModelShown(page);
    await page.mouse.wheel(0, -200);
    await expectModelShown(page);
    expect(errors).toEqual([]);
  });

  test('switching between Photo and 3D view keeps both working', async ({ page }) => {
    const errors = watchErrors(page);
    await open3D(page);
    // Tag the viewer's canvas: switching back to 3D should show this same one, not build a new viewer (the lag).
    await page.evaluate((sel) => (document.querySelector(`${sel} canvas`).dataset.first = '1'), STAGE);
    for (let i = 0; i < 2; i++) {
      await openPhoto(page);
      await open3D(page);
      expect(await page.evaluate((sel) => document.querySelector(`${sel} canvas`).dataset.first, STAGE)).toBe('1');
    }
    await expect(viewButton(page, '3D view')).toBeVisible();
    await open3D(page);
    expect(errors).toEqual([]);
  });

  test('a thumbnail goes back to the photo, and 3D still opens after', async ({ page }) => {
    await open3D(page);
    await page.getByRole('button', { name: /^Show / }).nth(1).click();
    await expect(viewButton(page, 'Photo')).toHaveAttribute('aria-pressed', 'true');
    await open3D(page);
  });

  test('another product starts on its photo, and its 3D view works', async ({ page }) => {
    await open3D(page);
    // An in-app link (the related products under the gallery). The page is rebuilt per address (App's
    // PageErrorBoundary is keyed by pathname), which is what gives the next product a fresh gallery; this guards that.
    const other = page.locator('main a[href^="/p/"]:not([href^="/p/northpaw-ridge-75"])').first();
    // Hover first, as a shopper's pointer does, and let LinkPrefetch load the product, so the page has no loading
    // skeleton in between.
    const slug = (await other.getAttribute('href')).split('/')[2].split(/[?#]/)[0];
    const loaded = page.waitForResponse((r) => r.url().endsWith(`/api/products/${slug}`) && r.ok());
    await other.hover();
    await loaded;
    await other.click();
    await expect(page).not.toHaveURL(/northpaw-ridge-75/);
    await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('Northpaw Ridge 75');
    await expect(viewButton(page, 'Photo')).toHaveAttribute('aria-pressed', 'true');
    await open3D(page);
  });

  test('if the graphics context is lost, the photo comes back instead of a crash', async ({ page }) => {
    const errors = watchErrors(page);
    await open3D(page);
    await page.evaluate((sel) => {
      const c = document.querySelector(`${sel} canvas`);
      (c.getContext('webgl2') ?? c.getContext('webgl')).getExtension('WEBGL_lose_context').loseContext();
    }, STAGE);
    await expect(stage(page).locator('canvas')).toHaveCount(0);
    await expect(stage(page).locator('img').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Northpaw Ridge 75' })).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe('home 3D stage', () => {
  const stageCanvas = 'main canvas';

  test('draws, and still draws after leaving the page and coming back', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/');
    await expect.poll(() => drawnPixels(page, stageCanvas), { timeout: 90_000 }).toBeGreaterThan(2000);
    await page.getByRole('link', { name: 'Shop', exact: true }).first().click();
    await expect(page).toHaveURL(/\/shop/);
    await page.goBack();
    await expect.poll(() => drawnPixels(page, stageCanvas), { timeout: 90_000 }).toBeGreaterThan(2000);
    expect(errors).toEqual([]);
  });
});
