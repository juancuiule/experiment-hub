import { expect } from '@playwright/test';
import { test } from './fixture';

// A checkpoint POST that fails must surface the error and keep the screen
// retryable — and the resubmission must resend the same visit seq so the
// backend treats it as a retry rather than a new visit.
test('a failed checkpoint POST surfaces an error and resubmits the same seq', async ({
  page,
}) => {
  const seqs: number[] = [];
  let attempts = 0;
  // More specific than the fixture's **/api/** catch-all, so it wins.
  await page.route('**/api/runs/*/checkpoints', (route) => {
    const body = route.request().postDataJSON() as { seq: number };
    seqs.push(body.seq);
    attempts += 1;
    if (attempts === 1) {
      return route.fulfill({ status: 500, body: 'nope' });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{"ok":true}',
    });
  });

  await page.goto('/e2e');
  await page.getByLabel('I agree to participate').check();
  await page.getByRole('button', { name: 'Start' }).click();
  await page.getByRole('radio', { name: 'No' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(
    page.getByRole('heading', { name: 'All done!' }),
  ).toBeVisible();

  // Finishing traverses to the end node and persists the synthesized "end"
  // checkpoint — the stubbed 500 keeps the last screen retryable.
  await page.getByRole('button', { name: 'Finish' }).click();
  await expect(
    page.getByText('Something went wrong while saving your answer'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Finish' })).toBeVisible();

  await page.getByRole('button', { name: 'Finish' }).click();
  await expect(
    page.getByText('Thanks for completing the experiment.'),
  ).toBeVisible();

  // Both attempts carried seq 0 — the run has exactly one visit.
  expect(seqs).toEqual([0, 0]);
});
