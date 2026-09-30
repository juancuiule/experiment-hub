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

test('canvas: click-select + inline text edit + drag reorder', async ({
  page,
}) => {
  await page.goto('/screens/experiment/psychoactive-options');

  // Click the checkboxes component on the canvas → inspector selects it.
  await page.locator('[data-comp-path="[1]"]').click();
  await expect(
    page.locator('input[value="psychoactive-substances"]'),
  ).toBeVisible();

  // Double-click the rich-text → inline edit; blur commits.
  await page.locator('[data-comp-path="[0]"]').dblclick();
  const inline = page.locator('[data-comp-path="[0]"] textarea');
  await expect(inline).toBeVisible();
  await inline.fill('### ¿Pregunta editada?');
  await page.locator('h1').click(); // blur → commit
  await expect(
    page.getByRole('heading', { name: '¿Pregunta editada?' }),
  ).toBeVisible();

  // Hover the conditional → drag its handle above the rich-text → row 0.
  const firstRow = page.locator('div.group').first();
  await expect(firstRow).toContainText('rich-text');
  await page.locator('[data-comp-path="[2]"]').hover();
  await page
    .locator('[data-comp-path="[2]"] [data-drag-handle]')
    .dragTo(page.locator('[data-comp-path="[0]"]'), {
      targetPosition: { x: 12, y: 4 },
    });
  await expect(page.locator('div.group').first()).toContainText('conditional');
});

test('answers persist across screens ($$ refs resolve to them)', async ({
  page,
}) => {
  await page.goto('/screens/experiment/psychoactive-options');
  await page.locator('#psychoactive-substances-alcohol').click();
  await expect(
    page.locator('code', { hasText: '"psychoactive-substances":["alcohol"]' }),
  ).toBeVisible();

  // The downstream screen's for-each iterates $$psychoactive-options.* —
  // it should render ONLY the checked substance (scope to the preview form —
  // the inspector's dict datalist also contains 'Marihuana').
  await page.goto('/screens/experiment/psychoactive-quarantine-change');
  await expect(
    page.locator('form').getByText('Alcohol').first(),
  ).toBeVisible();
  await expect(page.locator('form').getByText('Marihuana')).toHaveCount(0);
});
