import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
