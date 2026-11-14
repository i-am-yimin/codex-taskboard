import { test, expect, type Page } from '@playwright/test';
import { consoleFixture } from '../fixtures/console-layout';

async function fiveStatusFixture(
  page: Page,
  origin: string,
  theme: string,
  mode = 'light',
  empty = false,
  desktop = true,
) {
  const fixture = await consoleFixture(page, origin, { desktop, theme, mode });
  fixture.board.space.name = '用于验证桌面导航和实际内容宽度的很长中文空间名称';
  fixture.board.statuses.push({
    ...fixture.board.statuses[0],
    id: 's-cancelled',
    name: '已取消',
    semantic: 'cancelled',
    position: 5,
  });
  if (empty) fixture.board.tasks = [];
  else
    fixture.board.tasks[0].title =
      '需要跨行阅读的很长中文任务标题，用来验证重排后任务内容仍然完整显示并且可以通过键盘访问';
  return fixture;
}

async function expectBoardFits(page: Page, width: number) {
  await expect
    .poll(() =>
      page.locator('.board').evaluate((board) => board.scrollWidth <= board.clientWidth + 1),
    )
    .toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const columns = await page.locator('.column').evaluateAll((items) =>
    items.map((item) => {
      const box = item.getBoundingClientRect();
      return { x: box.x, right: box.right, width: box.width, y: Math.round(box.y) };
    }),
  );
  expect(columns).toHaveLength(5);
  for (const column of columns) {
    expect(column.x).toBeGreaterThanOrEqual(0);
    expect(column.right).toBeLessThanOrEqual(width + 1);
    expect(column.width).toBeGreaterThanOrEqual(Math.min(260, width - 24));
  }
  return columns;
}

for (const theme of ['glass', 'paper', 'studio', 'island']) {
  test(`five statuses reflow within the available workspace (${theme})`, async ({
    page,
    baseURL,
  }, info) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await fiveStatusFixture(page, new URL(baseURL!).origin, theme);
    await page.goto('/');
    for (const width of [1920, 1440, 1320, 1201, 980, 761, 760, 480]) {
      await page.setViewportSize({ width, height: width === 480 ? 560 : 860 });
      const columns = await expectBoardFits(page, width);
      if (width === 1320) {
        expect(columns.filter((column) => column.y === columns[0].y)).toHaveLength(4);
        expect(columns[4].y).toBeGreaterThan(columns[0].y);
      }
      if (width === 1920) expect(new Set(columns.map((column) => column.y)).size).toBe(1);
      for (const control of await page
        .locator('.topbar button:visible, .head-actions button:visible')
        .all()) {
        const box = (await control.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
      const railVisible = (theme === 'studio' || theme === 'island') && width >= 761;
      if (railVisible) {
        await expect(page.getByRole('complementary', { name: '看板导航' })).toBeVisible();
        await expect(page.locator('.head-view-switch')).toBeHidden();
      } else {
        await expect(page.locator('.rail')).toBeHidden();
        await expect(page.locator('.head-view-switch')).toBeVisible();
      }
      if (theme === 'studio' && [1320, 480].includes(width))
        await page.screenshot({
          path: info.outputPath(`studio-light-${width}.png`),
          fullPage: true,
        });
    }
    const add = page
      .locator('.column')
      .last()
      .getByRole('button', { name: '添加任务', exact: true });
    await add.scrollIntoViewIfNeeded();
    await add.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: '新建任务', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '关闭', exact: true }).click();
    await page.setViewportSize({ width: 1320, height: 860 });
    const list = page.getByRole('button', { name: '任务列表', exact: true });
    if (theme === 'studio' || theme === 'island') await list.click();
    else await page.getByRole('button', { name: '列表', exact: true }).click();
    await expect(page.getByRole('heading', { name: '任务列表', exact: true })).toBeVisible();
  });
}

