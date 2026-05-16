import { expect, Page, test } from '@playwright/test';

async function completeConsent(page: Page) {
  await expect(page.getByLabel('I agree to participate')).toBeVisible();
  await page.getByLabel('I agree to participate').check();
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByText('Do you have children?')).toBeVisible();
}

test.describe('Experiment integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/e2e');
    await expect(page.getByRole('heading', { name: 'Test Experiment' })).toBeVisible();
  });

  test('blocks submit and shows validation error when required checkbox is unchecked', async ({ page }) => {
    await page.getByRole('button', { name: 'Start' }).click();
    await expect(page.getByText('This field is required')).toBeVisible();
    // Still on consent screen
    await expect(page.getByLabel('I agree to participate')).toBeVisible();
  });

  test('shows and hides conditional numeric input based on radio selection', async ({ page }) => {
    await completeConsent(page);
    await expect(page.getByLabel('How many children?')).not.toBeVisible();
    await page.getByLabel('Yes').click();
    await expect(page.getByLabel('How many children?')).toBeVisible();
    await page.getByLabel('No').click();
    await expect(page.getByLabel('How many children?')).not.toBeVisible();
  });

  test('routes to done screen directly when user selects No for children', async ({ page }) => {
    await completeConsent(page);
    await page.getByLabel('No').click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'All done!' })).toBeVisible();
    await expect(page.getByLabel("Children's names")).not.toBeVisible();
  });

  test('routes through children screen when user selects Yes for children', async ({ page }) => {
    await completeConsent(page);
    await page.getByLabel('Yes').click();
    await page.getByLabel('How many children?').fill('2');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByLabel("Children's names")).toBeVisible();
    await page.getByLabel("Children's names").fill('Alice, Bob');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'All done!' })).toBeVisible();
  });
});
