import { test, expect } from '@playwright/test';
test('demo supports search, task inspection and view changes without server', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?demo=1');
  await expect(page.getByRole('heading', { name: '任务看板', exact: true })).toBeVisible();
  await page.getByPlaceholder('搜索任务、标签…').fill('Codex');
  await expect(page.getByText('完成 Codex 桌面端看板入口', { exact: true })).toBeVisible();
  await expect(page.getByText('登录与邀请链接', { exact: true })).toHaveCount(0);
  await page.getByPlaceholder('搜索任务、标签…').fill('');
  await page.getByRole('button', { name: '列表', exact: true }).click();
  await expect(page.getByRole('button', { name: '看板', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('onboarding is reachable and demonstration is explicitly labelled', async ({ page }) => {
  await page.goto('/?demo=1');
  await expect(page.getByText('演示模式', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await expect(page.getByText('空间设置', { exact: true })).toBeVisible();
});
