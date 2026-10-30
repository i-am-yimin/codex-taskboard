import { expect, test, type Page } from '@playwright/test';
const evidenceDirectory =
  process.env.TASKBOARD_E2E_EVIDENCE_DIR ?? '.artifacts/e2e/codex-connection';
type NativeMock = {
  state: string;
  calls: string[];
  failure?: string;
  errorKind: 'string' | 'error';
};
async function desktop(
  page: Page,
  state = 'connectable',
  failure?: string,
  errorKind: 'string' | 'error' = 'string',
) {
  let installs = 0;
  await page.addInitScript(
    ({ state, failure, errorKind }) => {
      const mock: NativeMock = { state, failure, errorKind, calls: [] };
      Object.assign(window, {
        codexMock: mock,
        __TAURI__: {
          core: {
            invoke: async (command: string) => {
              mock.calls.push(command);
              if (command === 'bridge_capability') return 'test-local-key';
              if (command === 'codex_connection_status')
                return {
                  state: mock.state,
                  version: '26.1016.8622.0',
                  mode: mock.state === 'connected' ? 'daily' : undefined,
                  reason:
                    mock.state === 'restart-required'
                      ? '日常 Codex 已打开，但尚未启用连接。请先保存工作并正常退出 Codex。'
                      : '日常 Codex 可连接',
                };
              if (command === 'connect_daily_codex') {
                if (mock.failure) {
                  if (mock.errorKind === 'string') return Promise.reject(mock.failure);
                  throw new Error(mock.failure);
                }
                mock.state = 'connected';
                return '已连接日常 Codex';
              }
              throw new Error(`Unexpected native command: ${command}`);
            },
          },
        },
      });
    },
    { state, failure, errorKind },
  );
  await page.route('http://127.0.0.1:47831/**', (route) => {
    if (route.request().url().endsWith('/v1/codex/install')) installs++;
    return route.fulfill({
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ data: { embedded: installs > 0, draft: false, reason: '尚未接入' } }),
    });
  });
  await page.goto('/?demo=1');
  await expect(page.getByRole('button', { name: '连接 Codex', exact: true })).toBeEnabled();
  return () => installs;
}
async function calls(page: Page) {
  return page.evaluate(() => (window as unknown as { codexMock: NativeMock }).codexMock.calls);
}
async function setState(page: Page, state: string) {
  await page.evaluate((state) => {
    (window as unknown as { codexMock: NativeMock }).codexMock.state = state;
  }, state);
}
async function settings(page: Page) {
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: '连接与设备', exact: true }).click();
}
test('main board connects once and shares its state with settings without a shortcut', async ({
  page,
}, info) => {
  const installs = await desktop(page);
  await page.getByRole('button', { name: '连接 Codex', exact: true }).evaluate((button) => {
    (button as HTMLButtonElement).click();
    (button as HTMLButtonElement).click();
  });
  await expect(page.getByRole('button', { name: '打开 Codex', exact: true })).toBeEnabled();
  expect(installs()).toBe(1);
  expect((await calls(page)).filter((c) => c === 'connect_daily_codex')).toHaveLength(1);
  expect(await calls(page)).not.toContain('create_codex_connection_shortcut');
  expect(await calls(page)).not.toContain('start_managed_codex');
  if (info.project.name === 'desktop') {
    await page.setViewportSize({ width: 1320, height: 860 });
    await page.screenshot({
      path: `${evidenceDirectory}/main-connected.png`,
    });
  }
  await settings(page);
  await expect(page.locator('.connection-card [role="status"]')).toContainText(
    '原登录、项目和会话保持不变',
  );
  await expect(
    page.getByRole('checkbox', { name: '启动 Taskboard 时自动连接日常 Codex' }),
  ).toBeChecked();
  await expect(page.getByRole('button', { name: '创建日常连接快捷方式', exact: true })).toHaveCount(
    0,
  );
});
test('ordinary Taskboard startup restores the remembered connection', async ({ page }) => {
  const installs = await desktop(page);
  await page.getByRole('button', { name: '连接 Codex', exact: true }).click();
  await expect(page.getByRole('button', { name: '打开 Codex', exact: true })).toBeEnabled();
  await page.reload();
  await expect(page.getByRole('button', { name: '打开 Codex', exact: true })).toBeEnabled();
  expect(installs()).toBe(2);
  expect((await calls(page)).filter((c) => c === 'connect_daily_codex')).toHaveLength(1);
});
test('disabling automatic connection persists through manual connection and reload', async ({
  page,
}) => {
  const installs = await desktop(page);
  await settings(page);
  const automatic = page.getByRole('checkbox', { name: '启动 Taskboard 时自动连接日常 Codex' });
  await automatic.check();
  await automatic.uncheck();
  await page.getByRole('button', { name: '接入日常 Codex', exact: true }).click();
  await expect(page.locator('.connection-card [role="status"]')).toContainText('已接入日常 Codex');
  await expect(automatic).not.toBeChecked();
  await page.reload();
  await expect(page.getByRole('button', { name: '连接 Codex', exact: true })).toBeEnabled();
  expect(installs()).toBe(1);
  expect(await calls(page)).not.toContain('connect_daily_codex');
});
test('waits for normal Codex exit then opens and attaches the daily environment', async ({
  page,
}, info) => {
  const installs = await desktop(page, 'restart-required');
  await page.getByRole('button', { name: '连接 Codex', exact: true }).click();
  await expect(page.locator('#codex-connection-notice')).toContainText(
    '请先保存工作并正常退出 Codex',
  );
  expect(installs()).toBe(0);
  expect(await calls(page)).not.toContain('connect_daily_codex');
  if (info.project.name === 'compact') {
    await page.setViewportSize({ width: 980, height: 680 });
    await expect(page.getByRole('button', { name: '取消等待', exact: true })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: `${evidenceDirectory}/main-waiting-compact.png`,
    });
  }
  await setState(page, 'not-running');
  await expect(page.getByRole('button', { name: '打开 Codex', exact: true })).toBeEnabled();
  expect(installs()).toBe(1);
  expect(await calls(page)).not.toContain('start_managed_codex');
});
test('canceling the exit wait prevents a later launch', async ({ page }) => {
  const installs = await desktop(page, 'restart-required');
  await page.getByRole('button', { name: '连接 Codex', exact: true }).click();
  await page.getByRole('button', { name: '取消等待', exact: true }).click();
  await expect(page.getByRole('button', { name: '连接 Codex', exact: true })).toBeEnabled();
  await setState(page, 'not-running');
  await page.waitForTimeout(2300);
  expect(installs()).toBe(0);
  expect(await calls(page)).not.toContain('connect_daily_codex');
});
for (const kind of ['string', 'error'] as const)
  test(`preserves native ${kind} refusal without installing or remembering success`, async ({
    page,
  }) => {
    const reason = 'Codex 进程、监听者或精确页面身份未通过核验，已停止接入';
    const installs = await desktop(page, 'connectable', reason, kind);
    await page.getByRole('button', { name: '连接 Codex', exact: true }).click();
    await expect(page.locator('#codex-connection-notice')).toContainText(reason);
    expect(installs()).toBe(0);
    expect(
      await page.evaluate(() => localStorage.getItem('tb:daily-codex:auto-connect')),
    ).toBeNull();
  });
