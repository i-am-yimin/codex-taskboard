import { writeFile } from 'node:fs/promises';
import { test, expect, type Page } from '@playwright/test';
import { demoUser, makeDemoBoard, makeDemoDetail } from '../../apps/web/src/demo';
import { compatibleServerHealth } from '../server-compatibility-fixture';

async function fixture(page: Page, twoSpaces = false, withNotice = false) {
  const board = makeDemoBoard();
  const second = {
    ...board,
    space: { ...board.space, id: 'space-second', name: '独立第二空间' },
    tasks: [{ ...board.tasks[0], id: 'second-task', spaceId: 'space-second' }],
  };
  let boards = 0;
  let boardGate: Promise<void> | undefined;
  let releaseBoard: (() => void) | undefined;
  await page.addInitScript(() => {
    class Stream extends EventTarget {
      closed = false;
      private activeError: ((event: Event) => void) | null = null;
      oldError: ((event: Event) => void) | null = null;
      get onerror() {
        return this.activeError;
      }
      set onerror(value: ((event: Event) => void) | null) {
        this.activeError = value;
        if (value) this.oldError = value;
      }
      saved = new Map<string, EventListenerOrEventListenerObject[]>();
      url: string;
      constructor(url: string) {
        super();
        this.url = url;
        streams.push(this);
      }
      override addEventListener(
        type: string,
        listener: EventListenerOrEventListenerObject | null,
        options?: boolean | AddEventListenerOptions,
      ) {
        if (listener) this.saved.set(type, [...(this.saved.get(type) ?? []), listener]);
        super.addEventListener(type, listener, options);
        if (type === 'ready' && state.syncReady && listener) {
          if (typeof listener === 'function') listener(new Event('ready'));
          else listener.handleEvent(new Event('ready'));
        }
      }
      close() {
        this.closed = true;
      }
      late(type: string) {
        const event = new Event(type);
        if (type === 'error') {
          (this.oldError ?? this.onerror)?.(event);
          return;
        }
        for (const listener of this.saved.get(type) ?? []) {
          if (typeof listener === 'function') listener(event);
          else listener.handleEvent(event);
        }
      }
    }
    const streams: Stream[] = [];
    Object.defineProperty(window, 'EventSource', { value: Stream });
    const state = { streams, syncReady: false };
    Object.defineProperty(window, 'realtimeFixture', { value: state });
  });
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1', '');
    let data: unknown = {};
    if (path === '/health') data = compatibleServerHealth;
    else if (path === '/setup') data = { required: false };
    else if (path === '/me') data = demoUser;
    else if (path === '/spaces') data = twoSpaces ? [board.space, second.space] : [board.space];
    else if (path.endsWith('/board')) {
      boards++;
      if (path.includes('/space-second/') && boardGate) await boardGate;
      data = path.includes('/space-second/') ? second : board;
    } else if (path.endsWith('/detail')) {
      const detail = makeDemoDetail('t-27');
      detail.task.reviewerId = demoUser.id;
      if (path.includes('/second-task/'))
        detail.task = {
          ...detail.task,
          id: 'second-task',
          spaceId: 'space-second',
          title: 'B空间显式任务',
        };
      data = detail;
    } else if (path === '/me/appearance')
      return route.fulfill({
        status: 404,
        json: { error: { code: 'NOT_FOUND', message: 'synthetic' } },
      });
    else if (path === '/me/notifications' && withNotice)
      data = {
        items: [
          {
            id: 'cross-space-notice',
            userId: demoUser.id,
            spaceId: 'space-second',
            taskId: 'second-task',
            eventId: 'cross-space-event',
            kind: 'comment.added',
            title: 'B空间显式打开通知',
            body: '合成跨空间导航',
            createdAt: new Date().toISOString(),
            readAt: null,
            handledAt: null,
            snoozedUntil: null,
            groupKey: 'second-task:comment',
            deliveredAt: null,
          },
        ],
        nextCursor: null,
      };
    else if (path === '/me/tasks' || path === '/me/notifications')
      data = { items: [], nextCursor: null };
    else data = [];
    return route.fulfill({ json: { data } });
  });
  await page.goto('/?space=space-work&task=t-27');
  await expect(page.getByRole('dialog', { name: '任务详情' })).toBeVisible();
  await expect
    .poll(() => page.evaluate('window.realtimeFixture.streams.length'))
    .toBeGreaterThan(0);
  await page.evaluate(`window.realtimeFixture.streams.at(-1).dispatchEvent(new Event('ready'))`);
  await expect(page.getByRole('button', { name: '保存任务', exact: true })).toBeEnabled();
  return {
    boards: () => boards,
    holdSecondBoard: () => {
      boardGate = new Promise<void>((resolve) => {
        releaseBoard = resolve;
      });
    },
    releaseSecondBoard: () => {
      releaseBoard?.();
      boardGate = undefined;
    },
  };
}

