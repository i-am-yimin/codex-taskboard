import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium, expect, type BrowserContext } from '@playwright/test';
import { hash } from '@node-rs/argon2';
import pg from 'pg';
import { buildApp } from '../apps/server/src/app.ts';
import { createDatabase } from '../apps/server/src/db.ts';
import { migrate } from '../apps/server/src/migrate.ts';

// Uses the production frontend and a fresh, isolated database. This deliberately
// closes Chrome and restarts its persistent profile with all networking offline.
const controlUrl = new URL(process.env.TEST_DATABASE_URL ?? '');
if (!controlUrl.pathname.endsWith('_test')) throw new Error('Requires an isolated *_test database');
const databaseName = `offline_${randomUUID().replaceAll('-', '')}_test`;
const control = new pg.Client({ connectionString: controlUrl.toString() });
await control.connect();
await control.query(`CREATE DATABASE "${databaseName}"`);
const databaseUrl = new URL(controlUrl);
databaseUrl.pathname = `/${databaseName}`;
const db = createDatabase(databaseUrl.toString());
const origin = 'http://127.0.0.1:47834';
const app = buildApp({ db, sessionSecret: randomBytes(32).toString('hex'), origin, logger: false });
const artifacts = resolve('.artifacts');
await mkdir(artifacts, { recursive: true });
const profile = await mkdtemp(resolve(artifacts, 'offline-chrome-'));
async function removeTestProfile() {
  const child = relative(artifacts, resolve(profile));
  if (!child || child.startsWith('..') || child.includes(':'))
    throw new Error('Unsafe test-profile cleanup');
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
async function dropTestDatabase() {
  // pg-pool can resolve end() before its idle sockets finish closing. Wait
  // for PostgreSQL to observe the disconnect instead of killing the sockets.
  const deadline = Date.now() + 15_000;
  while (true) {
    const result = await control.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname = $1',
      [databaseName],
    );
    if (result.rows[0]?.count === 0) break;
    if (Date.now() >= deadline) throw new Error('Offline test database connections did not close');
    await delay(50);
  }
  await control.query(`DROP DATABASE "${databaseName}"`);
}
let context: BrowserContext | undefined;
try {
  await migrate(db);
  const email = 'offline-smoke@example.test';
  const password = 'offline-smoke-password-2026';
  await db.query('INSERT INTO users(id,email,name,password_hash) VALUES ($1,$2,$3,$4)', [
    randomUUID(),
    email,
    '离线验收',
    await hash(password),
  ]);
  await app.listen({ host: '127.0.0.1', port: 47834 });
  const launch = (offline: boolean) =>
    chromium.launchPersistentContext(profile, {
      channel: process.env.CI ? undefined : 'chrome',
      headless: true,
      offline,
      viewport: { width: 1280, height: 800 },
    });
  context = await launch(false);
  let page = await context.newPage();
  await page.goto(origin);
  await page.getByLabel('邮箱', { exact: true }).fill(email);
  await page.getByLabel('密码', { exact: true }).fill(password);
  await page.getByRole('button', { name: '登录并继续' }).click();
  await page.getByPlaceholder('例如：产品工作室').fill('离线验收空间');
  await page.getByRole('button', { name: '创建空间', exact: true }).click();
  await page.getByRole('button', { name: '新建任务', exact: true }).click();
  await page.getByLabel('任务标题', { exact: true }).fill('离线前已同步的任务');
  await page.getByRole('button', { name: '创建任务', exact: true }).click();
  await page.getByText('离线前已同步的任务', { exact: true }).click();
  await page.getByRole('textbox', { name: '任务标题', exact: true }).fill('重开后应保留的草稿');
  await page.waitForFunction(async () => {
    const cache = await caches.open('taskboard-shell-v1');
    const keys = await cache.keys();
    return (
      !!(await cache.match('/')) &&
      keys.some((r) => r.url.endsWith('.js')) &&
      keys.some((r) => r.url.endsWith('.css')) &&
      !!localStorage.getItem('tb:offline-session:v1') &&
      Object.keys(localStorage).some((key) => key.startsWith('tb:draft:'))
    );
  });
  await context.close();
  context = await launch(true);
  page = await context.newPage();
  await page.goto(origin);
  await expect(page.getByText('离线前已同步的任务', { exact: true })).toBeVisible();
  await expect(page.getByText(/此状态未验证登录或权限/)).toBeVisible();
  await expect(page.getByRole('button', { name: '新建任务', exact: true })).toBeDisabled();
  await page.getByText('离线前已同步的任务', { exact: true }).click();
  await expect(page.getByRole('textbox', { name: '任务标题', exact: true })).toHaveValue(
    '重开后应保留的草稿',
  );
  await expect(page.getByRole('button', { name: '保存任务', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '领取任务', exact: true })).toBeDisabled();
  await page.screenshot({ path: resolve(artifacts, 'offline-cold-start.png') });
  await context.setOffline(false);
  await page.reload();
  await expect(page.getByText('离线前已同步的任务', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '新建任务', exact: true })).toBeEnabled();
  // Revoke the actual signed-in device while the UI is live, then verify that
  // its next offline launch cannot recover the account's cached board or draft.
  const devicesResponse = await page.request.get(`${origin}/api/v1/devices`);
  const devices = (await devicesResponse.json()).data as { id: string; current: boolean }[];
  const current = devices.find((device) => device.current);
  if (!current) throw new Error('No current device to revoke');
  const revocation = await page.request.post(`${origin}/api/v1/devices/${current.id}/revoke`, {
    headers: { Origin: origin, 'Idempotency-Key': randomUUID() },
    data: {},
  });
  if (!revocation.ok()) throw new Error(`Device revocation returned ${revocation.status()}`);
  await page.waitForFunction(
    () =>
      !localStorage.getItem('tb:offline-session:v1') &&
      !Object.keys(localStorage).some((key) => key.startsWith('tb:draft:')),
  );
  // Revoking the current device must also replace the live UI with login;
  // clearing persisted snapshots alone leaves a misleading first-space page.
  await page.screenshot({ path: resolve(artifacts, 'offline-revoked-live.png') });
  await expect(page.getByLabel('邮箱', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: '创建你的第一个任务空间', exact: true }),
  ).toHaveCount(0);
  await context.close();
  context = await launch(true);
  page = await context.newPage();
  await page.goto(origin);
  await expect(page.getByLabel('邮箱', { exact: true })).toBeVisible();
  await expect(page.getByText('离线前已同步的任务', { exact: true })).toHaveCount(0);
  console.log(
    'Production offline cold restart, draft preservation, read-only controls, reconnect and revocation verified.',
  );
} finally {
  await context?.close();
  await app.close();
  await db.end();
  try {
    await dropTestDatabase();
  } finally {
    await control.end();
    await removeTestProfile();
  }
}
