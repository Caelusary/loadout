// Renders every seed product with the same procedural model the carousel uses and saves it to
// public/products/<slug>.webp. Needs `npm run dev` running (API + Vite) and Microsoft Edge or Chrome.
//   npm run shots
//   npm run shots -- glide-cloth-xl hush-frame-4k   (only these products)
//   SHOT_BASE=http://localhost:5173 BROWSER_PATH="C:\\...\\chrome.exe" npm run shots
import fs from 'node:fs/promises';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const BASE = process.env.SHOT_BASE ?? 'http://localhost:5173';
const OUT = path.resolve(import.meta.dirname, '../public/products');
const CANDIDATES = [
  process.env.BROWSER_PATH,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/microsoft-edge',
].filter(Boolean);

async function findBrowser() {
  for (const candidate of CANDIDATES) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // try the next one
    }
  }
  throw new Error('No Edge or Chrome found. Set BROWSER_PATH to a Chromium-based browser.');
}

const res = await fetch(`${BASE}/api/products?limit=48`);
if (!res.ok) throw new Error(`Could not list products from ${BASE}: ${res.status}. Is npm run dev running?`);
const { items } = await res.json();
const only = process.argv.slice(2);
const slugs = items.map((p) => p.slug).filter((s) => !only.length || only.includes(s));
await fs.mkdir(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: await findBrowser(),
  headless: true,
  // Software WebGL, so this works on machines and CI runners without a GPU.
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 800, height: 800, deviceScaleFactor: 1 });
  // Three angles per product: <slug>.webp, <slug>-2.webp, <slug>-3.webp. Transparent background.
  for (const slug of slugs) {
    for (const angle of [0, 1, 2]) {
      const file = angle === 0 ? `${slug}.webp` : `${slug}-${angle + 1}.webp`;
      await page.goto(`${BASE}/__shot?slug=${encodeURIComponent(slug)}&angle=${angle}`, { waitUntil: 'networkidle0' });
      await page.waitForFunction('window.__shotReady === true', { timeout: 60_000 });
      await page.screenshot({ path: path.join(OUT, file), type: 'webp', quality: 88, omitBackground: true });
    }
    console.log(`saved ${slug} (3 angles)`);
  }
} finally {
  await browser.close();
}
