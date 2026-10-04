import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Each file starts its own in-memory replica set; running them one at a time keeps memory use sane.
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 120000,
    env: { NODE_ENV: 'test' },
  },
});
