import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, expect, type Browser, type Page } from '@playwright/test';
import { hash } from '@node-rs/argon2';
import pg from 'pg';
import { createDatabase } from '../apps/server/src/db';
import { migrate } from '../apps/server/src/migrate';
import { buildApp } from '../apps/server/src/app';
import { createCompanion, type CompanionRuntime } from '../apps/companion/src/main';

// Real compiled frontend → capability-protected companion → authenticated API → PostgreSQL.
// No live desktop, Codex profile, API mocks or application credentials are used.
const parentUrl = new URL(process.env.TEST_DATABASE_URL ?? '');
if (!parentUrl.pathname.endsWith('_test')) throw new Error('Requires isolated *_test database');
const control = new pg.Client({ connectionString: parentUrl.toString() });
await control.connect();
const databaseName = `appearance_${randomUUID().replaceAll('-', '')}_test`;
await control.query(`CREATE DATABASE "${databaseName}"`);
const databaseUrl = new URL(parentUrl);
databaseUrl.pathname = `/${databaseName}`;
const db = createDatabase(databaseUrl.toString());
const app = buildApp({ db, sessionSecret: randomBytes(32).toString('hex') });
const evidence = resolve('.artifacts/acceptance/0.1.5-appearance');
await mkdir(evidence, { recursive: true });
const observations: string[] = [];
let browser: Browser | undefined;
let companion: CompanionRuntime | undefined;
async function themes(page: Page) {
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: '外观与主题', exact: true }).click();
}
try {
  await migrate(db);
  const userId = randomUUID();
  const email = `${userId}@example.test`;
  const password = randomBytes(24).toString('hex');
  await db.query(
    'INSERT INTO users(id,email,name,password_hash,instance_admin) VALUES ($1,$2,$3,$4,true)',
    [userId, email, '主题验收（合成账号）', await hash(password)],
  );
  const origin = await app.listen({ host: '127.0.0.1', port: 0 });
  const login = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email, password, deviceName: 'acceptance-seed' },
  });
  const cookieHeader = login.headers['set-cookie'];
  const cookie = (Array.isArray(cookieHeader) ? cookieHeader[0] : cookieHeader)!;
  const space = await app.inject({
    method: 'POST',
    url: '/api/v1/spaces',
    headers: { cookie, 'idempotency-key': randomUUID() },
    payload: {
      name: '主题验收空间',
      icon: 'T',
      color: '#386447',
      description: '独立数据库，合成任务',
    },
  });
  expect(space.statusCode).toBe(201);
  companion = await createCompanion({
    dataDirectory: await mkdtemp(resolve(evidence, 'companion-')),
    upstream: `${origin}/`,
    port: 0,
    embeddedWebRoot: resolve('dist/web'),
  });
  const loggedIn = await companion.app.inject({
    method: 'POST',
    url: '/v1/browser/login',
    headers: { 'x-taskboard-companion-key': companion.clientKey },
    payload: { email, password, deviceName: 'embedded-acceptance' },
  });
  expect(loggedIn.statusCode).toBe(200);
  browser = await chromium.launch({
    headless: true,
    channel: process.env.CI ? undefined : 'chrome',
  });
  const embeddedContext = await browser.newContext({ viewport: { width: 420, height: 850 } });
  const embedded = await embeddedContext.newPage();
  await embedded.goto(companion.embeddedUrl);
  await themes(embedded);
  await expect(embedded.locator('.appearance-settings [role=status]')).toContainText(
    '已同步到账号',
    { timeout: 15000 },
  );
  observations.push('生产内嵌页面确认服务器身份并读取账号主题');
  await embedded.locator('.theme-choice').filter({ hasText: '自然岛屿' }).click();
  await embedded.getByRole('button', { name: '深色', exact: true }).click();
  await embedded.getByRole('button', { name: '应用主题', exact: true }).click();
  await expect(embedded.locator('.appearance-settings [role=status]')).toContainText(
    '已同步到账号',
  );
  await expect
    .poll(
      async () =>
        (await db.query('SELECT preferences FROM user_appearance WHERE user_id=$1', [userId]))
          .rows[0]?.preferences,
      { timeout: 15000 },
    )
    .toMatchObject({ themeId: 'island', mode: 'dark' });
  observations.push('内嵌主题真实写入 PostgreSQL（保留原有来源与能力校验）');
  const secondContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const browserLogin = await secondContext.request.post(`${origin}/api/v1/auth/login`, {
    data: { email, password, deviceName: 'browser-acceptance' },
  });
  expect(browserLogin.ok()).toBe(true);
  const second = await secondContext.newPage();
  await second.goto(origin);
  await themes(second);
  await expect(second.locator('html')).toHaveAttribute('data-style', 'island');
  await expect(second.locator('html')).toHaveAttribute('data-theme', 'dark');
  observations.push('独立浏览器通过真实账号读取内嵌页面的选择');
  const manifest = {
    formatVersion: 1,
    name: '验收森林',
    author: 'Synthetic acceptance',
    version: '1.0.0',
    base: 'island',
    layout: 'rail',
    light: { accent: '#285040' },
    dark: { accent: '#b8d8a5' },
  };
  await embedded
    .getByLabel('主题文件', { exact: true })
    .setInputFiles({
      name: 'forest.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(manifest)),
    });
  await expect(embedded.locator('.theme-choice').filter({ hasText: '验收森林' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await embedded.getByRole('button', { name: '应用主题', exact: true }).click();
  await expect
    .poll(
      async () =>
        (
          await db.query('SELECT count(*)::int AS count FROM user_themes WHERE user_id=$1', [
            userId,
          ])
        ).rows[0].count,
      { timeout: 15000 },
    )
    .toBe(1);
  await expect(embedded.getByRole('button', { name: '应用主题', exact: true })).toBeDisabled();
  await second.evaluate(() => dispatchEvent(new Event('focus')));
  await expect(second.locator('.theme-choice').filter({ hasText: '验收森林' })).toHaveAttribute(
    'aria-pressed',
    'true',
    { timeout: 15000 },
  );
  observations.push('自定义主题经真实伴随服务上传、按内容去重并同步到另一设备');
  await embeddedContext.setOffline(true);
  await embedded.locator('.theme-choice').filter({ hasText: '极简' }).click();
  await embedded.getByRole('button', { name: '应用主题', exact: true }).click();
  await expect(embedded.locator('.appearance-settings [role=status]')).toContainText('待同步');
  await second.locator('.theme-choice').filter({ hasText: '开发者' }).click();
  await second.getByRole('button', { name: '应用主题', exact: true }).click();
  await expect
    .poll(
      async () =>
        (await db.query('SELECT preferences FROM user_appearance WHERE user_id=$1', [userId]))
          .rows[0].preferences.themeId,
      { timeout: 15000 },
    )
    .toBe('studio');
  await embeddedContext.setOffline(false);
  await embedded.evaluate(() => dispatchEvent(new Event('online')));
  await embedded.getByRole('button', { name: '使用云端' }).click({ timeout: 15000 });
  await expect(embedded.locator('html')).toHaveAttribute('data-style', 'studio');
  observations.push('真实离线选择与另一设备的修改产生版本冲突，显式选择云端后收敛');
  await embedded.locator('.theme-choice').filter({ hasText: '验收森林' }).click();
  await embedded.getByRole('button', { name: '应用主题', exact: true }).click();
  await expect
    .poll(
      async () =>
        (await db.query('SELECT preferences FROM user_appearance WHERE user_id=$1', [userId]))
          .rows[0].preferences.themeId,
      { timeout: 15000 },
    )
    .toMatch(/^[a-f0-9]{64}$/);
  await embedded.getByRole('button', { name: '移除主题' }).click();
  await expect(embedded.locator('html')).toHaveAttribute('data-style', 'glass');
  await second.evaluate(() => dispatchEvent(new Event('focus')));
  await expect(second.locator('html')).toHaveAttribute('data-style', 'glass');
  await expect(second.locator('.theme-choice').filter({ hasText: '验收森林' })).toHaveCount(0);
  observations.push('删除正在使用的自定义主题在真实数据库中原子回退，并同步清理其他设备');
  const recovery = await embeddedContext.newPage();
  await recovery.route('**/v1/browser/identity', (route) => route.abort('connectionreset'), {
    times: 1,
  });
  await recovery.goto(companion.embeddedUrl);
  await themes(recovery);
  await expect(recovery.locator('.appearance-settings [role=status]')).toContainText(
    '暂时无法读取主题配置',
  );
  await recovery.evaluate(() => dispatchEvent(new Event('online')));
  await expect(recovery.locator('.appearance-settings [role=status]')).toContainText(
    '已同步到账号',
    { timeout: 15000 },
  );
  observations.push('首次身份读取发生网络中断后，重连可恢复初始化，不永久停留在未保存状态');
  const demo = await embeddedContext.newPage();
  await demo.goto(`${companion.embeddedUrl}&demo=1`);
  await themes(demo);
  await expect(demo.locator('.appearance-settings [role=status]')).toContainText('演示模式');
  await demo.locator('.theme-choice').filter({ hasText: '极简' }).click();
  await demo.getByRole('button', { name: '应用主题', exact: true }).click();
  await demo.reload();
  await expect(demo.locator('html')).toHaveAttribute('data-style', 'paper');
  expect((await db.query('SELECT preferences FROM user_appearance WHERE user_id=$1', [userId])).rows[0].preferences.themeId).toBe('glass');
  observations.push('内嵌演示模式独立保存外观，不读取或覆盖已登录账号的主题');
  await embedded.screenshot({ path: resolve(evidence, 'embedded-final-dark.png') });
  await second.screenshot({ path: resolve(evidence, 'browser-final-dark.png') });
  console.log(
    'Production appearance checks passed: embedded companion, PostgreSQL persistence, custom packages, cross-device synchronization, offline conflict, deletion and initialization recovery.',
  );
} catch (error) {
  observations.push(`FAIL: ${error instanceof Error ? error.message : String(error)}`);
  throw error;
} finally {
  await writeFile(resolve(evidence, 'results.json'), JSON.stringify({ observations }, null, 2));
  await browser?.close();
  await companion?.stop();
  await app.close();
  await db.end();
  await control.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
  await control.end();
}
