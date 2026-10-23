import { expect, test } from '@playwright/test';
import { expectModelShown, open3D, openPhoto, SLOW, stage, viewButton, watchErrors } from './three-d.js';

test.describe.configure({ timeout: SLOW });

// The product 3D view on a phone: taps instead of clicks, and the switch back and forth.
test('on a phone, 3D opens, survives a tap on the model and keeps working after Photo', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/p/northpaw-ridge-75');
  await expect(page.getByRole('heading', { name: 'Northpaw Ridge 75' })).toBeVisible();
  for (let i = 0; i < 2; i++) {
    await open3D(page);
    const box = await stage(page).boundingBox();
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await expectModelShown(page);
    await openPhoto(page);
  }
  await expect(viewButton(page, '3D view')).toBeVisible();
  expect(errors).toEqual([]);
});
