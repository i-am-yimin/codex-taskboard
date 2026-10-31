import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { startAccountTestServer } from '../fixtures/account-server';
import { migrate } from '../../apps/server/src/migrate';
import { createDatabase, type Database } from '../../apps/server/src/db';

test.describe('first-run server administration with PostgreSQL', () => {
  test.skip(!process.env.TEST_DATABASE_URL, 'Requires isolated PostgreSQL and built web assets');
  let db: Database;
  let control: Database;
  let app: Awaited<ReturnType<typeof startAccountTestServer>>;
  let base: string;
  const schema = `browser_setup_${randomUUID().replaceAll('-', '')}`;
  const token = 'e'.repeat(64);
  const password = 'browser-setup-password-2026';
  test.beforeAll(async () => {
    const url = new URL(process.env.TEST_DATABASE_URL!);
    if (!url.pathname.endsWith('_test')) throw new Error('Use an isolated *_test database');
    control = createDatabase(url.toString());
    await control.query(`CREATE SCHEMA "${schema}"`);
    url.searchParams.set('options', `-csearch_path=${schema}`);
    db = createDatabase(url.toString());
    await migrate(db);
    app = await startAccountTestServer({
      setupToken: token,
      sessionSecret: 'f'.repeat(64),
      databaseUrl: url.toString(),
      managedSecrets: true,
    });
    base = app.base;
  });
  test.afterAll(async () => {
    await app?.close();
    await db?.end();
    if (control) {
      await control.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await control.end();
    }
  });
  test('creates the only administrator, manages settings and account, and reveals secrets only after verification', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const output = resolve('.impeccable/review');
    await mkdir(output, { recursive: true });
    await page.goto(base);
    await expect(page.getByRole('heading', { name: '设置你的 Taskboard' })).toBeVisible();
    if (test.info().project.name === 'desktop') {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.screenshot({ path: resolve(output, 'setup-desktop.png'), fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: resolve(output, 'setup-mobile.png'), fullPage: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.setViewportSize({ width: 1440, height: 1000 });
    }
    await page.getByLabel('初始化口令', { exact: true }).fill(token);
    await page.getByLabel('管理员名称', { exact: true }).fill('部署管理员');
    await page.getByLabel('管理员邮箱', { exact: true }).fill('browser-owner@example.test');
    await page.getByLabel('密码', { exact: true }).fill(password);
    await page.getByLabel('确认密码', { exact: true }).fill(password);
    await page.getByRole('button', { name: '创建管理员并登录' }).click();
    await page.getByLabel('账号菜单').click();
    await page.getByRole('button', { name: '服务器管理', exact: true }).click();
    await expect(page.getByRole('heading', { name: '服务器管理' })).toBeVisible();
    await expect(page.getByLabel('对外访问地址', { exact: true })).toHaveValue(base);
    if (test.info().project.name === 'desktop') {
      await page.screenshot({ path: resolve(output, 'desktop.png'), fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: resolve(output, 'mobile.png'), fullPage: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.screenshot({ path: resolve(output, 'mobile-dark.png'), fullPage: true });
      await page.emulateMedia({ colorScheme: 'light' });
      await page.setViewportSize({ width: 1440, height: 1000 });
    }
    await page.getByRole('button', { name: '数据库与密钥', exact: true }).click();
    await expect(page.getByLabel('数据库密码明文')).toHaveCount(0);
    await page.getByLabel('验证管理员密码以查看').fill('wrong-password-long');
    await page.getByRole('button', { name: '验证并显示密钥' }).click();
    await expect(page.getByRole('alert')).toHaveText('当前管理员密码不正确');
    await expect(page.getByLabel('数据库密码明文')).toHaveCount(0);
    await page.getByLabel('验证管理员密码以查看').fill(password);
    await page.getByRole('button', { name: '验证并显示密钥' }).click();
    await expect(page.getByLabel('会话密钥明文')).toHaveValue('f'.repeat(64));
    await page.getByRole('button', { name: '立即隐藏' }).click();
    await expect(page.getByLabel('会话密钥明文')).toHaveCount(0);
    await page.getByRole('button', { name: '个人设置', exact: true }).click();
    await page.getByLabel('名称', { exact: true }).fill('更新后的管理员');
    await page.getByRole('button', { name: '保存资料' }).click();
    await expect(page.getByRole('status')).toContainText('个人资料已保存。');
    await page.goto(`${base}/#admin`);
    await page.getByRole('button', { name: '运行日志', exact: true }).click();
    await expect(page.getByRole('log')).toBeVisible();
    await page.goto(`${base}/#admin`);
    await expect(page.getByRole('heading', { name: '服务器管理' })).toBeVisible();
    await expect(page.getByText('更新后的管理员', { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });
  test('keeps governance unavailable when the server does not declare the account capability', async ({
    page,
  }) => {
    const health = await page.request.get(`${base}/api/v1/health`);
    const value = await health.json();
    delete value.data.capabilities.accountCenter;
    await page.route('**/api/v1/health', (route) => route.fulfill({ json: value }));
    await page.goto(`${base}/#admin`);
    await page.getByLabel('邮箱', { exact: true }).fill('browser-owner@example.test');
    await page.getByLabel('密码', { exact: true }).fill(password);
    await page.getByRole('button', { name: '登录并继续', exact: true }).click();
    await expect(page.getByRole('heading', { name: '服务器管理', exact: true })).toBeVisible();
    await expect(
      page.getByRole('status').filter({ hasText: '尚未声明用户中心能力' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: '邮件服务', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '空间治理', exact: true })).toHaveCount(0);
    await page.unrouteAll({ behavior: 'wait' });
  });
});
