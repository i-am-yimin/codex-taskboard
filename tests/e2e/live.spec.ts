import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { hash } from '@node-rs/argon2';
import pg from 'pg';

test.describe('real PostgreSQL browser collaboration', () => {
  test.skip(!process.env.TEST_DATABASE_URL, 'Requires isolated PostgreSQL and live-preview API');
  test('two devices receive updates and preserve a conflicting local draft', async ({
    page,
    browser,
  }) => {
    const url = new URL(process.env.TEST_DATABASE_URL!);
    if (!url.pathname.endsWith('_test')) throw new Error('Use isolated *_test database');
    url.pathname = '/taskboard_preview';
    const db = new pg.Client({ connectionString: url.toString() });
    await db.connect();
    const email = `browser-${randomUUID()}@example.test`;
    const password = 'browser-test-password-2026';
    await db.query('INSERT INTO users(id,email,name,password_hash) VALUES ($1,$2,$3,$4)', [
      randomUUID(),
      email,
      '浏览器验收',
      await hash(password),
    ]);
    await db.end();
    const login = async (target: Page) => {
      await target.goto('/');
      await target.getByLabel('邮箱', { exact: true }).fill(email);
      await target.getByLabel('密码', { exact: true }).fill(password);
      await target.getByRole('button', { name: '登录并继续' }).click();
    };
    await login(page);
    await page.getByPlaceholder('例如：产品工作室').fill('真实协作验收');
    await page.getByRole('button', { name: '创建空间', exact: true }).click();
    await expect(page.getByRole('heading', { name: '任务看板', exact: true })).toBeVisible();
    if (test.info().project.name === 'compact')
      await page.screenshot({ path: test.info().outputPath('empty-state.png') });
    await page.getByRole('button', { name: '新建任务', exact: true }).click();
    await page.getByLabel('任务标题', { exact: true }).fill('同步前的标题');
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          /\/api\/v1\/spaces\/[^/]+\/tasks$/.test(new URL(response.url()).pathname) &&
          response.status() === 201,
      ),
      page.getByRole('button', { name: '创建任务', exact: true }).click(),
    ]);
    await expect(page.getByText('同步前的标题', { exact: true })).toBeVisible({ timeout: 10000 });
    const secondContext = await browser.newContext();
    const second = await secondContext.newPage();
    try {
      await login(second);
      await expect(second.getByText('同步前的标题', { exact: true })).toBeVisible();
      await page.getByText('同步前的标题', { exact: true }).click();
      await second.getByText('同步前的标题', { exact: true }).click();
      await page.getByRole('textbox', { name: '任务标题' }).fill('保留这份中文草稿');
      await second.getByRole('textbox', { name: '任务标题' }).fill('另一台设备已保存');
      await Promise.all([
        second.waitForResponse(
          (response) =>
            response.request().method() === 'PATCH' &&
            /\/api\/v1\/tasks\/[^/]+$/.test(new URL(response.url()).pathname) &&
            response.status() === 200,
        ),
        second.getByRole('button', { name: '保存任务', exact: true }).click(),
      ]);
      await expect(
        page.locator('.task-card').getByText('另一台设备已保存', { exact: true }),
      ).toBeVisible({ timeout: 2000 });
      await expect(page.getByRole('textbox', { name: '任务标题' })).toHaveValue('保留这份中文草稿');
      await page.getByRole('button', { name: '保存任务', exact: true }).click();
      await expect(page.locator('.conflict-box')).toBeVisible();
      if (test.info().project.name === 'compact')
        await page.screenshot({ path: test.info().outputPath('conflict-state.png') });
      await expect(page.getByRole('textbox', { name: '任务标题' })).toHaveValue('保留这份中文草稿');
      await page.reload();
      await page.getByText('另一台设备已保存', { exact: true }).click();
      await expect(page.getByRole('textbox', { name: '任务标题' })).toHaveValue('保留这份中文草稿');
      await page.getByRole('button', { name: '放弃草稿，加载最新内容' }).click();
      await second.getByRole('button', { name: '领取任务', exact: true }).click();
      await second.getByRole('button', { name: '提交结果至待验收' }).click();
      await second.getByLabel('完成说明', { exact: true }).fill('已完成真实浏览器协作验证');
      await second.getByLabel('验证记录', { exact: true }).fill('两端同步和冲突草稿检查通过');
      await second.getByRole('button', { name: '提交验收', exact: true }).click();
      await page.getByRole('button', { name: '验收并完成', exact: true }).click();
      await expect(
        second.locator('.drawer').getByRole('option', { name: '已完成', exact: true }),
      ).toHaveJSProperty('selected', true);
      await secondContext.setOffline(true);
      await expect(second.getByRole('button', { name: '领取任务', exact: true })).toBeDisabled();
      await expect(second.getByRole('button', { name: '保存任务', exact: true })).toBeDisabled();
      if (test.info().project.name === 'compact')
        await second.screenshot({ path: test.info().outputPath('offline-state.png') });
    } finally {
      await secondContext.close();
    }
  });
});
