import { test, expect } from '@playwright/test';
import { consoleFixture } from '../fixtures/console-layout';

test('narrow workspace keeps controls reachable and error recovery readable', async ({
  page,
  baseURL,
}) => {
  await consoleFixture(page, new URL(baseURL!).origin);
  await page.route('**/api/v1/health', (route) =>
    route.fulfill({
      json: {
        data: {
          status: 'ok',
          database: 'ok',
          serverVersion: '0.1.3',
          apiVersion: 1,
          capabilities: { collaborativeWorkflows: 0, accountCenter: 1 },
          migrationRequired: true,
        },
      },
    }),
  );
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto('/');
  const topbar = page.locator('.topbar');
  await expect(topbar.getByRole('button', { name: '账号菜单', exact: true })).toBeVisible();
  const controls = await topbar.getByRole('button').evaluateAll((buttons) =>
    buttons.map((button) => {
      const box = button.getBoundingClientRect();
      return { x: box.x, right: box.right, height: box.height };
    }),
  );
  for (const control of controls) {
    expect(control.x).toBeGreaterThanOrEqual(0);
    expect(control.right).toBeLessThanOrEqual(360);
    expect(control.height).toBeGreaterThanOrEqual(44);
  }
  const notice = page.getByRole('region', { name: '服务器兼容性' });
  const retry = notice.getByRole('button', { name: '重新检查服务器', exact: true });
  await expect(retry).toBeEnabled();
  const text = (await notice.locator('div').boundingBox())!;
  const button = (await retry.boundingBox())!;
  expect(button.y).toBeGreaterThanOrEqual(text.y + text.height);
  expect(button.height).toBeLessThan(60);
  expect(button.x + button.width).toBeLessThanOrEqual(360);
  await page.getByRole('button', { name: '列表', exact: true }).click();
  await expect(page.getByRole('heading', { name: '任务列表', exact: true })).toBeVisible();
});

for (const desktop of [false, true]) {
  test(`account menu uses equal rows and keeps keyboard access (${desktop ? 'companion' : 'web'})`, async ({
    page,
    baseURL,
  }) => {
    const { user } = await consoleFixture(page, new URL(baseURL!).origin, { desktop });
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto('/');
    const trigger = page.getByRole('button', { name: '账号菜单', exact: true });
    await trigger.focus();
    await page.keyboard.press('Enter');
    const menu = page.getByRole('menu');
    await expect(menu.getByText(user.name, { exact: true })).toBeVisible();
    await expect(menu.getByText(user.email, { exact: true })).toBeVisible();
    const rows = menu.getByRole('menuitem');
    await expect(rows).toHaveCount(3);
    await expect(rows.first()).toBeFocused();
    const server = menu.getByRole('menuitem', { name: '服务器管理', exact: true });
    if (desktop) {
      await expect(server).toHaveAttribute('href', `${new URL(baseURL!).origin}/#admin`);
      await expect(server).toHaveAttribute('target', '_blank');
      await expect(server).toHaveAttribute('rel', 'noopener noreferrer');
    }
    const metrics = await rows.evaluateAll((items) =>
      items.map((item) => {
        const rect = item.getBoundingClientRect();
        const style = getComputedStyle(item);
        const icon = item.querySelector('svg')!.getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          height: rect.height,
          icon: icon.left,
          align: style.justifyContent,
          radius: style.borderRadius,
        };
      }),
    );
    for (const row of metrics) {
      expect(row.left).toBeGreaterThanOrEqual(0);
      expect(row.right).toBeLessThanOrEqual(360);
      expect(row.height).toBeGreaterThanOrEqual(44);
      expect(row.icon).toBe(metrics[0].icon);
      expect(row.align).toBe(metrics[0].align);
      expect(row.radius).toBe(metrics[0].radius);
    }
    await page.keyboard.press('ArrowDown');
    await expect(server).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await trigger.click();
    await page.getByRole('menuitem', { name: '个人设置', exact: true }).click();
    await expect(page.getByLabel('名称', { exact: true })).toHaveValue(user.name);
  });
}

test('narrow administration exposes every category and hides revealed secrets when returning', async ({
  page,
  baseURL,
}) => {
  await consoleFixture(page, new URL(baseURL!).origin);
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto('/#admin');
  const nav = page.getByRole('navigation', { name: '服务器管理分类' });
  const labels = [
    '运行与设置',
    '用户与邀请',
    '空间治理',
    '邮件服务',
    '审计日志',
    '数据库与密钥',
    '运行日志',
  ];
  for (const label of labels) {
    const category = nav.getByRole('button', { name: label, exact: true });
    await category.scrollIntoViewIfNeeded();
    await expect(category).toBeInViewport();
    const box = (await category.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(360);
    await category.click();
    await expect(nav).toBeHidden();
    await expect(page.getByRole('button', { name: '管理分类', exact: true })).toBeFocused();
    await expect(page.getByRole('heading', { name: label, exact: true })).toBeVisible();
    if (label === '数据库与密钥') {
      await page
        .getByLabel('验证管理员密码以查看', { exact: true })
        .fill('synthetic-layout-password');
      await page.getByRole('button', { name: '验证并显示密钥', exact: true }).click();
      await expect(page.getByLabel('会话密钥明文', { exact: true })).toHaveValue(
        'synthetic-session-secret',
      );
    }
    await page.getByRole('button', { name: '管理分类', exact: true }).click();
    await expect(nav).toBeVisible();
    await expect(category).toBeFocused();
    await expect(page.getByLabel('会话密钥明文', { exact: true })).toHaveCount(0);
  }
  await page.setViewportSize({ width: 1280, height: 850 });
  await nav.getByRole('button', { name: '运行与设置', exact: true }).click();
  await expect(nav).toBeVisible();
  await expect(page.getByRole('heading', { name: '运行与设置', exact: true })).toBeVisible();
});