test('short trusted offline/online replaces the stream and requires a current confirmation before writing', async ({
  page,
}) => {
  const server = await fixture(page);
  const draft = page.getByRole('textbox', { name: '评论', exact: true });
  await draft.fill('短离线保留的评论草稿');
  const initialStreams = await page.evaluate<number>('window.realtimeFixture.streams.length');
  const initialBoards = server.boards();
  await page.context().setOffline(true);
  await expect(page.getByRole('button', { name: '发送', exact: true })).toBeDisabled();
  await page.context().setOffline(false);
  await expect
    .poll(() => page.evaluate<number>('window.realtimeFixture.streams.length'))
    .toBeGreaterThan(initialStreams);
  await expect.poll(server.boards).toBeGreaterThan(initialBoards);
  await expect(page.getByRole('button', { name: '发送', exact: true })).toBeDisabled();
  const boardsAfterOnline = server.boards();
  await page.evaluate(`(() => {
    const streams = window.realtimeFixture.streams;
    for (const stream of streams.slice(0, -1)) for (const type of ['ready', 'board', 'error', 'revoked']) stream.late(type);
  })()`);
  await expect(draft).toHaveValue('短离线保留的评论草稿');
  await expect(page.getByRole('button', { name: '发送', exact: true })).toBeDisabled();
  expect(server.boards()).toBe(boardsAfterOnline);
  await page.evaluate(`window.realtimeFixture.streams.at(-1).dispatchEvent(new Event('ready'))`);
  await expect(page.getByRole('button', { name: '发送', exact: true })).toBeEnabled();
  await page.evaluate(`window.realtimeFixture.streams[0].late('error')`);
  await expect(page.getByRole('button', { name: '发送', exact: true })).toBeEnabled();
  await expect(draft).toHaveValue('短离线保留的评论草稿');
});

test('online cannot overwrite confirmation delivered during replacement subscription setup', async ({
  page,
}) => {
  await fixture(page);
  await page.getByRole('textbox', { name: '评论', exact: true }).fill('同步确认仍保留草稿');
  await page.evaluate('window.realtimeFixture.syncReady = true');
  await page.context().setOffline(true);
  await expect(page.getByRole('button', { name: '发送', exact: true })).toBeDisabled();
  await page.context().setOffline(false);
  await expect(page.getByRole('button', { name: '发送', exact: true })).toBeEnabled();
  await expect(page.getByRole('textbox', { name: '评论', exact: true })).toHaveValue(
    '同步确认仍保留草稿',
  );
});

