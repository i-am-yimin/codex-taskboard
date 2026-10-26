import { test, expect, type Page } from '@playwright/test';
import { makeDemoBoard, makeDemoDetail, demoUser } from '../../apps/web/src/demo';
import { compatibleServerHealth } from '../server-compatibility-fixture';
async function fixture(page: Page, initial: 'legacy' | 'current' | 'offline') {
  let mode = initial;
  let healthRequests = 0;
  const unexpectedCompanionRequests: string[] = [];
  const writes: string[] = [];
  const board = makeDemoBoard();
  await page.addInitScript(() => {
    class Events extends EventTarget {
      constructor() {
        super();
        setTimeout(() => this.dispatchEvent(new Event('ready')), 20);
      }
      close() {}
    }
    Object.defineProperty(window, 'EventSource', { value: Events });
  });
  // Never permit an unhandled synthetic-native request to reach the user's companion.
  await page.route('http://127.0.0.1:47831/**', (route) => {
    unexpectedCompanionRequests.push(route.request().url());
    return route.abort('blockedbyclient');
  });
  await page.route('http://127.0.0.1:47831/v1/browser/identity', (route) =>
    route.fulfill({
      json: { data: { upstream: 'https://synthetic.test', accountId: demoUser.id } },
    }),
  );
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1', '');
    const method = route.request().method();
    if (path === '/health') {
      healthRequests++;
      if (mode === 'offline') return route.abort('failed');
      return route.fulfill({
        json: {
          data: mode === 'legacy' ? { status: 'ok', database: 'ok' } : compatibleServerHealth,
        },
      });
    }
    if (method !== 'GET') {
      writes.push(path);
      return route.fulfill({ json: { data: {} } });
    }
    let data: unknown = {};
    if (path === '/setup') data = { required: false };
    else if (path === '/me') data = demoUser;
    else if (path === '/spaces') data = [board.space];
    else if (path.endsWith('/board')) data = board;
    else if (path === '/tasks/missing/detail')
      return route.fulfill({
        status: 404,
        json: { error: { code: 'NOT_FOUND', message: '测试任务不存在' } },
      });
    else if (path.endsWith('/detail')) data = makeDemoDetail('t-27');
    else if (path === '/me/appearance')
      return route.fulfill({
        status: 404,
        json: { error: { code: 'NOT_FOUND', message: 'appearance unsupported' } },
      });
    else if (
      path === '/me/themes' ||
      path === '/me/saved-filters' ||
      path === '/me/notification-preferences' ||
      path.endsWith('/automation-rules')
    )
      data = [];
    else if (path === '/me/tasks') data = { items: board.tasks, nextCursor: null };
    else if (path === '/me/notifications') data = { items: [], nextCursor: null };
    return route.fulfill({ json: { data } });
  });
  return {
    setMode: (value: typeof mode) => {
      mode = value;
    },
    healthRequests: () => healthRequests,
    unexpectedCompanionRequests,
    writes,
  };
}
test('old health keeps the board read-only with preserved drafts and upgrades after explicit recheck', async ({
  page,
}) => {
  const server = await fixture(page, 'legacy');
  const board = makeDemoBoard();
  const key = `tb:draft:${demoUser.id}:t-27`;
  const saved = JSON.stringify({
    baseVersion: 1,
    spaceId: board.space.id,
    draft: { title: '保留的本机草稿' },
  });
  await page.addInitScript(({ key, saved }) => localStorage.setItem(key, saved), { key, saved });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '任务看板', exact: true })).toBeVisible();
  await expect(page.getByText('服务器需要升级', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '新建任务', exact: true })).toBeDisabled();
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(saved);
  expect(server.writes).toEqual([]);
  server.setMode('current');
  await page.getByRole('button', { name: '重新检查服务器' }).click();
  await expect(page.getByRole('button', { name: '新建任务', exact: true })).toBeEnabled();
  await expect(page.getByText('服务器需要升级', { exact: true })).toHaveCount(0);
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(saved);
});
test('failed capability probe is unverified connectivity rather than a false upgrade diagnosis', async ({
  page,
}) => {
  const server = await fixture(page, 'offline');
  await page.goto('/');
  await expect(page.getByText('暂时无法确认服务器兼容性', { exact: true })).toBeVisible();
  await expect(page.getByText('服务器需要升级', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '新建任务', exact: true })).toBeDisabled();
  server.setMode('current');
  await page.getByRole('button', { name: '重新检查服务器' }).click();
  await expect(page.getByRole('button', { name: '新建任务', exact: true })).toBeEnabled();
});
test('a compatible server task 404 remains a task error rather than a version error', async ({
  page,
}) => {
  await fixture(page, 'current');
  await page.goto('/?space=space-work&task=missing');
  await expect(page.getByText('测试任务不存在', { exact: true })).toBeVisible();
  await expect(page.getByText('服务器需要升级', { exact: true })).toHaveCount(0);
});
test('demo uses explicit synthetic state without probing a real server', async ({ page }) => {
  const server = await fixture(page, 'legacy');
  await page.goto('/?demo=1');
  await expect(page.getByRole('heading', { name: '任务看板', exact: true })).toBeVisible();
  await expect(page.getByText('服务器需要升级', { exact: true })).toHaveCount(0);
  expect(server.healthRequests()).toBe(0);
});

