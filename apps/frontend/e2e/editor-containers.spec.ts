import { expect, test, type Page } from '@playwright/test';

const MEMBER = '[data-id="screen-energy-sleep-mood"]';
const MEMBER_LAST = '[data-id="screen-mind-stress-body"]';
const FRAME = '[data-id="path-questions"]';

const box = async (page: Page, sel: string) => {
  const b = await page.locator(sel).boundingBox();
  if (!b) throw new Error(`no box for ${sel}`);
  return b;
};

/** Scan the node's box for a point where elementFromPoint lands inside it —
 *  nodes can be stacked under neighbours after a drop. */
const grabPoint = async (page: Page, sel: string) => {
  const b = await box(page, sel);
  for (let gy = 0.15; gy <= 0.9; gy += 0.15) {
    for (let gx = 0.15; gx <= 0.9; gx += 0.15) {
      const x = b.x + b.width * gx;
      const y = b.y + b.height * gy;
      const inside = await page.evaluate(
        ([px, py, s]) =>
          !!document.elementFromPoint(px, py)?.closest(s),
        [x, y, sel] as [number, number, string],
      );
      if (inside) return { x, y };
    }
  }
  throw new Error(`no uncovered point inside ${sel}`);
};

const dragNode = async (
  page: Page,
  sel: string,
  dx: number,
  dy: number,
) => {
  const p = await grabPoint(page, sel);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x + dx, p.y + dy, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(400);
};

/** Drag `sel` so its CENTER lands at `to` — grabs at a verified point and
 *  compensates for the grab offset (needed for tall nodes). */
const dragNodeCenterTo = async (
  page: Page,
  sel: string,
  to: { x: number; y: number },
) => {
  const p = await grabPoint(page, sel);
  const b = await box(page, sel);
  const center = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(
    to.x + (p.x - center.x),
    to.y + (p.y - center.y),
    { steps: 12 },
  );
  await page.mouse.up();
  await page.waitForTimeout(400);
};

const publishedFlow = async (page: Page) => {
  // The draft rebuilds after drags — wait for the UI to settle before the
  // click so the button isn't mid-relayout.
  await page.waitForTimeout(600);
  const download = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Download JSON' })
    .click({ timeout: 15_000 });
  const path = await (await download).path();
  const { readFileSync } = await import('fs');
  return JSON.parse(readFileSync(path, 'utf8')) as {
    edges: { type: string; from: string; to: string }[];
  };
};

test('container frame grows, shrinks, and members can leave/rejoin', async ({
  page,
}) => {
  await page.goto('/nodes/ejercicio-1');
  await page.waitForSelector('.react-flow__node');
  await page.waitForTimeout(500);

  const member = page.locator(MEMBER);
  await expect(member).toBeVisible();

  const frame0 = await box(page, FRAME);

  // 1. Drag the LAST member right so its edge pokes past the border while
  //    the center stays inside (a bigger drag escapes; a left-of-last drag
  //    would reorder) → frame grows.
  await dragNode(page, MEMBER_LAST, 60, 0);
  const frame1 = await box(page, FRAME);
  expect(frame1.width).toBeGreaterThan(frame0.width + 20);

  // 2. Drag it back inward → frame shrinks back toward layout size.
  await dragNode(page, MEMBER_LAST, -60, 0);
  const frame2 = await box(page, FRAME);
  expect(frame2.width).toBeLessThanOrEqual(frame0.width + 40);

  // 3. Drag member clearly out (center >12px past border) → unparented.
  const f2 = await box(page, FRAME);
  await dragNode(page, MEMBER, f2.width + 160, 0);
  const flow = await publishedFlow(page);
  expect(
    flow.edges.some(
      (e) => e.type === 'path-contains' && e.to === 'screen-energy-sleep-mood',
    ),
  ).toBe(false);

  // 4. Drag it back onto the frame → rejoins as a member.
  // First deselect — the inspector panel overlays the top-right of the canvas
  // and would eat the mousedown if the member landed under it.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  const f3 = await box(page, FRAME);
  await dragNodeCenterTo(page, MEMBER, {
    x: f3.x + f3.width / 2,
    y: f3.y + f3.height - 20,
  });
  const flow2 = await publishedFlow(page);
  expect(
    flow2.edges.some(
      (e) => e.type === 'path-contains' && e.to === 'screen-energy-sleep-mood',
    ),
  ).toBe(true);
});

test('dragging a member across a sibling reorders the path', async ({
  page,
}) => {
  await page.goto('/nodes/ejercicio-1');
  await page.waitForSelector('.react-flow__node');
  await page.waitForTimeout(500);

  const orderOf = async () => {
    const flow = await publishedFlow(page);
    return flow.edges
      .filter(
        (e) =>
          e.type === 'path-contains' && e.from === 'path-questions',
      )
      .map((e) => `${e.to}:${(e as { order?: number }).order}`);
  };

  // energy-sleep-mood (order 0) center dragged past mind-stress-body's
  // center while staying inside the frame → becomes order 1.
  const last = await box(page, '[data-id="screen-mind-stress-body"]');
  await dragNodeCenterTo(page, MEMBER, {
    x: last.x + last.width - 20,
    y: last.y + 60,
  });

  const order = await orderOf();
  expect(order).toContain('screen-energy-sleep-mood:1');
  expect(order).toContain('screen-mind-stress-body:0');
});

test('loop template member can leave and rejoin', async ({ page }) => {
  await page.goto('/nodes/emociones');
  await page.waitForSelector('.react-flow__node');
  await page.waitForTimeout(500);

  const member = '[data-id="screen-mirada"]';
  await expect(page.locator(member)).toBeVisible();
  const f0 = await box(page, '[data-id="loop-miradas"]');

  // Drag the loop member fully out → loop-template edge removed.
  await dragNode(page, member, f0.width + 220, 0);
  const flow = await publishedFlow(page);
  expect(
    flow.edges.some(
      (e) => e.type === 'loop-template' && e.to === 'screen-mirada',
    ),
  ).toBe(false);

  // Drop it overlapping the frame → becomes the loop's template again.
  // Escape closes the inspector — it can overlay nodes in the top-right.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  const f1 = await box(page, '[data-id="loop-miradas"]');
  // Grab a point verified to hit the member (it may be stacked under
  // another node), and drop it overlapping the frame's lower edge.
  await dragNodeCenterTo(page, member, {
    x: f1.x + f1.width / 2,
    y: f1.y + f1.height - 20,
  });
  const flow2 = await publishedFlow(page);
  expect(
    flow2.edges.some(
      (e) => e.type === 'loop-template' && e.to === 'screen-mirada',
    ),
  ).toBe(true);
});
