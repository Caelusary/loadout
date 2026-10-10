import { expect, test } from '@playwright/test';
import { signIn, users } from './helpers.js';

// One order through every role: the customer buys, the shop prepares it and hands it to a rider, the
// rider delivers it, and the customer sees it delivered.
test('an order goes from checkout to delivered across all four roles', async ({ page }) => {
  await signIn(page, users.customer);
  await page.goto('/p/lumen-stream-cam');
  await page.getByRole('button', { name: 'Buy now' }).click();
  await expect(page.getByRole('heading', { name: 'Checkout', level: 1 })).toBeVisible();
  await expect(page.getByRole('radio', { name: /Cash on delivery/ })).toBeChecked();
  await page.getByRole('button', { name: 'Place order' }).click();

  await expect(page.getByRole('heading', { name: 'Your order is placed' })).toBeVisible();
  const orderLink = page.getByRole('main').getByRole('link', { name: /#[0-9A-F]{6}/ });
  const orderNumber = (await orderLink.innerText()).match(/#[0-9A-F]{6}/)[0];
  const orderPath = await orderLink.getAttribute('href');

  await signIn(page, users.seller);
  await page.goto('/seller/orders');
  // The page opens on the Placed tab, which the order leaves once it is processing.
  await page.getByRole('tab', { name: 'All' }).click();
  const row = page.getByRole('row', { name: orderNumber });
  await row.getByRole('button', { name: 'Start processing' }).click();
  await expect(row.getByRole('button', { name: 'Hand to rider' })).toBeVisible();
  await row.getByRole('button', { name: 'Hand to rider' }).click();
  await expect(row.getByRole('button', { name: 'Hand to rider' })).toBeHidden();

  // Dispatch gives the order to the least-busy rider, so find whichever one has it.
  let card;
  for (const rider of users.riders) {
    await signIn(page, rider);
    await page.goto('/deliveries');
    await expect(page.getByRole('heading', { name: 'Deliveries', level: 1 })).toBeVisible();
    card = page.getByRole('listitem').filter({ hasText: orderNumber });
    if (await card.count()) break;
  }
  await expect(card).toHaveCount(1);
  await card.getByRole('button', { name: 'Out for delivery' }).click();
  await card.getByRole('button', { name: 'Mark delivered' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: orderNumber })).toHaveCount(0);

  await signIn(page, users.customer);
  await page.goto(orderPath);
  await expect(page.getByRole('main')).toContainText('Delivered');
});

test('a customer can cancel an order before the shop starts on it', async ({ page }) => {
  await signIn(page, users.customer);
  await page.goto('/p/lumen-stream-cam');
  await page.getByRole('button', { name: 'Buy now' }).click();
  await page.getByRole('button', { name: 'Place order' }).click();
  await page
    .getByRole('main')
    .getByRole('link', { name: /#[0-9A-F]{6}/ })
    .click();

  await page.getByRole('button', { name: 'Cancel order' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel order' }).click();
  await expect(page.getByRole('main')).toContainText('Cancelled');
  await expect(page.getByRole('button', { name: 'Cancel order' })).toBeHidden();
});
