/**
 * Vitest config for @styleme/api.
 *
 * `env` below is applied BEFORE test modules load — src/env.ts is
 * import-time fail-fast (Zod + process.exit), so REPLICATE_API_TOKEN must
 * exist by then. NODE_ENV=test keeps prod strictness off. Real values from
 * the developer shell (e.g. TEST_UPSTASH_*) are NOT overridden — Vitest
 * merges, it doesn't replace.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    env: {
      NODE_ENV: 'test',
      REPLICATE_API_TOKEN: 'test-token-not-used-by-unit-tests',
      LOG_LEVEL: 'error',
    },
    // Upstash contract tests hit a real network service.
    testTimeout: 30_000,
  },
});