test('failed sidebar handshake stays visible and does not enable startup connection', async ({
  page,
}) => {
  await desktop(page);
  await page.route('http://127.0.0.1:47831/v1/codex/install', (route) =>
    route.fulfill({
      status: 409,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: '{"error":{"code":"ADAPTER_UNAVAILABLE","message":"侧栏看板就绪超时，请检测连接后重试"}}',
    }),
  );
  await page.getByRole('button', { name: '连接 Codex', exact: true }).click();
  await expect(page.locator('#codex-connection-notice')).toContainText('侧栏看板就绪超时');
  await expect(page.getByRole('button', { name: '打开 Codex', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('tb:daily-codex:auto-connect'))).toBeNull();
});

test('a structure refusal preserves the taskboard and manual retry without claiming connection', async ({ page }) => {
  await desktop(page);
  await page.route('http://127.0.0.1:47831/v1/codex/install', route => route.fulfill({
    status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify({ data: { embedded: false, draft: false, projects: false, thread: false,
      sidebar: { state: 'structure-ambiguous', appVersion: '99.999.1.0' },
      reason: 'Codex 结构匹配不唯一，已停止侧栏接入' } }),
  }));
  await page.getByRole('button', { name: '连接 Codex', exact: true }).click();
  await expect(page.locator('#codex-connection-notice')).toContainText('结构匹配不唯一');
  await expect(page.getByRole('button', { name: '重新连接', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: '打开 Codex', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('tb:daily-codex:auto-connect'))).toBeNull();
  await expect(page.locator('.board')).toBeVisible();
});
test('plain browser board does not offer a native connection action', async ({ page }) => {
  await page.goto('/?demo=1');
  await expect(page.getByRole('heading', { name: '任务看板', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '连接 Codex', exact: true })).toHaveCount(0);
});

async function blockPreferenceWrites(page: Page) {
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'tb:daily-codex:auto-connect')
        throw new DOMException('Storage blocked', 'QuotaExceededError');
      return original.call(this, key, value);
    };
    Object.assign(window, {
      restorePreferenceWrites: () => (Storage.prototype.setItem = original),
    });
  });
}
async function restorePreferenceWrites(page: Page) {
  await page.evaluate(() => {
    (window as unknown as { restorePreferenceWrites: () => void }).restorePreferenceWrites();
  });
}

