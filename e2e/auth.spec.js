import { expect, test } from '@playwright/test';
import { PASSWORD, users } from './helpers.js';

test.describe('accounts', () => {
  test('rejects a wrong password without signing in', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('textbox', { name: 'Email' }).fill(users.customer);
    await page.getByRole('textbox', { name: 'Password' }).fill('not-the-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(
      page
        .getByRole('alert')
        .or(page.getByText(/incorrect|invalid|wrong/i))
        .first(),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('registers a new customer who can reach their account', async ({ page }) => {
    await page.goto('/register');
    await page.getByRole('textbox', { name: /name/i }).first().fill('Playwright Tester');
    await page.getByRole('textbox', { name: 'Email' }).fill(`e2e-${Date.now()}@loadout.test`);
    for (const field of await page.getByRole('textbox', { name: /password/i }).all())
      await field.fill(PASSWORD);
    await page.getByRole('button', { name: /create account|sign up|register/i }).click();
    await expect(page).not.toHaveURL(/\/register/);

    await page.goto('/account/orders');
    await expect(page).toHaveURL(/\/account\/orders/);
  });
});
