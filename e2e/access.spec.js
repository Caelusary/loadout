import { expect, test } from '@playwright/test';
import { signIn, users } from './helpers.js';

test.describe('role access', () => {
  test('a customer is kept out of the seller and admin panels', async ({ page }) => {
    await signIn(page, users.customer);
    for (const path of ['/seller', '/admin', '/deliveries']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { name: "You don't have access to this page" })).toBeVisible();
    }
  });

  test('an admin can open the admin panel', async ({ page }) => {
    await signIn(page, users.admin);
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin/);
    await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('a seller sees their own products', async ({ page }) => {
    await signIn(page, users.seller);
    await page.goto('/seller/products');
    await expect(page.getByRole('main')).toContainText('Lumen Stream Cam');
  });
});
