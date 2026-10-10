import { expect, test } from '@playwright/test';
import { expectAccessible } from './helpers.js';

test.describe('guest browsing', () => {
  test('filters the shop and opens a product', async ({ page }) => {
    await page.goto('/shop');
    await expect(page.getByRole('heading', { name: 'All products', level: 1 })).toBeVisible();

    await page.getByRole('radio', { name: 'Mice' }).click();
    await expect(page).toHaveURL(/category=mouse/);
    const cards = page
      .getByRole('main')
      .getByRole('link')
      .filter({ has: page.getByRole('heading', { level: 3 }) });
    await expect(cards.first()).toBeVisible();

    await cards.first().click();
    await expect(page).toHaveURL(/\/p\//);
    await expect(page.getByRole('button', { name: 'Add to cart' })).toBeVisible();
    await expect(
      page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'Mice' }),
    ).toBeVisible();
  });

  test('sends a guest to sign in before the cart', async ({ page }) => {
    await page.goto('/cart');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });

  test('shows a not-found page for unknown routes', async ({ page }) => {
    await page.goto('/definitely-not-a-page');
    await expect(page.getByRole('main')).toContainText(/not found|doesn.t exist/i);
  });

  for (const path of ['/', '/shop', '/p/lumen-stream-cam', '/login']) {
    test(`has no serious accessibility problems on ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.getByRole('main').waitFor();
      await page.waitForLoadState('load');
      await expectAccessible(page);
    });
  }
});
