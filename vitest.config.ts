import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules', 'dist', 'web']
    },
    // Set environment variables for tests
    // EMBLEM_DEV_MODE enables X-Vault-Id header authentication bypass
    env: {
      EMBLEM_DEV_MODE: 'true'
    }
  }
});
