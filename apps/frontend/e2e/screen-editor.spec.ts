import { expect, test } from '@playwright/test';

test('screen editor: outline select → label edit → live preview updates', async ({
  page,
}) => {
  await page.goto('/screens/emociones/intro');
  // The intro screen renders markdown content + a button.
  // Outline rows carry the `group` class (Tailwind marker).
  await page
    .locator('div.group')
    .filter({ hasText: 'rich-text' })
    .first()
    .click();
  const contentBox = page.locator('label:has-text("content") textarea');
  await expect(contentBox).toBeVisible();

  // Edit the content → preview re-renders.
  await contentBox.fill('# New headline\n\nEdited body text.');
  await contentBox.blur();
  await expect(
    page.getByRole('heading', { name: 'New headline' }),
  ).toBeVisible();
});

test('dataKey rename propagates to refs', async ({ page }) => {
  await page.goto('/screens/emociones/mirada');
  // Select the radio (answer) — dataKey input + options editor appear.
  await page
    .locator('div.group')
    .filter({ hasText: 'answer' })
    .first()
    .click();
  const dataKeyInput = page.locator('input[value="answer"]');
  await expect(dataKeyInput).toBeVisible();
  await dataKeyInput.fill('emotion-pick');
  await dataKeyInput.blur();
  // Outline row shows the renamed key
  await expect(page.locator('text=emotion-pick').first()).toBeVisible();
  // Undo restores
  await page.getByRole('button', { name: '← undo' }).click();
  await expect(page.locator('input[value="answer"]')).toBeVisible();
});
