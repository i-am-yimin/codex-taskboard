import { compatibleServerHealth } from '../server-compatibility-fixture.ts';
import { test, expect, type Page } from '@playwright/test';
import { demoUser, makeDemoBoard, makeDemoDetail } from '../../apps/web/src/demo';
import type { TaskDetail } from '../../apps/web/src/types';

async function fixture(page: Page, configure?: (detail: TaskDetail) => void) {
  const board = makeDemoBoard();
  const detail = makeDemoDetail('t-27');
  detail.task = {
    ...detail.task,
    reviewerId: demoUser.id,
    acceptanceCriteria: '入口可恢复',
    requirementsVersion: 1,
  };
  detail.participants = [
    {
      taskId: detail.task.id,
      userId: demoUser.id,
      responsibility: '界面实现',
      progress: 20,
      summary: '',
      blockedReason: '',
      updatedAt: '2026-10-25T00:00:00Z',
    },
  ];
  detail.claims = [
    {
      id: 'claim-fixture',
      taskId: detail.task.id,
      actorId: demoUser.id,
      deviceId: 'synthetic',
      claimedAt: '2026-10-25T00:00:00Z',
      releasedAt: null,
      releaseReason: '',
    },
  ];
  configure?.(detail);
  board.tasks = board.tasks.map((task) => (task.id === detail.task.id ? detail.task : task));
  const writes: { path: string; body: Record<string, unknown>; key: string; version: string }[] =
    [];
  let rejectSubmission = false;
  await page.addInitScript(() => {
    class FakeEvents extends EventTarget {
      constructor() {
        super();
        setTimeout(() => this.dispatchEvent(new Event('ready')), 20);
      }
      close() {}
    }
    Object.defineProperty(window, 'EventSource', { value: FakeEvents });
  });
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace('/api/v1', '');
    let data: unknown = {};
    if (path === '/health') data = compatibleServerHealth;
    else if (path === '/setup') data = { required: false };
    if (path === '/me') data = demoUser;
    if (path === '/spaces') data = [board.space];
    if (path.endsWith('/board')) data = board;
    if (path === `/tasks/${detail.task.id}/detail`) data = detail;
    if (path === '/me/themes' || path === '/me/saved-filters') data = [];
    if (path === '/me/tasks') data = { items: [detail.task], nextCursor: null };
    if (path === '/me/appearance')
      return route.fulfill({
        status: 404,
        json: { error: { code: 'NOT_FOUND', message: 'unsupported' } },
      });
    if (!['GET', 'HEAD'].includes(req.method())) {
      const body = req.postDataJSON() ?? {};
      writes.push({
        path,
        body,
        key: req.headers()['idempotency-key'],
        version: req.headers()['if-match'],
      });
      if (path.endsWith('/submit') && rejectSubmission) return route.abort('connectionfailed');
      if (req.method() === 'PATCH' && path === `/tasks/${detail.task.id}`) {
        detail.task = { ...detail.task, ...body, version: detail.task.version + 1 };
        data = detail.task;
      }
    }
    return route.fulfill({ json: { data } });
  });
  await page.goto('/?space=space-work&task=t-27');
  await expect(page.getByRole('dialog', { name: '任务详情' })).toBeVisible();
  await expect(page.getByRole('button', { name: '保存任务', exact: true })).toBeEnabled();
  return {
    detail,
    writes,
    reject: () => {
      rejectSubmission = true;
    },
  };
}

test('ordinary edits send only changed fields and comments retain their local draft', async ({
  page,
}) => {
  const { writes } = await fixture(page);
  await page.getByRole('textbox', { name: '任务标签' }).fill('界面, 可访问性');
  await page.getByRole('button', { name: '保存任务', exact: true }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0].body).toEqual({ labels: ['界面', '可访问性'] });
  await page.getByRole('textbox', { name: '评论', exact: true }).fill('仍未发送的讨论草稿');
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('button', { name: /完成 Codex 桌面端看板入口/ }).click();
  await expect(page.getByRole('textbox', { name: '评论', exact: true })).toHaveValue(
    '仍未发送的讨论草稿',
  );
});

test('failed result submission preserves materials and reuses the exact request key and version', async ({
  page,
}) => {
  const server = await fixture(page);
  server.reject();
  await page.getByRole('button', { name: '提交结果至待验收' }).click();
  const modal = page.getByRole('dialog', { name: '提交验收结果' });
  await modal.getByLabel('完成说明').fill('完成入口与键盘操作');
  await modal.getByLabel('验证记录').fill('独立浏览器验证，未验证安装器');
  await modal.getByLabel('交接摘要').fill('待指定验收人复核');
  await modal.getByLabel('已知限制').fill('未运行真实 Codex');
  await modal.getByRole('button', { name: '提交验收', exact: true }).click();
  await expect(modal.getByText('当前无法连接到任务看板服务器')).toBeVisible();
  await modal.getByRole('button', { name: '提交验收', exact: true }).click();
  await expect
    .poll(() => server.writes.filter((write) => write.path.endsWith('/submit')).length)
    .toBe(2);
  const attempts = server.writes.filter((write) => write.path.endsWith('/submit'));
  expect(attempts[0]).toEqual(attempts[1]);
  expect(attempts[0].body.requirementsVersion).toBe(1);
  await expect(modal.getByLabel('完成说明')).toHaveValue('完成入口与键盘操作');
});