test('first connection keeps storage failure visible and retries only the setting', async ({
  page,
}, info) => {
  const installs = await desktop(page);
  await blockPreferenceWrites(page);
  await page.getByRole('button', { name: '连接 Codex', exact: true }).click();
  await expect(page.getByRole('button', { name: '打开 Codex', exact: true })).toBeEnabled();
  const mainWarning = page.locator('#codex-connection-notice');
  await expect(mainWarning).toContainText('Codex 已接入，设置未保存');
  await expect(mainWarning).toContainText('无法保存自动连接设置');
  expect(await page.evaluate(() => localStorage.getItem('tb:daily-codex:auto-connect'))).toBeNull();
  await page.setViewportSize(
    info.project.name === 'compact' ? { width: 980, height: 680 } : { width: 1320, height: 860 },
  );
  await page.screenshot({
    path: `${evidenceDirectory}/warning-${info.project.name}.png`,
  });
  await settings(page);
  const automatic = page.getByRole('checkbox', { name: '启动 Taskboard 时自动连接日常 Codex' });
  await expect(automatic).not.toBeChecked();
  const settingsWarning = page.locator('#codex-auto-connect-error');
  await expect(settingsWarning).toContainText('无法保存自动连接设置');
  await page.getByRole('button', { name: '检测连接', exact: true }).click();
  await expect(settingsWarning).toBeVisible();
  await restorePreferenceWrites(page);
  await settingsWarning.getByRole('button', { name: '重试保存', exact: true }).click();
  await expect(automatic).toBeChecked();
  await expect(settingsWarning).toHaveCount(0);
  await expect(mainWarning).toHaveCount(0);
  expect(installs()).toBe(1);
  expect((await calls(page)).filter((c) => c === 'connect_daily_codex')).toHaveLength(1);
  await page.reload();
  await expect(page.getByRole('button', { name: '打开 Codex', exact: true })).toBeEnabled();
  expect(installs()).toBe(2);
});

test('failed disable preserves the saved choice and retries disabling without reconnecting', async ({
  page,
}) => {
  const installs = await desktop(page);
  await page.getByRole('button', { name: '连接 Codex', exact: true }).click();
  await expect(page.getByRole('button', { name: '打开 Codex', exact: true })).toBeEnabled();
  await settings(page);
  await blockPreferenceWrites(page);
  const automatic = page.getByRole('checkbox', { name: '启动 Taskboard 时自动连接日常 Codex' });
  await automatic.uncheck({ trial: true });
  await automatic.click();
  await expect(automatic).toBeChecked();
  expect(await page.evaluate(() => localStorage.getItem('tb:daily-codex:auto-connect'))).toBe('1');
  await expect(page.locator('.connection-card [role="status"]')).toContainText('已接入日常 Codex');
  const warning = page.locator('#codex-auto-connect-error');
  await expect(warning).toBeVisible();
  await restorePreferenceWrites(page);
  await warning.getByRole('button', { name: '重试保存', exact: true }).click();
  await expect(automatic).not.toBeChecked();
  expect(await page.evaluate(() => localStorage.getItem('tb:daily-codex:auto-connect'))).toBe('0');
  expect(installs()).toBe(1);
  await page.reload();
  await expect(page.getByRole('button', { name: '连接 Codex', exact: true })).toBeEnabled();
  expect(await calls(page)).not.toContain('connect_daily_codex');
});

test('five minute exit wait times out without launching and permits retry', async ({ page }) => {
  const installs = await desktop(page, 'restart-required');
  await page.clock.install();
  await page.getByRole('button', { name: '连接 Codex', exact: true }).click();
  await expect(page.getByRole('button', { name: '取消等待', exact: true })).toBeVisible();
  await page.clock.fastForward(5 * 60_000 + 2100);
  await expect(page.locator('#codex-connection-notice')).toContainText('等待已结束');
  expect(installs()).toBe(0);
  expect(await calls(page)).not.toContain('connect_daily_codex');
  await page.getByRole('button', { name: '重新连接', exact: true }).click();
  await expect(page.getByRole('button', { name: '取消等待', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '取消等待', exact: true }).click();
  await expect(page.getByRole('button', { name: '连接 Codex', exact: true })).toBeEnabled();
});
