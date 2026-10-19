import { expect, test } from '@playwright/test';
import { signIn, users } from './helpers.js';

// A small solid PNG standing in for the rider's doorstep photo.
const DOOR_PHOTO = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

// One order through every role: the customer buys, the shop prepares it and hands it to a rider, and the rider
// delivers it. Leaves the browser signed in as the rider, and returns the order's number and page.
async function deliverNewOrder(page) {
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
  await expect(row.getByRole('button', { name: 'Ready for pickup' })).toBeVisible();
  await row.getByRole('button', { name: 'Ready for pickup' }).click();
  await expect(row.getByRole('button', { name: 'Ready for pickup' })).toBeHidden();

  // Dispatch weighs each rider's rating against their workload, so find whichever one has it.
  let card;
  for (const rider of users.riders) {
    await signIn(page, rider);
    await page.goto('/deliveries');
    await expect(page.getByRole('heading', { name: 'Deliveries', level: 1 })).toBeVisible();
    // Wait for the list (or its empty state) to load before counting, or a rider who has it looks empty.
    await expect(
      page
        .getByRole('button', { name: /^(Out for delivery|Mark delivered)$/ })
        .first()
        .or(page.getByText('Nothing to deliver')),
    ).toBeVisible();
    card = page.getByRole('listitem').filter({ hasText: orderNumber });
    if (await card.count()) break;
  }
  await expect(card).toHaveCount(1);
  await card.getByRole('button', { name: 'Out for delivery' }).click();
  // Delivering takes a photo of the parcel first.
  await card.getByRole('button', { name: 'Mark delivered' }).click();
  const dialog = page.getByRole('dialog', { name: /^Deliver / });
  await dialog.getByLabel('Photo at the door').setInputFiles({ name: 'door.png', mimeType: 'image/png', buffer: DOOR_PHOTO });
  await expect(dialog.getByRole('img', { name: 'Your photo at the door' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Mark delivered' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: orderNumber })).toHaveCount(0);
  return { orderNumber, orderPath };
}

test('an order goes from checkout to delivered across all four roles', async ({ page }) => {
  const { orderPath } = await deliverNewOrder(page);

  await signIn(page, users.customer);
  await page.goto(orderPath);
  await expect(page.getByRole('main')).toContainText('Delivered');

  // The rider marked it delivered, but the buyer is the one who says it arrived. Rating is open either way.
  await expect(page.getByRole('heading', { name: 'Did your order arrive?' })).toBeVisible();
  await page.getByRole('button', { name: 'Yes, I got it' }).click();
  await expect(page.getByRole('main')).toContainText('You confirmed this arrived');
  await page.getByRole('button', { name: /^Review / }).click();
  await expect(page.getByRole('dialog', { name: /^Review / })).toBeVisible();
});

test('a buyer can report a delivery that never arrived, and an admin settles it', async ({ page }) => {
  // Two full role journeys back to back: more than the default minute.
  test.setTimeout(150_000);
  const { orderNumber, orderPath } = await deliverNewOrder(page);

  await signIn(page, users.customer);
  await page.goto(orderPath);
  await page.getByRole('button', { name: 'Not received' }).click();
  await page.getByRole('textbox', { name: /What happened/ }).fill('Nobody came to the door.');
  await page.getByRole('button', { name: 'Report not received' }).click();
  await expect(page.getByRole('heading', { name: 'Reported as not received' })).toBeVisible();
  // Rating waits until an admin has looked into it.
  await expect(page.getByRole('button', { name: /^Review / })).toBeHidden();

  await signIn(page, users.admin);
  // "Not received" reports wait on the Complaints page with the rest of what buyers flagged.
  await page.goto('/admin/complaints');
  await page.getByRole('tab', { name: /^Not received/ }).click();
  const report = page.getByRole('listitem').filter({ hasText: orderNumber });
  await expect(report).toContainText('Not received');
  await report.getByRole('link', { name: orderNumber }).click();
  await page.getByRole('button', { name: 'Resolve…' }).click();
  await page.getByRole('dialog').getByRole('textbox', { name: 'Note' }).fill('Courier log shows a failed attempt. Re-sent.');
  await page.getByRole('dialog').getByRole('button', { name: 'Resolve' }).click();
  await expect(page.getByRole('heading', { name: 'Delivery report resolved' })).toBeVisible();

  await signIn(page, users.customer);
  await page.goto(orderPath);
  await expect(page.getByRole('main')).toContainText('Courier log shows a failed attempt');
  await expect(page.getByRole('button', { name: /^Review / })).toBeVisible();
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
