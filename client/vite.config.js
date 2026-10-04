import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Imported lazily (seller photo upload), so pre-bundle it up front instead of reloading the page on first use.
  optimizeDeps: { include: ['@imgly/background-removal'] },
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:5000' },
  },
  // three.js is one large chunk, but only the hero and the product 3D view load it.
  build: { chunkSizeWarningLimit: 1100 },
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
});