test('AI split remains a proposal until a human confirms adjusted child fields', async ({
  page,
}) => {
  const { writes } = await fixture(page, (detail) => {
    detail.proposals = [
      {
        id: 'proposal-fixture',
        taskId: detail.task.id,
        kind: 'split',
        payload: {
          children: [
            {
              title: 'AI 原始拆分',
              description: '待人核对',
              assigneeId: demoUser.id,
              reviewerId: demoUser.id,
              acceptanceCriteria: '独立验证',
              requiredForParent: true,
            },
          ],
        },
        source: 'agent',
        proposedBy: demoUser.id,
        baseTaskVersion: detail.task.version,
        baseRequirementsVersion: 1,
        state: 'proposed',
        confirmedBy: null,
        confirmedAt: null,
        createdAt: '2026-10-25T00:00:00Z',
      },
    ];
  });
  await expect(page.getByText('AI 提议 · 任务拆分')).toBeVisible();
  await page
    .locator('.proposal-item')
    .getByLabel('子任务标题', { exact: true })
    .fill('人类调整后的拆分');
  expect(writes).toHaveLength(0);
  await page.getByRole('button', { name: '确认并应用调整' }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0].path).toContain('/proposals/proposal-fixture/confirm');
  expect(writes[0].body).toMatchObject({ payload: { children: [{ title: '人类调整后的拆分' }] } });
});

test('reduced motion keeps status text and keyboard escape restores the board', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await fixture(page);
  const duration = await page
    .getByRole('dialog', { name: '任务详情' })
    .evaluate((element) => getComputedStyle(element).animationDuration);
  expect(Number.parseFloat(duration)).toBeLessThanOrEqual(0.08);
  await expect(page.getByText('领取只保留处理权，不表示进程已启动')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: '任务详情' })).toHaveCount(0);
  await expect(page.locator('.topbar-brand .taskboard-brand__mark')).toBeVisible();
});

test('captures four theme pairs and a narrow drawer with synthetic data', async ({ page }) => {
  await fixture(page);
  for (const style of ['glass', 'paper', 'studio', 'island']) {
    for (const mode of ['light', 'dark']) {
      await page.evaluate(
        async ({ style, mode }) => {
          const modulePath = '/src/themes.ts';
          const { applyAppearance } = await import(modulePath);
          applyAppearance({ themeId: style, mode, layout: 'auto' }, [], false);
        },
        { style, mode },
      );
      await page.screenshot({
        path: `.artifacts/collaboration-ui/${style}-${mode}.png`,
        fullPage: true,
      });
    }
  }
  await page.setViewportSize({ width: 360, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.screenshot({ path: '.artifacts/collaboration-ui/narrow-dark.png', fullPage: true });
  const drawer = page.getByRole('dialog', { name: '任务详情' });
  const bounds = await drawer.boundingBox();
  expect(bounds?.width).toBeLessThanOrEqual(360);
  expect(await drawer.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
});

test('legacy execution PR references link only valid HTTPS and retain ordinary report text', async ({
  page,
}) => {
  const references = [
    'https://example.test/pull/42',
    'http://example.test/pull/42',
    'javascript:alert(1)',
    'data:text/html,legacy-report',
    '//example.test/pull/42',
    'https://',
  ];
  await fixture(page, (detail) => {
    detail.executions = references.map((prUrl, index) => ({
      id: `legacy-execution-${index}`,
      taskId: detail.task.id,
      actorId: demoUser.id,
      deviceId: 'synthetic-legacy-device',
      threadId: null,
      phase: 'submitted',
      prUrl,
      summary: `存量报告 ${index + 1}`,
      verification: `保留的验证文字 ${index + 1}`,
      createdAt: '2026-10-25T00:00:00Z',
    }));
  });
  const history = page.locator('.execution');
  await expect(history.getByRole('link', { name: '关联 PR', exact: true })).toHaveCount(1);
  await expect(history.getByRole('link', { name: '关联 PR', exact: true })).toHaveAttribute(
    'href',
    references[0],
  );
  for (let index = 0; index < references.length; index++) {
    const report = history.locator('.activity').filter({ hasText: `存量报告 ${index + 1}` });
    await expect(report.getByText(`保留的验证文字 ${index + 1}`, { exact: true })).toBeVisible();
    if (index > 0) {
      await expect(
        report.getByText(`PR 引用：${references[index]}`, { exact: true }),
      ).toBeVisible();
      await expect(report.locator('a')).toHaveCount(0);
    }
  }
});
