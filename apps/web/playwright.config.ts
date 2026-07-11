/**
 * Playwright E2E config (Day 8 Wave 2a, ADR-012).
 *
 * Boots BOTH servers:
 *  - api on :3001 with REPLICATE_MOCK=1 (canned image, everything else real)
 *    and in-memory Redis (fresh quota state per run; backend parity is
 *    proven separately by the Wave 1 contract test — see ADR-011/012).
 *  - web on :3000 (real Supabase anonymous auth — auth is deliberately
 *    NOT mocked; Day 2 proved auth is where production surprises live).
 *
 * Requires env (see .env.e2e.example): NEXT_PUBLIC_SUPABASE_URL,
 * NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_API_URL, SUPABASE_URL,
 * SUPABASE_ANON_KEY. The anon key is public by nature (shipped in the
 * client bundle) — safe for CI secrets.
 */
import { defineConfig, devices } from '@playwright/test';

const WEB_PORT = 3000;
const API_PORT = 3001;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // quota test depends on per-context ordering
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm run dev --workspace=@styleme/api',
      cwd: '../..',
      port: API_PORT,
reuseExistingServer: false,
      timeout: 60_000,
      env: {
        NODE_ENV: 'test',
        REPLICATE_MOCK: '1',
        REPLICATE_API_TOKEN: 'e2e-dummy-token-never-called',
        // Real Supabase for JWT verification (JWKS). Service role key is
        // intentionally ABSENT: generations insert self-skips (logged),
        // keeping E2E runs out of the real generations table.
        SUPABASE_URL: process.env.SUPABASE_URL ?? '',
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ?? '',
        // No Upstash vars → in-memory Redis (fresh state per run).
        LOG_LEVEL: 'warn',
        FRONTEND_URL: `http://localhost:${WEB_PORT}`,
        PORT: String(API_PORT),
      },
    },
    {
      command: 'npm run dev --workspace=@styleme/web',
      cwd: '../..',
      port: WEB_PORT,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? `http://localhost:${API_PORT}`,
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
        NEXT_PUBLIC_AD_PROVIDER: 'off',
      },
    },
  ],
});
