import fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { UPLOAD_DIR } from '../src/lib/storage.js';
import { signIn, useSeededDb } from './helpers.js';

useSeededDb();

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
const exists = (url) =>
  fs.access(path.join(UPLOAD_DIR, path.basename(url))).then(
    () => true,
    () => false,
  );

const productBody = (images) => ({
  name: `Test board ${Math.random().toString(36).slice(2, 8)}`,
  brand: 'Testco',
  category: 'keyboard',
  description: 'A keyboard made for the upload ownership test.',
  priceCents: 100000,
  stock: 3,
  images,
});

// Every file this suite writes to the real uploads folder, removed after each test so runs leave nothing behind.
const written = [];
afterEach(async () => {
  const urls = written.splice(0);
  await Promise.all(urls.map((url) => fs.rm(path.join(UPLOAD_DIR, path.basename(url)), { force: true })));
});

async function uploadImage(agent) {
  const res = await agent.post('/api/uploads').attach('file', PNG, 'photo.png');
  expect(res.status).toBe(201);
  if (res.body.url?.startsWith('/api/files/')) written.push(res.body.url);
  return res.body;
}

describe('stored file cleanup', () => {
  it("never deletes a file another seller's product still uses", async () => {
    const victim = await signIn('northpaw');
    const attacker = await signIn('glide');

    const theirs = await uploadImage(victim);
    const created = await victim.post('/api/products').send(productBody([{ url: theirs.url, alt: 'Front' }]));
    expect(created.status).toBe(201);

    const mine = await uploadImage(attacker);
    // Reference the victim's file (and forge a publicId pointing at it), then drop it from the product.
    const own = await attacker.post('/api/products').send(
      productBody([
        { url: mine.url, alt: 'Front' },
        { url: theirs.url, publicId: theirs.publicId, alt: 'Borrowed' },
      ]),
    );
    expect(own.status).toBe(201);
    const patched = await attacker
      .patch(`/api/products/${own.body.product._id}`)
      .send({ images: [{ url: mine.url, publicId: theirs.publicId, alt: 'Front' }] });
    expect(patched.status).toBe(200);
    expect(await exists(theirs.url)).toBe(true);

    // Deleting the whole product must not take the victim's file with it either.
    const deleted = await attacker.delete(`/api/products/${own.body.product._id}`);
    expect(deleted.body).toEqual({ deleted: true });
    expect(await exists(theirs.url)).toBe(true);
    expect(await exists(mine.url)).toBe(false);
  });
});

describe('upload type checks', () => {
  it('rejects a non-image renamed to .png', async () => {
    const seller = await signIn('northpaw');
    const fake = Buffer.from('<html><script>alert(1)</script></html>');
    const res = await seller.post('/api/uploads').attach('file', fake, 'evil.png');
    expect(res.status).toBe(400);
  });

  it('turns away other file types by name, before reading them', async () => {
    const seller = await signIn('northpaw');
    const res = await seller.post('/api/uploads').attach('file', Buffer.from('MZ'), 'setup.exe');
    expect(res.status).toBe(400);
    expect(res.body.error.fields.file).toMatch(/JPG, PNG or WebP/);
  });

  it('stores an image under the type its bytes say, not its name', async () => {
    const seller = await signIn('northpaw');
    const res = await seller.post('/api/uploads').attach('file', PNG, 'photo.jpg');
    expect(res.status).toBe(201);
    written.push(res.body.url);
    expect(res.body.url).toMatch(/\.png$/);
  });
});
