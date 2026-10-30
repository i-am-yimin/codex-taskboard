import { test, expect, type Page } from '@playwright/test';

async function openDemo(page: Page, embedded = false) {
  await page.route('**/api/**', (route) => route.abort());
  await page.goto(`/?demo=1${embedded ? '&embedded=1' : ''}`);
  await expect(page.getByRole('heading', { name: '任务看板', exact: true })).toBeVisible();
}

test('independent windows reflow readable columns and filters while preserving short-window access', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openDemo(page);
  for (const width of [980, 900, 760, 560, 480]) {
    await page.setViewportSize({ width, height: width === 480 ? 560 : 680 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    const columns = await page.locator('.column').evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return { x: rect.x, y: rect.y, right: rect.right, width: rect.width };
      }),
    );
    expect(columns).toHaveLength(4);
    expect(columns.some((column) => column.y > columns[0].y + 20)).toBe(true);
    for (const column of columns) {
      expect(column.x).toBeGreaterThanOrEqual(0);
      expect(column.right).toBeLessThanOrEqual(width);
      expect(column.width).toBeGreaterThanOrEqual(260);
    }
    for (const control of await page
      .locator('.topbar button, .head-actions button, .toolbar input, .toolbar select')
      .all()) {
      const box = await control.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    }
    if (width <= 800) {
      const search = await page.locator('.search').boundingBox();
      for (const filter of await page.locator('.toolbar select').all()) {
        const box = (await filter.boundingBox())!;
        expect(box.width).toBeGreaterThanOrEqual(120);
        expect(box.y).toBeGreaterThanOrEqual(search!.y + search!.height);
      }
    }
    if (width === 480) expect(columns[0].y).toBeLessThan(520);
  }
  await page.setViewportSize({ width: 480, height: 480 });
  await page.locator('[data-motion-id="t-27"]').click();
  const drawer = page.getByRole('dialog', { name: '任务详情', exact: true });
  const close = drawer.getByRole('button', { name: '关闭', exact: true });
  await expect(close).toBeVisible();
  await expect
    .poll(() => drawer.evaluate((element) => element.scrollWidth <= element.clientWidth))
    .toBe(true);
  const comment = drawer.getByRole('textbox', { name: '评论', exact: true });
  await comment.scrollIntoViewIfNeeded();
  await comment.fill('低高窗口仍可编辑的合成草稿');
  await expect(comment).toBeInViewport();
  await close.scrollIntoViewIfNeeded();
  await close.click();
  await expect(drawer).toHaveCount(0);
  await page.getByRole('button', { name: '列表', exact: true }).click();
  const rows = page.locator('.list-row');
  await expect(rows).toHaveCount(5);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
});

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test(`reflowed board keeps keyboard target and cancel focus (${reducedMotion})`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion });
    await page.setViewportSize({ width: 760, height: 1000 });
    await openDemo(page);
    const card = page.locator('[data-motion-id="t-27"]');
    const originalColumn = page.locator('.column').filter({ has: card });
    await expect(originalColumn.locator('.column-head')).toContainText('进行中');
    await card.focus();
    await page.keyboard.press('Space');
    await expect(page.locator('.task-drag-overlay')).toBeVisible();
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('.column[data-drop-target="true"] .column-head')).toContainText(
      '待办',
    );
    await page.keyboard.press('Escape');
    await expect(page.locator('.task-drag-overlay')).toHaveCount(0);
    await expect(card).toBeFocused();
    await expect(originalColumn.locator('.column-head')).toContainText('进行中');
    await expect(page.locator('[data-dragging="true"]')).toHaveCount(0);
  });
}
