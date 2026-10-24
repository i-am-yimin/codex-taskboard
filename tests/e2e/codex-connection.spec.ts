import { expect, test, type Page } from '@playwright/test';

async function desktop(page: Page, restart: boolean, nativeError: 'string' | 'error' = 'string') {
  await page.addInitScript(({ restart, nativeError }) => {
    const calls: string[] = [];
    Object.assign(window, { codexCalls: calls, __TAURI__: { core: { invoke: async (command: string) => {
      calls.push(command);
      if (command === 'bridge_capability') return 'test-local-key';
      if (command === 'codex_connection_status') return {
        state: restart ? 'restart-required' : 'connectable', version: '26.1013.4894.0',
        reason: restart ? '日常 Codex 已打开，但尚未启用连接。请先保存工作并正常退出 Codex，再点击接入。' : '检测到可连接的日常 Codex',
      };
      if (command === 'connect_daily_codex') {
        if (restart && nativeError === 'string') return Promise.reject('请先保存工作并正常退出 Codex，再接入日常环境。');
        if (restart) throw new Error('请先保存工作并正常退出 Codex，再接入日常环境。');
        return '已连接日常 Codex';
      }
      if (command === 'create_codex_connection_shortcut') return '已创建开始菜单入口“Codex（任务看板连接）”';
      throw new Error(`Unexpected native command: ${command}`);
    } } } });
  }, { restart, nativeError });
  await page.route('http://127.0.0.1:47831/**', route => route.fulfill({
    contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify({ data: { embedded: false, draft: false, reason: '尚未接入' } }),
  }));
  await page.goto('/?demo=1');
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: '连接与设备', exact: true }).click();
}

for (const nativeError of ['string', 'error'] as const) test(`an ordinary running Codex preserves a native ${nativeError} restart reason and never launches an independent environment`, async ({ page }) => {
  let installs = 0;
  await desktop(page, true, nativeError);
  await page.route('http://127.0.0.1:47831/v1/codex/install', route => {
    installs += 1;
    return route.fulfill({ contentType: 'application/json', body: '{"data":{"embedded":true}}' });
  });
  await expect(page.locator('.connection-card [role="status"]')).toContainText('请先保存工作并正常退出');
  await expect(page.getByRole('button', { name: '启动独立测试 Codex', exact: true })).not.toBeVisible();
  await page.getByRole('button', { name: '退出 Codex 后接入', exact: true }).click();
  await expect(page.locator('.connection-card [role="status"]')).toContainText('请先保存工作并正常退出');
  expect(installs).toBe(0);
  const calls = await page.evaluate(() => (window as unknown as { codexCalls: string[] }).codexCalls);
  expect(calls).toContain('connect_daily_codex');
  expect(calls).not.toContain('start_managed_codex');
});

test('preserves a native string when checking the daily connection fails', async ({ page }) => {
  await desktop(page, false);
  await page.evaluate(() => {
    const original = window.__TAURI__!.core!.invoke;
    window.__TAURI__!.core!.invoke = <T>(command: string): Promise<T> => command === 'codex_connection_status'
      ? Promise.reject('发现多个日常 Codex 主进程，请先正常退出多余窗口后重试')
      : original<T>(command);
  });
  await page.getByRole('button', { name: '检测连接', exact: true }).click();
  await expect(page.locator('.connection-card [role="status"]')).toContainText('发现多个日常 Codex 主进程');
});

test('connects the daily window, preserves version refusal, and offers a reusable normal-profile shortcut', async ({ page }) => {
  await desktop(page, false);
  await page.route('http://127.0.0.1:47831/v1/codex/install', route => route.fulfill({
    contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
    body: '{"data":{"embedded":true,"draft":false}}',
  }));
  await page.getByRole('button', { name: '接入日常 Codex', exact: true }).click();
  await expect(page.locator('.connection-card [role="status"]')).toContainText('已接入日常 Codex 侧栏');
  await expect(page.locator('.connection-card [role="status"]')).toContainText('原登录、项目和会话保持不变');
  await page.getByRole('button', { name: '创建日常连接快捷方式', exact: true }).click();
  await expect(page.locator('.connection-card [role="status"]')).toContainText('Codex（任务看板连接）');
  await page.route('http://127.0.0.1:47831/v1/codex/install', route => route.fulfill({
    status: 409, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
    body: '{"error":{"code":"ADAPTER_UNAVAILABLE","message":"Codex 26.1016.9999.0 尚未完成侧栏兼容验证，暂不能接入侧栏"}}',
  }));
  await page.getByRole('button', { name: '接入日常 Codex', exact: true }).click();
  await expect(page.locator('.connection-card [role="status"]')).toContainText('尚未完成侧栏兼容验证');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole('button', { name: '接入日常 Codex', exact: true })).toBeInViewport();
  await page.screenshot({ path: '.artifacts/acceptance/2026-10-24-daily-codex/connection-narrow.png' });
});
