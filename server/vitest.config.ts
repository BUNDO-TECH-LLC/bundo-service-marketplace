import { defineConfig } from 'vitest/config';

const e2e = process.env.BUNDO_E2E === '1';

export default defineConfig({
  test: {
    environment: 'node',
    include: e2e ? ['src/**/*.e2e.test.ts'] : ['src/**/*.test.ts'],
    exclude: e2e ? ['**/node_modules/**'] : ['src/**/*.e2e.test.ts'],
    setupFiles: e2e ? ['./src/test/loadLocalEnv.ts'] : [],
    hookTimeout: e2e ? 60_000 : 10_000,
    testTimeout: e2e ? 60_000 : 10_000,
  },
});
