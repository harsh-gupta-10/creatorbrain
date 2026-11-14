import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Unit tests by default; end-to-end tests start a local Worker (npm run test:e2e)
    include: process.env.E2E ? ['tests/e2e/**/*.e2e.test.ts'] : ['tests/**/*.test.ts'],
    exclude: process.env.E2E ? [] : ['tests/e2e/**', 'node_modules/**'],
    testTimeout: process.env.E2E ? 30_000 : 5_000,
    hookTimeout: 120_000,
  },
});