test('switching space retires old callbacks before cache actions and waits for the new space stream', async ({
  page,
}) => {
  const server = await fixture(page, true);
  await page.getByRole('textbox', { name: '评论', exact: true }).fill('第一空间的私有评论草稿');
  const key = `tb:comment:${demoUser.id}:t-27`;
  const count = await page.evaluate<number>('window.realtimeFixture.streams.length');
  await page.getByRole('button', { name: /产品工作室/ }).click();
  await page.getByRole('button', { name: /独立第二空间/ }).click();
  await expect(page.locator('.space-switcher')).toContainText('独立第二空间');
  await expect
    .poll(() => page.evaluate<number>('window.realtimeFixture.streams.length'))
    .toBeGreaterThan(count);
  await expect(page.getByRole('button', { name: '新建任务', exact: true })).toBeDisabled();
  const saved = await page.evaluate((key) => localStorage.getItem(key), key);
  const protectedKey = `tb:draft:${demoUser.id}:second-task`;
  const protectedDraft = JSON.stringify({
    spaceId: 'space-second',
    draft: { title: '新空间不可被旧流撤权清除' },
  });
  await page.evaluate(({ key, value }) => localStorage.setItem(key, value), {
    key: protectedKey,
    value: protectedDraft,
  });
  const requests = server.boards();
  await page.evaluate(`(() => {
    for (const stream of window.realtimeFixture.streams.slice(0, -1)) {
      for (const type of ['ready', 'board', 'revoked', 'error']) stream.late(type);
    }
  })()`);
  await expect(page.getByRole('button', { name: '新建任务', exact: true })).toBeDisabled();
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(saved);
  expect(await page.evaluate((key) => localStorage.getItem(key), protectedKey)).toBe(
    protectedDraft,
  );
  expect(server.boards()).toBe(requests);
  await page.evaluate(`window.realtimeFixture.streams.at(-1).dispatchEvent(new Event('board'))`);
  await expect(page.getByRole('button', { name: '新建任务', exact: true })).toBeEnabled();
});

for (const closing of [false, true]) {
  test(`task draft ownership survives cached cross-space navigation and only its owning space can revoke it (${closing})`, async ({
    page,
  }, testInfo) => {
    await fixture(page, true);
    const drawer = page.getByRole('dialog', { name: '任务详情', exact: true });
    await page.keyboard.press('Escape');
    await expect(drawer).toHaveCount(0);
    // Populate B before creating A drafts: the tested switch must not rely on a loading unmount.
    await page.locator('.space-switcher').click();
    await page.getByRole('button', { name: /独立第二空间/ }).click();
    await expect(page.locator('.space-switcher')).toContainText('独立第二空间');
    await page.evaluate(`window.realtimeFixture.streams.at(-1).dispatchEvent(new Event('ready'))`);
    await expect(page.getByRole('button', { name: '新建任务', exact: true })).toBeEnabled();
    await page.locator('.space-switcher').click();
    await page
      .locator('.space-menu')
      .getByRole('button', { name: /产品工作室/ })
      .click();
    await expect(page.locator('.space-switcher')).toContainText('产品工作室');
    await page.evaluate(`window.realtimeFixture.streams.at(-1).dispatchEvent(new Event('ready'))`);
    await page.locator('[data-motion-id="t-27"]').click();
    await expect(page.getByRole('button', { name: '保存任务', exact: true })).toBeEnabled();
    await page.getByRole('textbox', { name: '任务标题', exact: true }).fill('A空间未保存编辑');
    await page.getByRole('textbox', { name: '评论', exact: true }).fill('A空间未发送评论');
    await page.getByRole('button', { name: '提交结果至待验收', exact: true }).click();
    const result = page.getByRole('dialog', { name: '提交验收结果', exact: true });
    await result.getByLabel('完成说明', { exact: true }).fill('A空间未提交结果');
    await page.keyboard.press('Escape');
    await expect(result).toHaveCount(0);
    const keys = [
      `tb:draft:${demoUser.id}:t-27`,
      `tb:comment:${demoUser.id}:t-27`,
      `tb:result:${demoUser.id}:t-27`,
    ];
    const readDrafts = () =>
      page.evaluate((keys) => keys.map((key) => localStorage.getItem(key)), keys);
    await expect
      .poll(async () =>
        (await readDrafts()).every((value) => value && JSON.parse(value).spaceId === 'space-work'),
      )
      .toBe(true);
    const before = await readDrafts();
    if (closing) {
      await page.clock.install({ time: new Date('2026-10-26T00:00:00Z') });
      await page.clock.pauseAt(new Date('2026-10-26T00:00:01Z'));
      await drawer.getByRole('button', { name: '关闭', exact: true }).click();
      await expect(drawer).toHaveAttribute('data-state', 'closed');
      await drawer.evaluate((element) =>
        element.getAnimations().forEach((animation) => animation.pause()),
      );
    }
    await page.locator('.space-switcher').click();
    await page.getByRole('button', { name: /独立第二空间/ }).click();
    await expect(page.locator('.space-switcher')).toContainText('独立第二空间');
    await expect(drawer).toHaveCount(0);
    if (closing) await page.clock.resume();
    const afterSwitch = await readDrafts();
    await page.evaluate(
      `window.realtimeFixture.streams.at(-1).dispatchEvent(new Event('revoked'))`,
    );
    const afterOtherRevocation = await readDrafts();
    await writeFile(
      testInfo.outputPath('draft-ownership.json'),
      JSON.stringify({ keys, before, afterSwitch, afterOtherRevocation }, null, 2),
    );
    expect(afterOtherRevocation).toEqual(before);
    await expect(drawer).toHaveCount(0);
    await page.goto('/?space=space-work&task=t-27');
    await expect(drawer).toBeVisible();
    await expect
      .poll(() => page.evaluate('window.realtimeFixture.streams.length'))
      .toBeGreaterThan(0);
    await page.evaluate(`window.realtimeFixture.streams.at(-1).dispatchEvent(new Event('ready'))`);
    await expect(page.getByRole('button', { name: '保存任务', exact: true })).toBeEnabled();
    await page.evaluate(
      `window.realtimeFixture.streams.at(-1).dispatchEvent(new Event('revoked'))`,
    );
    await expect.poll(async () => (await readDrafts()).every((value) => value === null)).toBe(true);
  });
}

