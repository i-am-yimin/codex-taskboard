import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    channel: process.env.CI ? undefined : 'chrome',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } },
    },
    {
      name: 'compact',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: [
    { command: 'pnpm dev:web', url: 'http://127.0.0.1:4173', reuseExistingServer: !process.env.CI },
    ...(process.env.TEST_DATABASE_URL
      ? [
          {
            command: 'pnpm exec tsx scripts/live-preview.ts',
            url: 'http://127.0.0.1:47830/api/v1/health',
            reuseExistingServer: !process.env.CI,
          },
        ]
      : []),
  ],
});
