import request from 'supertest';
import { afterAll, beforeAll } from 'vitest';
import { createApp } from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { seed } from '../src/seed/seed.js';
import { products, users } from '../src/seed/data.js';

export const app = createApp();

// Fresh seeded in-memory database per test file.
export function useSeededDb() {
  beforeAll(async () => {
    await connectDB('');
    await seed();
  });
  afterAll(disconnectDB);
}

export async function signIn(key) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ email: users[key].email, password: 'password123' });
  if (res.status !== 200) throw new Error(`Could not sign in as ${key}: ${res.status}`);
  return agent;
}

// Seed product by its 1-based number in data.js.
export const productId = (n) => products[n - 1]._id.toString();

export const address = {
  fullName: 'Mika Reyes',
  line1: 'Unit 12B, 88 Kalayaan Ave',
  city: 'Quezon City',
  province: 'Metro Manila',
  postalCode: '1101',
  phone: '09171234567',
};
