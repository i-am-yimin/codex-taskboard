import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { hash } from '@node-rs/argon2';
import sharp from 'sharp';
import { startAccountTestServer } from '../fixtures/account-server';
import { createDatabase, type Database } from '../../apps/server/src/db';
import { migrate } from '../../apps/server/src/migrate';
import type { MailMessage } from '../../apps/server/src/account-mail';

test.describe('0.1.11 account center with PostgreSQL and production web', () => {
  test.skip(!process.env.TEST_DATABASE_URL, 'Requires an isolated test database and built web');
  let db: Database,
    control: Database,
    app: Awaited<ReturnType<typeof startAccountTestServer>>,
    base: string,
    schema: string,
    ownerId: string;
  const password = 'browser-account-center-2026';
  const email = 'account-admin@example.test';
  const messages: MailMessage[] = [];
  test.beforeAll(async () => {
    const url = new URL(process.env.TEST_DATABASE_URL!);
    if (!url.pathname.endsWith('_test')) throw new Error('Use an independent *_test database');
    control = createDatabase(url.toString());
    schema = `browser_account_${randomUUID().replaceAll('-', '')}`;
    await control.query(`CREATE SCHEMA "${schema}"`);
    url.searchParams.set('options', `-csearch_path=${schema}`);
    db = createDatabase(url.toString());
    await migrate(db);
    ownerId = randomUUID();
    await db.query(
      'INSERT INTO users(id,email,name,password_hash,instance_admin) VALUES($1,$2,$3,$4,true)',
      [ownerId, email, '用户中心验收管理员', await hash(password)],
    );
    app = await startAccountTestServer(
      {
        databaseUrl: url.toString(),
        sessionSecret: 'a'.repeat(64),
        encryptionKey: 'd'.repeat(64),
      },
      messages,
    );
    base = app.base;
    await db.query(
      "INSERT INTO instance_settings(id,public_origin,log_level) VALUES(1,$1,'info')",
      [base],
    );
  });
  test.afterAll(async () => {
    await app?.close();
    await db?.end();
    if (control) {
      await control.query(`DROP SCHEMA "${schema}" CASCADE`);
      await control.end();
    }
  });
  test('edits an account without spaces, crops avatar, validates email, manages SMTP and takes over a space', async ({
    page,
    browser,
  }) => {
    test.setTimeout(180000);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${base}/#account/profile`);
    await page.getByLabel('邮箱', { exact: true }).fill(email);
    await page.getByLabel('密码', { exact: true }).fill(password);
    await page.getByRole('button', { name: '登录并继续' }).click();
    await expect(page.getByRole('heading', { name: '个人设置', exact: true })).toBeVisible();
    await page.getByLabel('名称', { exact: true }).fill('更新后的长中文显示名称与跨设备账号');
    await page.getByLabel('手机号', { exact: true }).fill('synthetic-private-phone');
    await page.getByLabel('微信', { exact: true }).fill('synthetic-wechat');
    await page.getByLabel('名称', { exact: true }).focus();
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('手机号', { exact: true })).toBeFocused();
    page.once('dialog', (dialog) => dialog.dismiss());
    await page.getByRole('button', { name: '返回看板', exact: true }).click();
    await expect(page.getByLabel('手机号', { exact: true })).toHaveValue('synthetic-private-phone');
    page.once('dialog', (dialog) => dialog.dismiss());
    await page.evaluate(() => {
      location.hash = 'admin';
    });
    await expect(page).toHaveURL(/#account\/profile$/);
    await expect(page.getByLabel('手机号', { exact: true })).toHaveValue('synthetic-private-phone');
    await expect(page.getByRole('button', { name: '保存资料' })).toBeEnabled();
    await page.route('**/api/v1/me/profile', async (route) => {
      if (route.request().method() === 'PATCH')
        await route.fulfill({
          status: 409,
          json: { error: { code: 'VERSION_CONFLICT', message: '合成保存失败，请重试' } },
        });
      else await route.continue();
    });
    await page.getByRole('button', { name: '保存资料' }).click();
    await expect(page.getByRole('alert')).toContainText('合成保存失败，请重试');
    await expect(page.getByLabel('手机号', { exact: true })).toHaveValue('synthetic-private-phone');
    await page.unroute('**/api/v1/me/profile');
    await page.getByRole('button', { name: '保存资料' }).click();
    await expect(page.getByRole('status')).toContainText('个人资料已保存');
    const png = await sharp({
      create: { width: 500, height: 300, channels: 3, background: '#b46e3c' },
    })
      .png()
      .toBuffer();
    await page
      .locator('input[type=file]')
      .setInputFiles({ name: 'synthetic-avatar.png', mimeType: 'image/png', buffer: png });
    await expect(page.getByLabel('头像裁剪预览')).toBeVisible();
    await page.getByLabel('缩放', { exact: true }).fill('1.5');
    await page.getByRole('button', { name: '保存头像', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('头像已保存');
    await expect(page.locator('.account-large-avatar img')).toBeVisible();
    const output = resolve('.artifacts/acceptance-0.1.11');
    await mkdir(output, { recursive: true });
    if (test.info().project.name === 'desktop') {
      for (const theme of ['glass', 'paper', 'studio', 'island'])
        for (const mode of ['light', 'dark']) {
          await page.evaluate(
            async ({ theme, mode }) => {
              const current = (await (await fetch('/api/v1/me/appearance')).json()).data;
              const result = await fetch('/api/v1/me/appearance', {
                method: 'PUT',
                headers: {
                  'content-type': 'application/json',
                  'if-match': String(current.version),
                  'idempotency-key': crypto.randomUUID(),
                },
                body: JSON.stringify({ themeId: theme, mode, layout: 'auto' }),
              });
              if (!result.ok) throw new Error('Could not configure acceptance theme');
            },
            { theme, mode },
          );
          await page.reload();
          await expect(page.locator('html')).toHaveAttribute('data-style', theme);
          await expect(page.locator('html')).toHaveAttribute('data-theme', mode);
          await expect(page.getByLabel('名称', { exact: true })).toHaveValue(
            '更新后的长中文显示名称与跨设备账号',
          );
          await expect(page.locator('.account-large-avatar img')).toBeVisible();
          await page.screenshot({
            path: resolve(output, `account-${theme}-${mode}.png`),
            fullPage: true,
          });
        }
    }
    await page.setViewportSize({ width: 360, height: 780 });
    await page.screenshot({
      path: resolve(output, `account-360-${test.info().project.name}.png`),
      fullPage: true,
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('button', { name: '设置分类', exact: true }).click();
    await page.getByRole('button', { name: '设备与会话', exact: true }).click();
    await expect(page.getByText('当前设备', { exact: true })).toBeVisible();
    await page.setViewportSize({ width: 1280, height: 850 });
    await page.goto(`${base}/#admin`);
    await expect(page.getByRole('heading', { name: '服务器管理', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '邮件服务', exact: true }).click();
    const smtpForm = page
      .locator('form')
      .filter({ has: page.getByRole('button', { name: '保存 SMTP 配置', exact: true }) });
    await smtpForm.getByLabel('SMTP 主机', { exact: true }).fill('smtp.example.test');
    await smtpForm.getByLabel('SMTP 用户名', { exact: true }).fill('synthetic-mail');
    await smtpForm.getByLabel('替换 SMTP 密码', { exact: true }).fill('synthetic-smtp-password');
    await smtpForm.getByLabel('发件人邮箱', { exact: true }).fill('taskboard@example.test');
    await smtpForm.getByLabel('当前管理员密码', { exact: true }).fill(password);
    await smtpForm.getByRole('button', { name: '保存 SMTP 配置', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'SMTP 配置已保存' })).toBeVisible();
    await page.getByRole('button', { name: '个人设置', exact: true }).click();
    await page.getByRole('button', { name: '账号安全', exact: true }).click();
    const emailForm = page
      .locator('form')
      .filter({ has: page.getByRole('button', { name: '发送验证或变更邮件', exact: true }) });
    await emailForm.getByLabel('当前密码', { exact: true }).fill(password);
    await emailForm.getByRole('button', { name: '发送验证或变更邮件', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('邮件已加入发送队列');
    await app.runAccountMail();
    const message = messages.find((message) => message.subject === '验证 Taskboard 邮箱')!;
    const verifyUrl = message.text.match(/http:\/\/\S+/)![0];
    await page.goto(verifyUrl);
    await page.getByRole('button', { name: '确认邮箱', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('邮箱已确认');
    const otherId = randomUUID();
    await db.query('INSERT INTO users(id,email,name,password_hash) VALUES($1,$2,$3,$4)', [
      otherId,
      'space-owner@example.test',
      '真实空间所有者',
      await hash(password),
    ]);
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'space-owner@example.test', password },
    });
    const cookie = String(login.headers['set-cookie']).split(';')[0];
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/spaces',
      headers: { cookie, 'idempotency-key': randomUUID() },
      payload: { name: '接管验收私有空间' },
    });
    expect(created.statusCode).toBe(201);
    await page.goto(`${base}/#admin`);
    await page.getByRole('button', { name: '空间治理', exact: true }).click();
    await page.getByRole('button', { name: '接管空间', exact: true }).click();
    await page.getByLabel('操作原因', { exact: true }).fill('0.1.11 独立合成数据验收');
    await page.getByLabel('当前管理员密码', { exact: true }).fill(password);
    await page.getByRole('button', { name: '接管并打开空间', exact: true }).click();
    await expect(page.getByText(/正在接管此空间/)).toBeVisible();
    expect(
      await page.evaluate(() =>
        Object.entries(localStorage)
          .filter(([key]) => key.startsWith('tb:board:') || key.startsWith('tb:offline-session:'))
          .some(([, value]) => value.includes('接管验收私有空间')),
      ),
    ).toBe(false);
    await page.screenshot({
      path: resolve(output, `takeover-${test.info().project.name}.png`),
      fullPage: true,
    });
    await page.getByRole('button', { name: '退出接管', exact: true }).click();
    await expect(page.getByRole('heading', { name: '服务器管理', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '审计日志', exact: true }).click();
    await expect(page.getByText('space.takeover_started', { exact: true })).toBeVisible();
    expect(
      (
        await db.query('SELECT count(*) FROM space_members WHERE user_id=$1 AND space_id=$2', [
          ownerId,
          created.json().data.id,
        ])
      ).rows[0].count,
    ).toBe('0');
    await page.getByRole('button', { name: '用户与邀请', exact: true }).click();
    const invitation = page
      .locator('form')
      .filter({ has: page.getByRole('button', { name: '发送邀请', exact: true }) });
    await invitation.getByLabel('受邀邮箱', { exact: true }).fill('ui-invited@example.test');
    await invitation.getByRole('button', { name: '发送邀请', exact: true }).click();
    await expect(
      page.getByRole('status').filter({ hasText: '邀请邮件已加入发送队列' }),
    ).toBeVisible();
    await app.runAccountMail();
    const inviteUrl = messages
      .find((message) => message.to === 'ui-invited@example.test')!
      .text.match(/http:\/\/\S+/)![0];
    const context = await browser.newContext();
    try {
      const member = await context.newPage();
      await member.goto(inviteUrl);
      await member.getByLabel('姓名', { exact: true }).fill('新受邀用户');
      await member.getByLabel('邮箱', { exact: true }).fill('ui-invited@example.test');
      await member.getByLabel('设置密码', { exact: true }).fill(password);
      await member.getByRole('button', { name: '接受邀请', exact: true }).click();
      await expect(member.getByRole('button', { name: '登录并继续', exact: true })).toBeVisible();
      await member.getByLabel('邮箱', { exact: true }).fill('ui-invited@example.test');
      await member.getByLabel('密码', { exact: true }).fill(password);
      await member.getByRole('button', { name: '登录并继续', exact: true }).click();
      await expect(member.getByLabel('账号菜单')).toBeVisible();
      await member.goto(`${base}/#account/devices`);
      const secondLogin = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: 'ui-invited@example.test', password, deviceName: 'secondary-ui-device' },
      });
      await member.reload();
      const secondary = member
        .locator('.account-device-list li')
        .filter({ hasText: 'secondary-ui-device' });
      await expect(secondary).toBeVisible();
      member.once('dialog', (dialog) => dialog.accept());
      await secondary.getByRole('button', { name: '撤销', exact: true }).click();
      await expect(secondary.getByText('已撤销', { exact: true })).toBeVisible();
      expect(
        (
          await app.inject({
            url: '/api/v1/me',
            headers: { cookie: String(secondLogin.headers['set-cookie']).split(';')[0] },
          })
        ).statusCode,
      ).toBe(401);
      await member.goto(`${base}/#forgot`);
      await member.getByLabel('邮箱', { exact: true }).fill('ui-invited@example.test');
      await member.getByRole('button', { name: '发送恢复邮件', exact: true }).click();
      await expect(member.getByRole('status')).toContainText('将收到恢复邮件');
      await app.runAccountMail();
      const recoveryUrl = messages
        .find(
          (message) =>
            message.to === 'ui-invited@example.test' && message.subject === '重设 Taskboard 密码',
        )!
        .text.match(/http:\/\/\S+/)![0];
      await member.goto(recoveryUrl);
      await member.getByLabel('新密码', { exact: true }).fill('new-browser-recovery-2026');
      await member.getByLabel('确认新密码', { exact: true }).fill('new-browser-recovery-2026');
      await member.getByRole('button', { name: '完成恢复', exact: true }).click();
      await expect(member.getByRole('button', { name: '登录并继续', exact: true })).toBeVisible();
      await member.getByLabel('邮箱', { exact: true }).fill('ui-invited@example.test');
      await member.getByLabel('密码', { exact: true }).fill('new-browser-recovery-2026');
      await member.getByRole('button', { name: '登录并继续', exact: true }).click();
      await expect(member.getByLabel('账号菜单')).toBeVisible();
    } finally {
      await context.close();
    }
    expect(errors).toEqual([]);
  });
});
