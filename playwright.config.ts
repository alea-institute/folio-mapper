import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  reporter: 'list',
  webServer: {
    command: 'pnpm --filter @folio-mapper/web preview --host 127.0.0.1 --port 58174 --strictPort',
    url: 'http://127.0.0.1:58174',
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