test('a real inbox cross-space open waits for its target board without losing the requested task', async ({
  page,
}) => {
  const server = await fixture(page, true, true);
  await page.getByRole('textbox', { name: '评论', exact: true }).fill('通知导航前A空间草稿');
  await page.getByRole('dialog', { name: '任务详情', exact: true }).getByRole('button', { name: '关闭', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '任务详情', exact: true })).toHaveCount(0);
  server.holdSecondBoard();
  await page.getByRole('button', { name: /^收件箱/ }).click();
  const inbox = page.getByRole('dialog', { name: '收件箱', exact: true });
  await expect(inbox.getByText('B空间显式打开通知', { exact: true })).toBeVisible();
  await inbox.getByRole('button', { name: '打开任务', exact: true }).click();
  await expect
    .poll(() => page.evaluate<string>('window.realtimeFixture.streams.at(-1).url'))
    .toContain('/space-second/events');
  await expect(page.getByRole('dialog', { name: '任务详情', exact: true })).toHaveCount(0);
  server.releaseSecondBoard();
  await expect(page.locator('.space-switcher')).toContainText('独立第二空间');
  await expect(page.getByRole('textbox', { name: '任务标题', exact: true })).toHaveValue(
    'B空间显式任务',
  );
  await expect(page.getByRole('button', { name: '保存任务', exact: true })).toBeDisabled();
  await page.evaluate(`window.realtimeFixture.streams.at(-1).dispatchEvent(new Event('ready'))`);
  await expect(page.getByRole('button', { name: '保存任务', exact: true })).toBeEnabled();
  const key = `tb:comment:${demoUser.id}:t-27`;
  expect(JSON.parse((await page.evaluate((key) => localStorage.getItem(key), key))!).spaceId).toBe(
    'space-work',
  );
});
