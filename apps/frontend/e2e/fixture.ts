import { test as base } from '@playwright/test';

// E2E runs the frontend without apps/backend. Run registration and
// checkpoint POSTs must succeed for flows to reach their end state, so every
// spec intercepts /api/** and returns the backend's response shapes.
//
// The stub is happy-path only: it doesn't validate X-Run-Token or track seq,
// so it can't catch auth/ordering regressions — those live in unit tests.
// Specs that need a failure can page.route() a more specific pattern; later
// routes take precedence.
export const test = base.extend({
  page: async ({ page }, provide) => {
    await page.route('**/api/**', (route) => {
      const { pathname } = new URL(route.request().url());
      const json = (body: unknown) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(body),
        });
      if (pathname === '/api/runs') {
        return json({ runId: 'e2e-run', token: 'e2e-token' });
      }
      if (route.request().method() === 'POST') return json({ ok: true });
      return json({ status: 'ok' });
    });
    await provide(page);
  },
});
