import AxeBuilder from '@axe-core/playwright';
import { expect } from '@playwright/test';

// Seeded demo accounts (server/src/seed). The in-memory database is rebuilt on every server start.
export const PASSWORD = 'password123';
export const users = {
  customer: 'mika@loadout.test',
  seller: 'lumen@loadout.test',
  admin: 'admin@loadout.test',
  riders: ['ramon@loadout.test', 'joy@loadout.test'],
};

export async function signIn(page, email) {
  await page.context().clearCookies();
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

// Fails on serious and critical WCAG A/AA problems; minor and moderate ones are left to review.
export async function expectAccessible(page) {
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const blocking = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  const report = blocking.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.help} at ${v.nodes
        .map((n) => n.target.join(' '))
        .slice(0, 3)
        .join(', ')}`,
  );
  expect(report, report.join('\n')).toEqual([]);
}
