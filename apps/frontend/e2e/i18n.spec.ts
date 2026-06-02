import { expect, Page, test } from '@playwright/test';

// Walks the i18n-demo experiment end-to-end, asserting that copy is localized
// from the dictionary and that a name collected on the first screen is piped
// (via {{ }} inside a [[ ]] message) into the final thank-you screen.
async function runFlow(page: Page, name: string) {
  await page.getByRole('textbox').fill(name);
}

test.describe('i18n dictionary', () => {
  test('renders Spanish copy by default (no ?lang)', async ({ page }) => {
    await page.goto('/experiments/i18n-demo');
    await expect(
      page.getByRole('button', { name: 'Empezar' }),
    ).toBeVisible();
  });

  test('renders English copy with ?lang=en', async ({ page }) => {
    await page.goto('/experiments/i18n-demo?lang=en');
    await expect(page.getByRole('button', { name: 'Start' })).toBeVisible();
  });

  test('falls back to default locale for an unknown ?lang', async ({
    page,
  }) => {
    await page.goto('/experiments/i18n-demo?lang=fr');
    await expect(
      page.getByRole('button', { name: 'Empezar' }),
    ).toBeVisible();
  });

  test('pipes the collected name into a localized message (English)', async ({
    page,
  }) => {
    await page.goto('/experiments/i18n-demo?lang=en');
    await runFlow(page, 'Ada');
    await page.getByRole('button', { name: 'Start' }).click();

    // Survey question greets the participant by name.
    await expect(page.getByText('Hi Ada, how clear was this?')).toBeVisible();
    await page.getByRole('radio', { name: 'Very clear' }).click();
    await page.getByRole('button', { name: 'Submit' }).click();

    // Thank-you body pipes the name again, in the active locale.
    await expect(page.getByText('All done, Ada.')).toBeVisible();
  });

  test('pipes the collected name into a localized message (Spanish)', async ({
    page,
  }) => {
    await page.goto('/experiments/i18n-demo?lang=es');
    await runFlow(page, 'Ana');
    await page.getByRole('button', { name: 'Empezar' }).click();

    await expect(
      page.getByText('Hola Ana, ¿qué tan claro fue esto?'),
    ).toBeVisible();
    await page.getByRole('radio', { name: 'Muy claro' }).click();
    await page.getByRole('button', { name: 'Enviar' }).click();

    await expect(page.getByText('Listo, Ana.')).toBeVisible();
  });
});
