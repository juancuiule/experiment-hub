import { expect, test } from '@playwright/test';

test.describe('codebook route', () => {
  test('renders the codebook with sections and download buttons', async ({
    page,
  }) => {
    await page.goto('/experiments/pecados/codebook');

    await expect(
      page.getByRole('heading', { name: 'Codebook — pecados' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Collected variables' }),
    ).toBeVisible();

    // At least one variable row renders.
    await expect(page.locator('table tbody tr').first()).toBeVisible();

    // Export affordances exist.
    await expect(
      page.getByRole('button', { name: 'Download Markdown' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Download CSV' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Download JSON' }),
    ).toBeVisible();
  });

  test('returns 404 for an unknown experiment slug', async ({ page }) => {
    const res = await page.goto('/experiments/does-not-exist/codebook');
    expect(res?.status()).toBe(404);
  });
});
