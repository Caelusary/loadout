import { expect, test } from '@playwright/test';
import { signIn, users } from './helpers.js';

// Runs in the "phone" project (Pixel 7 viewport, touch).
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test.describe('phone layout', () => {
  for (const path of ['/', '/shop', '/p/lumen-stream-cam', '/login']) {
    test(`does not scroll sideways on ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.getByRole('main').waitFor();
      await page.waitForLoadState('load');
      expect(await noSideScroll(page)).toBe(true);
    });
  }

  test('checkout fits and the order can be placed', async ({ page }) => {
    await signIn(page, users.customer);
    await page.goto('/p/lumen-stream-cam');
    await page.getByRole('button', { name: 'Buy now' }).first().tap();
    await expect(page.getByRole('button', { name: 'Place order' })).toBeVisible();
    expect(await noSideScroll(page)).toBe(true);
    await page.getByRole('button', { name: 'Place order' }).tap();
    await expect(page.getByRole('heading', { name: 'Your order is placed' })).toBeVisible();
  });
});
