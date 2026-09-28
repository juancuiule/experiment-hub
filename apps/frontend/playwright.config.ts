import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  forbidOnly: !!process.env.CI,
  use: {
    baseURL: 'http://localhost:3000',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      // Experiment configs live in the backend DB and page.tsx fetches
      // them server-side, which route interception can't see — the suite
      // needs a real seeded backend, not just stubbed browser requests.
      // NB: playwright runs webServer commands from this config's directory
      // — pnpm dev:backend only exists at the workspace root, so call the
      // package scripts directly.
      command:
        'pnpm --filter @experiment-hub/backend seed && pnpm --filter @experiment-hub/backend dev',
      url: 'http://localhost:3100/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'pnpm dev',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
