import { test, expect, type Page } from '@playwright/test';

async function openDemo(page: Page, embedded = false) {
  await page.route('**/api/**', (route) => route.abort());
  await page.goto(`/?demo=1${embedded ? '&embedded=1' : ''}`);
  await expect(page.getByRole('heading', { name: '任务看板', exact: true })).toBeVisible();
}

async function checkAccountMenu(page: Page, width: number) {
  const accountMenu = page.getByLabel('账号菜单');
  await accountMenu.focus();
  await page.keyboard.press('Enter');
  await expect(accountMenu).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('menu')).toBeVisible();
  await expect(page.getByRole('menuitem').first()).toBeFocused();
  for (const control of await page.getByRole('menuitem').all()) {
    const box = (await control.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
  }
  if (width === 360 || width === 480)
    await page.screenshot({ path: test.info().outputPath(`account-menu-${width}.png`) });
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem').nth(1)).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(accountMenu).toHaveAttribute('aria-expanded', 'false');
  await expect(accountMenu).toBeFocused();
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
      .locator(
        '.topbar button:visible, .head-actions button:visible, .toolbar input:visible, .toolbar select:visible',
      )
      .all()) {
      const box = await control.boundingBox();
      const controlDescription = `${width}px: ${await control.textContent()}`;
      expect(box).not.toBeNull();
      expect(box!.x, controlDescription).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    }
    await checkAccountMenu(page, width);
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

test('account menu remains inside narrow embedded windows with keyboard access', async ({
  page,
}) => {
  await openDemo(page, true);
  for (const width of [360, 420]) {
    await page.setViewportSize({ width, height: 560 });
    await checkAccountMenu(page, width);
  }
});

test('demo personal settings explain account limits and retain appearance preview', async ({
  page,
}) => {
  await openDemo(page);
  await page.getByLabel('账号菜单').click();
  await expect(page.getByRole('menuitem', { name: '服务器管理', exact: true })).toHaveCount(0);
  await page.getByRole('menuitem', { name: '个人设置', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('演示账号未连接服务器');
  await expect(page.getByText('正在检查账号服务…')).toHaveCount(0);
  await page.getByRole('button', { name: '预览外观与主题', exact: true }).click();
  await expect(page.locator('.appearance-settings')).toBeVisible();
  await expect(page.locator('.appearance-settings [role=status]')).toContainText('演示模式');
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
