import { defineConfig, devices } from '@playwright/test';

// End-to-end tests drive the real site in a browser: the Vite client plus the API on a seeded in-memory
// MongoDB (what `npm run dev` starts when MONGODB_URI is empty), so they never touch live data. They always
// start their own pair on dedicated ports, so a dev server or another project on 5173/5000 is never tested by
// mistake; if those ports are taken the run fails with "already used" instead.
const WEB_PORT = 5199;
const API_PORT = 5198;
const baseURL = `http://localhost:${WEB_PORT}`;

export default defineConfig({
  testDir: 'e2e',
  // The journeys share one database, so they run one at a time and in file order.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: /phone\.spec/ },
    { name: 'phone', use: { ...devices['Pixel 7'] }, testMatch: /phone\.spec/ },
  ],
  webServer: {
    command: 'npm run dev',
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180_000,
    env: { MONGODB_URI: '', PORT: String(WEB_PORT), API_PORT: String(API_PORT) },
  },
});
