import { test, expect } from '@playwright/test';
import { demoUser, makeDemoBoard } from '../../apps/web/src/demo';

for (const status of [502, 503, 504]) {
  test(`cold gateway ${status} restores cached board and unsent draft as read-only`, async ({
    page,
  }) => {
    const board = makeDemoBoard();
    const task = board.tasks[0];
    const unsent = { ...task, title: '网关恢复前保留的未发送草稿' };
    await page.addInitScript(
      ({ account, cachedBoard, draft }) => {
        localStorage.setItem(
          'tb:offline-session:v1',
          JSON.stringify({
            version: 1,
            account,
            spaces: [cachedBoard.space],
            boards: { [cachedBoard.space.id]: cachedBoard },
            updatedAt: new Date().toISOString(),
          }),
        );
        localStorage.setItem(
          `tb:board:${account.id}:${cachedBoard.space.id}`,
          JSON.stringify(cachedBoard),
        );
        localStorage.setItem(
          `tb:draft:${account.id}:${draft.id}`,
          JSON.stringify({
            draft,
            baseVersion: draft.version,
          }),
        );
      },
      { account: demoUser, cachedBoard: board, draft: unsent },
    );
    await page.route('**/api/v1/**', (route) =>
      route.fulfill({ status, body: '<h1>Gateway unavailable</h1>', contentType: 'text/html' }),
    );
    await page.goto('/');
    await expect(page.getByText(/此状态未验证登录或权限/)).toBeVisible();
    await expect(page.locator('.task-card').getByText(task.title, { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '新建任务', exact: true })).toBeDisabled();
    await page.locator('.task-card').getByText(task.title, { exact: true }).click();
    await expect(page.getByRole('textbox', { name: '任务标题', exact: true })).toHaveValue(
      unsent.title,
    );
    await expect(page.getByRole('button', { name: '保存任务', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: '领取任务', exact: true })).toBeDisabled();
    expect(await page.evaluate(() => localStorage.getItem('tb:offline-session:v1'))).not.toBeNull();
  });
}

for (const status of [401, 403]) {
  test(`cold authorization ${status} clears cached account instead of restoring it`, async ({
    page,
  }) => {
    const board = makeDemoBoard();
    await page.addInitScript(
      ({ account, cachedBoard }) => {
        localStorage.setItem(
          'tb:offline-session:v1',
          JSON.stringify({
            version: 1,
            account,
            spaces: [cachedBoard.space],
            boards: { [cachedBoard.space.id]: cachedBoard },
            updatedAt: new Date().toISOString(),
          }),
        );
        localStorage.setItem(
          `tb:board:${account.id}:${cachedBoard.space.id}`,
          JSON.stringify(cachedBoard),
        );
        localStorage.setItem(
          `tb:draft:${account.id}:${cachedBoard.tasks[0].id}`,
          'unsent private draft',
        );
      },
      { account: demoUser, cachedBoard: board },
    );
    await page.route('**/api/v1/**', (route) =>
      route.fulfill({
        status,
        json: { error: { code: 'UNAUTHORIZED', message: 'Session no longer authorized' } },
      }),
    );
    await page.goto('/');
    await expect(page.getByLabel('邮箱', { exact: true })).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('tb:offline-session:v1')))
      .toBeNull();
    expect(
      await page.evaluate(() =>
        Object.keys(localStorage).filter(
          (key) => key.startsWith('tb:board:') || key.startsWith('tb:draft:'),
        ),
      ),
    ).toEqual([]);
    await expect(page.locator('.task-card')).toHaveCount(0);
  });
}
