import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

// The headers Vercel sends (vercel.json), applied to `vite preview` too, rule by rule for each path, so a production
// build is tested under the same Content-Security-Policy it ships with (the page's, and the background-removal
// worker's own). Not in dev: Vite's dev server injects inline scripts. Our sources are plain regular expressions.
const headerRules = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8')).headers.map(
  ({ source, headers }) => ({ match: new RegExp(`^${source}$`), headers }),
);
const siteHeaders = () => ({
  name: 'site-headers',
  configurePreviewServer(server) {
    server.middlewares.use((req, res, next) => {
      const path = req.url.split('?')[0];
      for (const rule of headerRules) {
        if (rule.match.test(path)) for (const { key, value } of rule.headers) res.setHeader(key, value);
      }
      next();
    });
  },
});

// The fonts the first screen draws with: headings, body text, and buttons and labels. Preloaded so they arrive with
// the CSS instead of after it; each one that arrives late makes the browser lay out every line of text again.
// The build hashes font file names, so the tags are added from the finished bundle rather than written by hand.
const FIRST_SCREEN_FONTS = [/chakra-petch-latin-700-normal-.*.woff2$/, /ibm-plex-sans-latin-(400|500)-normal-.*.woff2$/];
const preloadFonts = () => ({
  name: 'preload-fonts',
  apply: 'build',
  transformIndexHtml(html, { bundle }) {
    const files = Object.keys(bundle ?? {}).filter((f) => FIRST_SCREEN_FONTS.some((re) => re.test(f)));
    return files.map((f) => ({
      tag: 'link',
      attrs: { rel: 'preload', href: `/${f}`, as: 'font', type: 'font/woff2', crossorigin: '' },
      injectTo: 'head-prepend',
    }));
  },
});

export default defineConfig({
  plugins: [react(), tailwindcss(), preloadFonts(), siteHeaders()],
  // The background-removal worker loads the library in pieces, which needs module workers.
  worker: { format: 'es' },
  // Imported lazily (seller photo upload), so pre-bundle it up front instead of reloading the page on first use.
  optimizeDeps: { include: ['@imgly/background-removal'] },
  server: {
    // A preview tool may assign PORT when 5173 is taken.
    port: Number(process.env.PORT) || 5173,
    // An assigned port must be exact, or a test runner would wait on one port while Vite drifted to the next.
    strictPort: Boolean(process.env.PORT),
    // The API reads API_PORT locally too, so the e2e suite can run its own pair beside a dev server.
    proxy: { '/api': `http://localhost:${process.env.API_PORT || 5000}` },
  },
  // three.js is one large chunk, but only the hero and the product 3D view load it.
  build: { chunkSizeWarningLimit: 1100 },
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
});
