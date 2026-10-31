import { compatibleServerHealth } from '../server-compatibility-fixture.ts';
import { test, expect, type Page } from '@playwright/test';
import { demoUser, makeDemoBoard } from '../../apps/web/src/demo';
import type { AppearanceRecord, ThemePackage } from '../../packages/core/src/themes';
import { identifyTheme } from '../../apps/web/src/themes';

async function openThemes(page: Page) {
  // Personal settings now retain a deep link across reloads/account refreshes.
  if (await page.locator('.appearance-settings').isVisible()) return;
  if (await page.getByRole('heading', { name: '个人设置', exact: true }).isVisible()) {
    const category = page.getByRole('button', { name: '外观与主题', exact: true });
    if (!(await category.isVisible()))
      await page.getByRole('button', { name: '设置分类', exact: true }).click();
    await category.click();
    return;
  }
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: '外观与主题', exact: true }).click();
}
test('four themes support both modes, reversible previews, layouts and narrow embedded screens', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  await page.goto('/?demo=1');
  await openThemes(page);
  for (const [id, name] of [
    ['glass', '玻璃'],
    ['paper', '极简'],
    ['studio', '开发者'],
    ['island', '自然岛屿'],
  ]) {
    for (const [mode, label] of [
      ['light', '浅色'],
      ['dark', '深色'],
    ]) {
      await page.locator('.theme-choice').filter({ hasText: name }).click();
      await page.getByRole('button', { name: label, exact: true }).click();
      await expect(page.locator('html')).toHaveAttribute('data-style', id);
      await expect(page.locator('html')).toHaveAttribute('data-theme', mode);
      await page.screenshot({ path: info.outputPath(`${id}-${mode}-settings.png`) });
      await page.getByRole('button', { name: '应用主题', exact: true }).click();
      await page.getByRole('button', { name: '返回看板', exact: true }).click();
      await expect(page.getByRole('heading', { name: '任务看板', exact: true })).toBeVisible();
      await page.screenshot({ path: info.outputPath(`${id}-${mode}-board.png`) });
      await openThemes(page);
    }
  }
  await page.getByRole('button', { name: '恢复默认' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-style', 'glass');
  await page.getByRole('button', { name: '取消预览' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-style', 'island');
  await page.getByRole('button', { name: '顶部导航', exact: true }).click();
  await page.getByRole('button', { name: '应用主题', exact: true }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-layout', 'top');
  await page.goto('/?demo=1&embedded=1');
  await page.setViewportSize({ width: 360, height: 800 });
  await expect(page.locator('.rail')).toBeHidden();
  await openThemes(page);
  await expect(page.getByRole('button', { name: '导入主题' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('island-narrow.png') });
});

test('imports data-only packages, rejects scripts, exports and removes the selected package', async ({
  page,
}) => {
  await page.goto('/?demo=1');
  await openThemes(page);
  const manifest = {
    formatVersion: 1,
    name: '林间习作',
    author: 'Test',
    version: '1.0.0',
    base: 'island',
    layout: 'rail',
    light: { accent: '#285040' },
    dark: {},
  };
  const input = page.getByLabel('主题文件', { exact: true });
  await input.setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ ...manifest, script: 'alert(1)' })),
  });
  await expect(page.getByRole('alert')).toContainText('导入失败');
  await input.setInputFiles({
    name: 'forest.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(manifest)),
  });
  await expect(page.locator('.theme-choice').filter({ hasText: '林间习作' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: '应用主题', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出主题' }).click();
  expect((await download).suggestedFilename()).toMatch(/\.taskboard-theme\.json$/);
  await page.reload();
  await openThemes(page);
  await expect(page.locator('.theme-choice').filter({ hasText: '林间习作' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: '移除主题' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-style', 'glass');
});

function serverMock() {
  let account = demoUser;
  let packages: ThemePackage[] = [];
  let appearance: AppearanceRecord = {
    themeId: 'glass',
    mode: 'system',
    layout: 'auto',
    version: 1,
  };
  let offline = false;
  const install = async (page: Page) =>
    page.route('**/api/v1/**', async (route) => {
      const req = route.request();
      const path = new URL(req.url()).pathname.replace('/api/v1', '');
      if (path.startsWith('/me/') && offline) return route.abort('internetdisconnected');
      let data: unknown = {};
      if (path === '/health') data = compatibleServerHealth;
      else if (path === '/setup') data = { required: false };
      if (path === '/me') data = account;
      if (path === '/spaces') data = [makeDemoBoard().space];
      if (path.endsWith('/board')) data = makeDemoBoard();
      if (path === '/me/themes') data = packages;
      if (path === '/me/appearance') {
        if (req.method() === 'PUT') {
          if (Number(req.headers()['if-match']) !== appearance.version)
            return route.fulfill({
              status: 409,
              json: { error: { code: 'VERSION_CONFLICT', message: '冲突' } },
            });
          appearance = { ...req.postDataJSON(), version: appearance.version + 1 };
        }
        data = appearance;
      }
      if (path.endsWith('/events'))
        return route.fulfill({ contentType: 'text/event-stream', body: '' });
      return route.fulfill({ json: { data } });
    });
  return {
    install,
    setOffline: (value: boolean) => {
      offline = value;
    },
    value: () => appearance,
    switchAccount: () => {
      account = { ...demoUser, id: 'u-other', name: '另一个账号' };
      packages = [];
      appearance = { themeId: 'glass', mode: 'system', layout: 'auto', version: 1 };
    },
    remoteTheme: (pack: ThemePackage) => {
      packages = [pack];
      appearance = { ...appearance, themeId: pack.id, version: appearance.version + 1 };
    },
  };
}
test('two devices synchronize; offline changes require an explicit choice after a cloud conflict', async ({
  page,
  browser,
}) => {
  const server = serverMock();
  await server.install(page);
  await page.goto('/');
  await openThemes(page);
  await expect(page.locator('.appearance-settings [role=status]')).toContainText('已同步到账号');
  const context = await browser.newContext();
  const second = await context.newPage();
  try {
    await server.install(second);
    await second.goto('/');
    await openThemes(second);
    await expect(second.locator('.appearance-settings [role=status]')).toContainText(
      '已同步到账号',
    );
    await page.locator('.theme-choice').filter({ hasText: '自然岛屿' }).click();
    await page.getByRole('button', { name: '应用主题', exact: true }).click();
    await expect.poll(() => server.value().themeId).toBe('island');
    await second.evaluate(() => dispatchEvent(new Event('focus')));
    await expect(second.locator('html')).toHaveAttribute('data-style', 'island');
    server.setOffline(true);
    await second.locator('.theme-choice').filter({ hasText: '开发者' }).click();
    await second.getByRole('button', { name: '应用主题', exact: true }).click();
    await expect(second.locator('.appearance-settings [role=status]')).toContainText('待同步');
    server.setOffline(false);
    await page.locator('.theme-choice').filter({ hasText: '极简' }).click();
    await page.getByRole('button', { name: '应用主题', exact: true }).click();
    await expect.poll(() => server.value().themeId).toBe('paper');
    await second.evaluate(() => dispatchEvent(new Event('online')));
    await expect(second.getByRole('button', { name: '保留本次选择' })).toBeVisible();
    await expect(second.locator('html')).toHaveAttribute('data-style', 'studio');
    await second.getByRole('button', { name: '保留本次选择' }).click();
    await expect.poll(() => server.value().themeId).toBe('studio');
    await page.evaluate(() => dispatchEvent(new Event('focus')));
    await expect(page.locator('html')).toHaveAttribute('data-style', 'studio');
  } finally {
    await context.close();
  }
});

test('0.1.4 mode survives upgrade and unsupported servers retain local theme selection', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('tb:theme', 'dark'));
  const server = serverMock();
  await server.install(page);
  await page.route('**/api/v1/me/appearance', (route) =>
    route.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND', message: '旧版服务端' } } }),
  );
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await openThemes(page);
  await expect(page.locator('.appearance-settings [role=status]')).toContainText('需要升级服务端');
  await page.locator('.theme-choice').filter({ hasText: '自然岛屿' }).click();
  await page.getByRole('button', { name: '应用主题', exact: true }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-style', 'island');
});

test('closing or cancelling settings invalidates a delayed theme import', async ({ page }) => {
  await page.addInitScript(() => {
    const original = File.prototype.text;
    File.prototype.text = async function () {
      await new Promise<void>((resolve) =>
        document.addEventListener('release-theme-import', () => resolve(), { once: true }),
      );
      return original.call(this);
    };
  });
  await page.goto('/?demo=1');
  await openThemes(page);
  const manifest = {
    formatVersion: 1,
    name: '延迟导入',
    author: 'Test',
    version: '1.0.0',
    base: 'island',
    layout: 'rail',
    light: {},
    dark: {},
  };
  const select = () =>
    page.getByLabel('主题文件', { exact: true }).setInputFiles({
      name: 'delayed.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(manifest)),
    });
  await select();
  await expect(page.getByRole('button', { name: '正在读取主题…' })).toBeVisible();
  await page.getByRole('button', { name: '取消预览' }).click();
  await page.evaluate(() => document.dispatchEvent(new Event('release-theme-import')));
  await expect(page.locator('html')).toHaveAttribute('data-style', 'glass');
  await expect(page.locator('.theme-choice')).toHaveCount(4);
  await select();
  await expect(page.getByRole('button', { name: '正在读取主题…' })).toBeVisible();
  await page.getByRole('button', { name: '返回看板', exact: true }).click();
  await page.evaluate(() => document.dispatchEvent(new Event('release-theme-import')));
  await expect(page.locator('html')).toHaveAttribute('data-style', 'glass');
  await openThemes(page);
  await expect(page.locator('.theme-choice')).toHaveCount(4);
});

test('accepting a cloud conflict applies a previously unknown custom theme immediately', async ({
  page,
}) => {
  const server = serverMock();
  await server.install(page);
  await page.goto('/');
  await openThemes(page);
  await expect(page.locator('.appearance-settings [role=status]')).toContainText('已同步到账号');
  server.setOffline(true);
  await page.locator('.theme-choice').filter({ hasText: '极简' }).click();
  await page.getByRole('button', { name: '应用主题', exact: true }).click();
  await expect(page.locator('.appearance-settings [role=status]')).toContainText('待同步');
  const remote = await identifyTheme({
    formatVersion: 1,
    name: '远端森林',
    author: 'Other device',
    version: '1.0.0',
    base: 'island',
    layout: 'rail',
    light: { accent: '#285040' },
    dark: { accent: '#b8d8a5' },
  });
  server.remoteTheme(remote);
  server.setOffline(false);
  await page.evaluate(() => dispatchEvent(new Event('online')));
  await page.getByRole('button', { name: '使用云端' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-style', 'island');
  await expect(page.locator('.theme-choice').filter({ hasText: '远端森林' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('html')).toHaveCSS('--accent', '#285040');
});

test('an import started by one account cannot populate another account after session refresh', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = File.prototype.text;
    File.prototype.text = async function () {
      await new Promise<void>((resolve) =>
        document.addEventListener('release-theme-import', () => resolve(), { once: true }),
      );
      return original.call(this);
    };
  });
  const server = serverMock();
  await server.install(page);
  await page.goto('/');
  await openThemes(page);
  const manifest = {
    formatVersion: 1,
    name: '前账号私有主题',
    author: 'Test',
    version: '1.0.0',
    base: 'island',
    layout: 'rail',
    light: {},
    dark: {},
  };
  await page.getByLabel('主题文件', { exact: true }).setInputFiles({
    name: 'private.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(manifest)),
  });
  await expect(page.getByRole('button', { name: '正在读取主题…' })).toBeVisible();
  server.switchAccount();
  await page.evaluate(() => dispatchEvent(new Event('online')));
  await expect
    .poll(() =>
      page.evaluate(() =>
        Object.keys(localStorage).some(
          (key) => key.startsWith('tb:appearance:') && key.endsWith(':u-other'),
        ),
      ),
    )
    .toBe(true);
  await page.evaluate(() => document.dispatchEvent(new Event('release-theme-import')));
  await expect(page.locator('html')).toHaveAttribute('data-style', 'glass');
  await expect
    .poll(() =>
      page.evaluate(() =>
        Object.keys(localStorage)
          .filter((key) => key.startsWith('tb:appearance:') && key.endsWith(':u-other'))
          .map((key) => localStorage.getItem(key))
          .join(''),
      ),
    )
    .not.toContain('前账号私有主题');
  if (!(await page.locator('.settings').isVisible())) await openThemes(page);
  await page.getByRole('button', { name: '外观与主题', exact: true }).click();
  await expect(page.locator('.theme-choice')).toHaveCount(4);
});
