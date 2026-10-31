import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { hash } from '@node-rs/argon2';
import { spawn, type ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';
import { createDatabase, type Database } from '../../apps/server/src/db';
import { migrate } from '../../apps/server/src/migrate';

test.describe('takeover privacy against the production server process', () => {
  test.skip(
    !process.env.TEST_DATABASE_URL,
    'Requires an isolated test database and production build',
  );
  let control: Database, db: Database, server: ChildProcess;
  let serverExit: Promise<void>;
  let adminId: string, normal: string, privateSpace: string, base: string;
  const schema = `privacy_${randomUUID().replaceAll('-', '')}`;
  const password = 'takeover-privacy-test-2026';
  test.beforeAll(async () => {
    const url = new URL(process.env.TEST_DATABASE_URL!);
    if (!url.pathname.endsWith('_test')) throw new Error('Use an isolated *_test database');
    control = createDatabase(url.toString());
    await control.query(`CREATE SCHEMA "${schema}"`);
    url.searchParams.set('options', `-csearch_path=${schema}`);
    db = createDatabase(url.toString());
    await migrate(db);
    adminId = randomUUID();
    const ownerId = randomUUID();
    await db.query(
      'INSERT INTO users(id,email,name,password_hash,instance_admin) VALUES($1,$2,$3,$4,true),($5,$6,$7,$4,false)',
      [
        adminId,
        'privacy-admin@example.test',
        'Privacy admin',
        await hash(password),
        ownerId,
        'privacy-owner@example.test',
        'Real owner',
      ],
    );
    normal = randomUUID();
    privateSpace = randomUUID();
    for (const [spaceId, name, owner] of [
      [normal, 'Ordinary owned space', adminId],
      [privateSpace, 'Private takeover metadata', ownerId],
    ]) {
      const statusId = randomUUID();
      await db.query('INSERT INTO spaces(id,name) VALUES($1,$2)', [spaceId, name]);
      await db.query("INSERT INTO space_members(space_id,user_id,role) VALUES($1,$2,'owner')", [
        spaceId,
        owner,
      ]);
      await db.query(
        "INSERT INTO statuses(id,space_id,name,semantic,position,color) VALUES($1,$2,'Todo','todo',0,'#64748b')",
        [statusId, spaceId],
      );
      if (spaceId === privateSpace)
        await db.query(
          'INSERT INTO tasks(id,space_id,number,title,status_id) VALUES($1,$2,1,$3,$4)',
          [randomUUID(), spaceId, 'Private takeover task', statusId],
        );
    }
    // Run the distributed backend outside Playwright's module loader. Pass only
    // synthetic credentials and the OS variables needed to load Node/native DLLs.
    const env: NodeJS.ProcessEnv = {};
    for (const key of [
      'PATH',
      'Path',
      'SystemRoot',
      'TEMP',
      'TMP',
      'USERPROFILE',
      'APPDATA',
      'LOCALAPPDATA',
    ])
      if (process.env[key]) env[key] = process.env[key];
    Object.assign(env, {
      DATABASE_URL: url.toString(),
      SESSION_KEY: 'e'.repeat(64),
      NODE_ENV: 'production',
      HOST: '127.0.0.1',
      PORT: '0',
    });
    server = spawn(process.execPath, [resolve('dist/server.js')], {
      cwd: process.cwd(),
      env,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    serverExit = new Promise((resolve) => server.once('exit', () => resolve()));
    base = await new Promise<string>((resolve, reject) => {
      let output = '';
      const timer = setTimeout(
        () => reject(new Error(`Production server startup timed out: ${output.slice(-1500)}`)),
        20000,
      );
      const receive = (chunk: Buffer) => {
        output += chunk.toString();
        const match = output.match(/Server listening at (http:\/\/127\.0\.0\.1:\d+)/);
        if (match) {
          clearTimeout(timer);
          resolve(match[1]);
        }
      };
      server.stdout!.on('data', receive);
      server.stderr!.on('data', receive);
      server.once('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      server.once('exit', (code) => {
        clearTimeout(timer);
        reject(new Error(`Production server exited (${code}): ${output.slice(-1500)}`));
      });
    });
    await db.query(
      "INSERT INTO instance_settings(id,public_origin,log_level) VALUES(1,$1,'info')",
      [base],
    );
  });
  test.afterAll(async () => {
    if (server && server.exitCode === null) {
      server.kill('SIGTERM');
      await serverExit;
    }
    await db?.end();
    if (control) {
      await control.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await control.end();
    }
  });
  test('takeover never persists task drafts or space metadata and clears the page at expiry', async ({
    page,
  }) => {
    await page.goto(base);
    await page.getByLabel('邮箱', { exact: true }).fill('privacy-admin@example.test');
    await page.getByLabel('密码', { exact: true }).fill(password);
    await page.getByRole('button', { name: '登录并继续', exact: true }).click();
    await expect(page.getByRole('heading', { name: '任务看板', exact: true })).toBeVisible();
    const grant = await page.request.post(`${base}/api/v1/admin/spaces/${privateSpace}/takeover`, {
      headers: { 'idempotency-key': randomUUID() },
      data: { currentPassword: password, reason: 'Independent privacy acceptance' },
    });
    expect(grant.status()).toBe(200);
    await page.goto(`${base}/?space=${privateSpace}`);
    await expect(page.getByText(/正在接管此空间/)).toBeVisible();
    await page.getByText('Private takeover task', { exact: true }).click();
    const drawer = page.getByRole('dialog', { name: '任务详情', exact: true });
    await drawer.getByLabel('任务标题', { exact: true }).fill('DO_NOT_PERSIST_PRIVATE_DRAFT');
    await drawer.getByPlaceholder('写一条评论…').fill('DO_NOT_PERSIST_PRIVATE_COMMENT');
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve(null))),
        ),
    );
    expect(
      await page.evaluate(() =>
        Object.values(localStorage).some((value) => value.includes('DO_NOT_PERSIST_PRIVATE')),
      ),
    ).toBe(false);
    await drawer.getByRole('button', { name: '关闭', exact: true }).click();
    await page.goto(`${base}/?space=${normal}`);
    await expect(page.getByRole('heading', { name: '任务看板', exact: true })).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('tb:offline-session:v1') ?? ''))
      .toContain('Ordinary owned space');
    expect(await page.evaluate(() => localStorage.getItem('tb:offline-session:v1'))).not.toContain(
      'Private takeover metadata',
    );
    await db.query(
      "UPDATE space_takeovers SET expires_at=clock_timestamp()+interval '3 seconds' WHERE space_id=$1",
      [privateSpace],
    );
    await page.goto(`${base}/?space=${privateSpace}`);
    await expect(page.getByText(/正在接管此空间/)).toBeVisible();
    await expect(page.getByRole('heading', { name: '服务器管理', exact: true })).toBeVisible({
      timeout: 10000,
    });
    expect(
      (
        await db.query('SELECT count(*) FROM space_members WHERE space_id=$1 AND user_id=$2', [
          privateSpace,
          adminId,
        ])
      ).rows[0].count,
    ).toBe('0');
  });
});