test('space and local settings have distinct scopes and return keyboard focus', async ({
  page,
  baseURL,
}, info) => {
  await fiveStatusFixture(page, new URL(baseURL!).origin, 'studio');
  await page.goto('/');
  await expect(page.getByRole('button', { name: '账号菜单', exact: true })).toHaveCount(1);
  await expect(page.locator('.rail button')).toHaveCount(2);
  const space = page.getByRole('button', { name: /^空间菜单：/, includeHidden: true });
  await space.focus();
  await page.keyboard.press('Enter');
  await expect(space).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(space).toBeFocused();
  const account = page.getByRole('button', { name: '账号菜单', exact: true });
  await account.click();
  await page.getByRole('menuitem', { name: '连接与本机', exact: true }).click();
  const connection = page.getByRole('dialog', { name: '连接与本机', exact: true });
  await expect(connection.getByRole('region', { name: 'Codex 桌面接入' })).toBeVisible();
  await expect(connection.getByRole('navigation', { name: '空间设置分类' })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('connection-settings-desktop.png') });
  await page.keyboard.press('Escape');
  await expect(connection).toHaveCount(0);
  await expect(account).toBeFocused();
  await space.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('End');
  await expect(page.getByRole('menuitem', { name: '空间设置', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  const settings = page.getByRole('dialog', { name: '空间设置', exact: true });
  await expect(settings.getByRole('heading', { name: '空间信息', exact: true })).toBeVisible();
  await expect(settings.getByRole('region', { name: 'Codex 桌面接入' })).toHaveCount(0);
  await expect(settings.getByRole('button', { name: '连接与设备', exact: true })).toHaveCount(0);
  await page.setViewportSize({ width: 480, height: 560 });
  await page.screenshot({ path: info.outputPath('space-settings-narrow.png') });
  await page.keyboard.press('Escape');
  await expect(settings).toHaveCount(0);
  await expect(space).toBeFocused();
});

for (const empty of [false, true])
  test(`${empty ? 'empty' : 'populated'} five-status dark board and embedded view retain every destination`, async ({
    page,
    baseURL,
  }, info) => {
    await fiveStatusFixture(page, new URL(baseURL!).origin, 'studio', 'dark', empty);
    await page.setViewportSize({ width: 1320, height: 860 });
    await page.goto('/');
    await expectBoardFits(page, 1320);
    if (empty) await expect(page.locator('.task-card')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '添加任务', exact: true })).toHaveCount(5);
    await page.screenshot({
      path: info.outputPath(`studio-dark-${empty ? 'empty' : 'populated'}-1320.png`),
      fullPage: true,
    });
    const embedded = await page.context().newPage();
    try {
      await fiveStatusFixture(embedded, new URL(baseURL!).origin, 'studio', 'dark', empty, false);
      await embedded.setViewportSize({ width: 360, height: 640 });
      await embedded.goto('/?embedded=1');
      await expectBoardFits(embedded, 360);
      await expect(embedded.locator('.rail')).toBeHidden();
      await expect(embedded.locator('.codex-connect-action')).toHaveCount(0);
      await embedded.getByRole('button', { name: '列表', exact: true }).click();
      await expect(embedded.getByRole('heading', { name: '任务列表', exact: true })).toBeVisible();
      await embedded.getByRole('button', { name: '看板', exact: true }).click();
      await embedded.screenshot({
        path: info.outputPath(`studio-dark-${empty ? 'empty' : 'populated'}-embedded-360.png`),
        fullPage: true,
      });
    } finally {
      await embedded.close();
    }
  });

for (const admin of [false, true])
  test(`account destinations retain permissions without a space (${admin ? 'admin' : 'member'})`, async ({
    page,
    baseURL,
  }) => {
    const { user } = await consoleFixture(page, new URL(baseURL!).origin);
    user.instanceAdmin = admin;
    await page.route(
      (url) => ['/api/v1/spaces', '/v1/browser/spaces'].includes(url.pathname),
      (route) => route.fulfill({ json: { data: [] } }),
    );
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: '创建你的第一个任务空间', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: '账号菜单', exact: true }).click();
    await expect(page.getByRole('menuitem', { name: '个人设置', exact: true })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: '退出登录', exact: true })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: '服务器管理', exact: true })).toHaveCount(
      admin ? 1 : 0,
    );
    await expect(page.getByRole('menuitem', { name: '连接与本机', exact: true })).toHaveCount(0);
  });