test('legacy capability still exposes existing run query and cancel without enabling a new start', async ({
  page,
}) => {
  const server = await fixture(page, 'legacy');
  const detail = makeDemoDetail('t-27');
  const run = {
    id: 'synthetic-run',
    taskId: 't-27',
    claimId: 'synthetic-claim',
    actorId: demoUser.id,
    deviceId: 'synthetic-device',
    runner: 'codex-cli',
    phase: 'running',
    externalSessionId: 'synthetic-session',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    lastHeartbeatAt: new Date().toISOString(),
    failureReason: '',
    permissionMode: 'read-only',
  };
  detail.claims = [
    {
      id: 'synthetic-claim',
      taskId: 't-27',
      actorId: demoUser.id,
      deviceId: 'synthetic-device',
      claimedAt: new Date().toISOString(),
      releasedAt: null,
      releaseReason: '',
    },
  ];
  detail.runs = [run as NonNullable<typeof detail.runs>[number]];
  const localCalls: string[] = [];
  await page.addInitScript(() => {
    Object.defineProperty(window, '__TAURI__', {
      value: { core: { invoke: async () => 'synthetic-local-key' } },
    });
    const original = window.fetch.bind(window);
    window.fetch = (input, init) => {
      if (String(input).includes('/api/v1/spaces/') && String(input).endsWith('/events'))
        return Promise.resolve(
          new Response(
            new ReadableStream({
              start(controller) {
                controller.enqueue(new TextEncoder().encode('event: ready\ndata: {}\n\n'));
              },
            }),
            { headers: { 'content-type': 'text/event-stream' } },
          ),
        );
      return original(input, init);
    };
  });
  await page.route('**/api/v1/tasks/t-27/detail', (route) =>
    route.fulfill({ json: { data: detail } }),
  );
  await page.route('http://127.0.0.1:47831/v1/browser/runners/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    localCalls.push(path);
    const supported = { supported: true, reason: 'synthetic fixture' };
    return route.fulfill({
      json: {
        data: path.endsWith('/probe')
          ? [
              {
                runner: 'codex-cli',
                state: 'ready',
                version: 'synthetic',
                start: supported,
                cancel: supported,
                resume: supported,
              },
            ]
          : {
              run: { ...run, phase: path.endsWith('/cancel') ? 'cancelled' : 'running' },
              synchronized: true,
            },
      },
    });
  });
  await page.goto('/?space=space-work&task=t-27');
  await expect(page.getByText('服务器需要升级', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '启动真实运行', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '请求取消', exact: true })).toBeEnabled();
  const before = server.healthRequests();
  await page.getByRole('button', { name: '请求取消', exact: true }).click();
  await expect.poll(() => localCalls.some((path) => path.endsWith('/cancel'))).toBe(true);
  expect(server.healthRequests()).toBe(before);
  expect(localCalls.some((path) => path.endsWith('/start') || path.endsWith('/sync'))).toBe(false);
  expect(server.unexpectedCompanionRequests).toEqual([]);
});
