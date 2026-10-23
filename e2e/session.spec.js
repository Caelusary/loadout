import { expect, test } from '@playwright/test';
import { signIn, users, watchErrors } from './helpers.js';

// The last signed-in account is remembered on the device so account pages draw at once (AuthProvider). These check
// it never decides anything on its own once the session behind it is gone.
test.describe('remembered session', () => {
  test('an ended session on an account page goes to sign-in, without errors', async ({ page }) => {
    const errors = watchErrors(page);
    await signIn(page, users.admin);
    await page.goto('/admin/users');
    await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();
    await page.context().clearCookies();
    await page.goto('/admin/users');
    await expect(page).toHaveURL(/\/login\?next=%2Fadmin%2Fusers/);
    await expect(page.getByRole('textbox', { name: 'Email' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('after an ended session, signing in as someone else shows their account, not the old one', async ({ page }) => {
    await signIn(page, users.admin);
    await signIn(page, users.customer);
    await page.goto('/account/orders');
    await expect(page.getByRole('heading', { name: 'My orders' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Admin panel' })).toHaveCount(0);
  });

  test('signing out forgets the account on this device', async ({ page }) => {
    await signIn(page, users.customer);
    expect(await page.evaluate(() => localStorage.getItem('loadout_session_v1'))).toContain('mika@loadout.test');
    await page.getByRole('button', { name: /account menu|Mika/i }).first().click();
    await page.getByRole('menuitem', { name: 'Sign out' }).or(page.getByRole('button', { name: 'Sign out' })).first().click();
    await page.getByRole('dialog').getByRole('button', { name: 'Sign out' }).click();
    await expect.poll(() => page.evaluate(() => localStorage.getItem('loadout_session_v1'))).toBeNull();
  });
});
