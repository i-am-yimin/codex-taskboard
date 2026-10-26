import { compatibleServerHealth } from '../server-compatibility-fixture.ts';
import { test, expect, type Page } from '@playwright/test';
import { demoUser, makeDemoBoard, makeDemoDetail } from '../../apps/web/src/demo';
import type { TaskDetail } from '../../apps/web/src/types';

async function fixture(page: Page, configure?: (detail: TaskDetail) => void, stress = false) {
  const board = makeDemoBoard();
  if (stress)
    board.tasks.push(
      ...Array.from({ length: 24 }, (_, index) => ({
        ...board.tasks[0],
        id: `stress-${index}`,
        number: 100 + index,
        title: `stress-${index % 2 ? 'odd' : 'even'} ${index}`,
        position: index * 1024,
        statusId: board.statuses[0].id,
      })),
    );
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
  let rejectPatch = false;
  let writeGate: Promise<void> | undefined;
  let releaseWrite: (() => void) | undefined;
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
      if (writeGate) await writeGate;
      if (path.endsWith('/claim')) {
        const progress = board.statuses.find((status) => status.semantic === 'in_progress')!;
        detail.task = { ...detail.task, statusId: progress.id, version: detail.task.version + 1 };
        board.tasks = board.tasks.map((task) => (task.id === detail.task.id ? detail.task : task));
        data = { task: detail.task };
      }
      if (path.endsWith('/submit') && rejectSubmission) return route.abort('connectionfailed');
      if (req.method() === 'PATCH' && path === `/tasks/${detail.task.id}`) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        if (rejectPatch)
          return route.fulfill({
            status: 409,
            json: { error: { code: 'CONFLICT', message: '合成冲突，请重试' } },
          });
        detail.task = { ...detail.task, ...body, version: detail.task.version + 1 };
        data = detail.task;
        board.tasks = board.tasks.map((task) => (task.id === detail.task.id ? detail.task : task));
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
    holdWrites: () => {
      writeGate = new Promise<void>((resolve) => {
        releaseWrite = resolve;
      });
    },
    releaseWrites: () => {
      releaseWrite?.();
      writeGate = undefined;
    },
    rejectPatch: () => {
      rejectPatch = true;
    },
    reject: () => {
      rejectSubmission = true;
    },
  };
}

test('drawer exit restores focus and drafts with stable feedback space', async ({ page }) => {
  const server = await fixture(page);
  const feedback = page.locator('.motion-feedback');
  const before = await feedback.boundingBox();
  await page.getByRole('textbox', { name: '任务标签' }).fill('动效验收');
  await page.getByRole('button', { name: '保存任务', exact: true }).click();
  await expect(feedback).toHaveAttribute('data-request-state', 'pending');
  expect((await feedback.boundingBox())?.height).toBe(before?.height);
  await expect(feedback).toHaveAttribute('data-request-state', 'success');
  expect((await feedback.boundingBox())?.height).toBe(before?.height);
  server.rejectPatch();
  await page.getByRole('textbox', { name: '任务标签' }).fill('保留失败草稿');
  await page.getByRole('button', { name: '保存任务', exact: true }).click();
  await expect(feedback).toHaveAttribute('data-request-state', 'error');
  expect((await feedback.boundingBox())?.height).toBe(before?.height);
  await page.getByRole('textbox', { name: '评论', exact: true }).fill('保留草稿');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: '任务详情' })).toHaveCount(0);
  const card = page.locator('[data-motion-id="t-27"]');
  await card.focus();
  await card.click();
  await expect(page.getByRole('textbox', { name: '评论', exact: true })).toHaveValue('保留草稿');
  await page.keyboard.press('Escape');
  await expect(card).toBeFocused();
});
for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test(`keyboard drag preserves full card and cancels cleanly (${reducedMotion})`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion });
    await page.goto('/?demo=1');
    const card = page.locator('[data-motion-id="t-27"]');
    await card.focus();
    await page.keyboard.press('Space');
    const overlay = page.locator('.task-drag-overlay');
    await expect(overlay).toBeVisible();
    await expect(overlay.locator('.card-collaboration')).toHaveText(
      (await card.locator('.card-collaboration').textContent()) ?? '',
    );
    await expect(overlay.locator('.card-footer')).toHaveText(
      (await card.locator('.card-footer').textContent()) ?? '',
    );
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.column[data-drop-target="true"]')).toHaveCount(1);
    await expect(page.locator('[data-reflowing="true"]')).toHaveCount(0);
    if (reducedMotion === 'reduce')
      expect(await overlay.evaluate((el) => getComputedStyle(el).rotate)).toBe('none');
    await page.screenshot({ path: `.artifacts/motion/drag-${reducedMotion}.png` });
    await page.keyboard.press('Escape');
    await expect(overlay).toHaveCount(0);
    await expect(card).toBeFocused();
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Space');
    await expect(overlay).toHaveCount(0);
    await expect(page.locator('[data-dragging="true"]')).toHaveCount(0);
  });
}
test('narrow and 200 percent surfaces retain usable drawers', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await fixture(page);
  await page.screenshot({ path: '.artifacts/motion/drawer-360.png', fullPage: false });
  const dialog = page.getByRole('dialog', { name: '任务详情' });
  expect((await dialog.boundingBox())?.width).toBeLessThanOrEqual(360);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(() => {
    document.documentElement.style.zoom = '2';
  });
  await expect(page.getByRole('button', { name: '关闭', exact: true })).toBeInViewport();
  await page.screenshot({ path: '.artifacts/motion/drawer-200-percent.png', fullPage: false });
  await page.evaluate(() => {
    document.documentElement.style.zoom = '';
  });
  await page.setViewportSize({ width: 640, height: 450 });
  expect((await dialog.boundingBox())?.width).toBeLessThanOrEqual(640);
  await expect(page.getByRole('button', { name: '关闭', exact: true })).toBeInViewport();
  await page.screenshot({ path: '.artifacts/motion/drawer-zoom-equivalent-640.png' });
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('rapid filtered reflow and scrolling leave no residual transforms', async ({ page }) => {
  await fixture(page, undefined, true);
  await page.keyboard.press('Escape');
  const search = page.getByPlaceholder('搜索任务、标签…');
  await search.fill('stress-even');
  await search.fill('stress');
  await search.fill('stress-odd');
  await expect(page.locator('[data-motion-id]')).toHaveCount(12);
  await expect.poll(() => page.locator('[data-reflowing="true"]').count()).toBe(0);
  await page.locator('.board').evaluate((el) => {
    el.scrollLeft = 100;
  });
  await search.fill('stress-even');
  await expect.poll(() => page.locator('[data-reflowing="true"]').count()).toBe(0);
  expect(
    await page
      .locator('[data-motion-id]')
      .evaluateAll((cards) => cards.every((card) => getComputedStyle(card).transform === 'none')),
  ).toBe(true);
});

test('switching to reduced motion cancels an active reflow and releases its markers', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await fixture(page, undefined, true);
  await page.keyboard.press('Escape');
  const search = page.getByPlaceholder('搜索任务、标签…');
  await search.fill('stress-odd');
  await expect.poll(() => page.locator('[data-reflowing="true"]').count()).toBeGreaterThan(0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('[data-reflowing="true"]')).toHaveCount(0);
  expect(
    await page
      .locator('[data-motion-id]')
      .evaluateAll((cards) => cards.every((card) => getComputedStyle(card).transform === 'none')),
  ).toBe(true);
});

test('closing during drawer entrance preserves its current visual position', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await fixture(page);
  const drawer = page.getByRole('dialog', { name: '任务详情' });
  const before = await drawer.evaluate((el) => {
    // Replay the actual authored entrance and hold its 40ms visual progress deterministically.
    const element = el as HTMLElement;
    element.style.animation = 'none';
    void element.offsetWidth;
    element.style.animation = 'relay-drawer-in 260ms cubic-bezier(0.16, 1, 0.3, 1)';
    const animation = element.getAnimations()[0];
    animation.pause();
    animation.currentTime = 40;
    const style = getComputedStyle(element);
    const visual = {
      x: new DOMMatrixReadOnly(style.transform).m41,
      opacity: Number(style.opacity),
    };
    element.style.animation = '';
    // Removing the override resumes the same CSS entrance; pause it at the same point.
    const authored = element.getAnimations()[0];
    authored.pause();
    authored.currentTime = 40;
    return visual;
  });
  await page.keyboard.press('Escape');
  const after = await drawer.evaluate((el) => {
    const animation = el.getAnimations()[0];
    animation.pause();
    animation.currentTime = 0;
    const style = getComputedStyle(el);
    return { x: new DOMMatrixReadOnly(style.transform).m41, opacity: Number(style.opacity) };
  });
  expect(before.x).toBeGreaterThan(0);
  expect(after.x).toBeCloseTo(before.x, 2);
  expect(after.opacity).toBeCloseTo(before.opacity, 2);
  await expect(drawer).toHaveCount(0);
});

test('reopening the same task during exit cancels the stale close and retains its draft', async ({
  page,
}) => {
  await fixture(page);
  await page.getByRole('textbox', { name: '评论', exact: true }).fill('同卡快速重开草稿');
  await page.evaluate(() => {
    document.querySelector<HTMLButtonElement>('.drawer button[title="关闭"]')!.click();
    document.querySelector<HTMLButtonElement>('[data-motion-id="t-27"]')!.click();
  });
  const drawer = page.getByRole('dialog', { name: '任务详情' });
  await expect(drawer).toHaveAttribute('data-state', 'open');
  // Pass the old exit fallback deadline to prove it cannot close the newly opened instance.
  await page.waitForTimeout(300);
  await expect(drawer).toBeVisible();
  await expect(page.getByRole('textbox', { name: '评论', exact: true })).toHaveValue(
    '同卡快速重开草稿',
  );
});

test('rapid keyboard cancel survives the registration gap after same-task drawer reopen', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await fixture(page);
  await page.getByRole('textbox', { name: '评论', exact: true }).fill('快速取消仍保留草稿');
  await page.evaluate(() => {
    document.querySelector<HTMLButtonElement>('.drawer button[title="关闭"]')!.click();
    document.querySelector<HTMLButtonElement>('[data-motion-id="t-27"]')!.click();
  });
  await expect(page.getByRole('textbox', { name: '评论', exact: true })).toHaveValue(
    '快速取消仍保留草稿',
  );
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: '任务详情' })).toHaveCount(0);
  await page.clock.install({ time: new Date('2026-10-26T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-26T00:00:01Z'));
  const card = page.locator('[data-motion-id="t-27"]');
  await card.focus();
  await page.keyboard.press('Space');
  await expect(page.locator('.task-drag-overlay')).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Escape');
  await page.clock.runFor(20);
  await expect(page.locator('.task-drag-overlay')).toHaveCount(0);
  await expect(page.locator('[data-dragging="true"]')).toHaveCount(0);
  await expect(card).toBeFocused();
  await page.keyboard.press('Space');
  await page.clock.runFor(20);
  await expect(page.locator('.task-drag-overlay')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.task-drag-overlay')).toHaveCount(0);
});

test('keyboard adapter isolates late cleanup, unmount, bounded buffering and terminal callbacks', async ({
  page,
}) => {
  await page.goto('/?demo=1');
  await expect(page.locator('[data-motion-id="t-27"]')).toBeVisible();
  await page.evaluate(async () => {
    const modulePath = '/src/motion/BufferedKeyboardSensor.ts';
    const { BufferedKeyboardSensor, KeyboardSensorScope } = await import(modulePath);
    const button = document.createElement('button');
    button.textContent = 'isolated public sensor contract fixture';
    document.body.append(button);
    const active = new Set<EventListenerOrEventListenerObject>();
    const add = EventTarget.prototype.addEventListener;
    const remove = EventTarget.prototype.removeEventListener;
    EventTarget.prototype.addEventListener = function (
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions,
    ) {
      if (this === document && type === 'keydown' && listener) active.add(listener);
      add.call(this, type, listener, options);
    };
    EventTarget.prototype.removeEventListener = function (
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | EventListenerOptions,
    ) {
      if (this === document && type === 'keydown' && listener) active.delete(listener);
      remove.call(this, type, listener, options);
    };
    const counts: Record<string, { start: number; move: number; end: number; cancel: number }> = {};
    const scopes: Record<string, { dispose: () => void }> = {};
    const create = (id: string, reuse?: string) => {
      const count = (counts[id] = { start: 0, move: 0, end: 0, cancel: 0 });
      const scope = (scopes[id] = reuse ? scopes[reuse] : new KeyboardSensorScope());
      const context = { current: { collisionRect: { left: 0, top: 0 }, scrollableAncestors: [] } };
      new BufferedKeyboardSensor({
        active: id,
        event: new KeyboardEvent('keydown', { code: 'Space' }),
        activeNode: { node: { current: button } },
        context,
        options: {
          scope,
          coordinateGetter: (
            event: KeyboardEvent,
            args: { currentCoordinates: { x: number; y: number } },
          ) =>
            event.code === 'ArrowRight'
              ? { x: args.currentCoordinates.x + 20, y: args.currentCoordinates.y }
              : undefined,
        },
        onStart: () => {
          count.start++;
        },
        onCancel: () => {
          count.cancel++;
        },
        onEnd: () => {
          count.end++;
        },
        onMove: () => {
          count.move++;
        },
        onAbort: () => {},
        onPending: () => {},
      });
    };
    const key = (code: string) =>
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: code, code, bubbles: true, cancelable: true }),
      );
    Object.defineProperty(window, 'sensorScenario', {
      configurable: true,
      value: { counts, scopes, create, key, active },
    });
  });
  await page.clock.install({ time: new Date('2026-10-26T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-26T00:00:01Z'));
  await page.evaluate(`(() => {
    const s = window.sensorScenario;
    s.create('resized'); window.dispatchEvent(new Event('resize'));
    s.create('newAfterResize'); s.key('ArrowRight'); s.key('Space'); s.key('ArrowRight');
  })()`);
  await page.clock.runFor(20);
  expect(await page.evaluate('window.sensorScenario.counts')).toEqual({
    resized: { start: 1, move: 0, end: 0, cancel: 1 },
    newAfterResize: { start: 1, move: 1, end: 1, cancel: 0 },
  });
  await page.evaluate(`(() => {
    const s = window.sensorScenario;
    s.create('unmounted'); s.key('ArrowRight'); s.scopes.unmounted.dispose();
    s.create('newAfterUnmount', 'unmounted'); s.key('ArrowRight');
  })()`);
  await page.clock.runFor(20);
  expect(await page.evaluate('window.sensorScenario.counts.newAfterUnmount')).toEqual({
    start: 1,
    move: 1,
    end: 0,
    cancel: 0,
  });
  await page.evaluate(`window.sensorScenario.key('Space')`);
  expect(await page.evaluate('window.sensorScenario.counts.unmounted')).toEqual({
    start: 1,
    move: 0,
    end: 0,
    cancel: 0,
  });
  await page.evaluate(`(() => {
    const s = window.sensorScenario;
    s.create('cancelQueue'); s.key('Escape'); s.key('ArrowRight'); s.key('Space');
  })()`);
  await page.clock.runFor(20);
  expect(await page.evaluate('window.sensorScenario.counts.cancelQueue')).toEqual({
    start: 1,
    move: 0,
    end: 0,
    cancel: 1,
  });
  await page.evaluate(`(() => {
    const s = window.sensorScenario;
    s.create('overflow'); for (let i = 0; i < 70; i++) s.key('ArrowRight');
  })()`);
  await page.clock.runFor(20);
  expect(await page.evaluate('window.sensorScenario.counts.overflow')).toEqual({
    start: 1,
    move: 0,
    end: 0,
    cancel: 1,
  });
  await page.evaluate(`(() => {
    const s = window.sensorScenario;
    s.create('visibility'); window.dispatchEvent(new Event('visibilitychange'));
  })()`);
  await page.clock.runFor(20);
  expect(await page.evaluate('window.sensorScenario.counts.visibility')).toEqual({
    start: 1,
    move: 0,
    end: 0,
    cancel: 1,
  });
  // Every base and capture keydown listener must be gone, not just hidden behind callback guards.
  expect(await page.evaluate('window.sensorScenario.active.size')).toBe(0);
  await page.evaluate(`window.dispatchEvent(new Event('resize'))`);
  expect(await page.evaluate('window.sensorScenario.counts.newAfterUnmount')).toEqual({
    start: 1,
    move: 1,
    end: 1,
    cancel: 0,
  });
});

test('buffered keyboard movement followed by Space commits the selected position once', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 1200 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const todo = makeDemoBoard().statuses.find((status) => status.semantic === 'todo')!;
  const server = await fixture(page, (detail) => {
    detail.task.statusId = todo.id;
    detail.task.position = 0;
  });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: '任务详情' })).toHaveCount(0);
  await page.clock.install({ time: new Date('2026-10-26T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-26T00:00:01Z'));
  const card = page.locator('[data-motion-id="t-27"]');
  await card.focus();
  await page.keyboard.press('Space');
  await expect(page.locator('.task-drag-overlay')).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Space');
  await page.clock.runFor(350);
  await page.clock.resume();
  await expect(page.locator('.task-drag-overlay')).toHaveCount(0);
  await expect.poll(() => server.writes.length).toBe(1);
  expect(server.writes[0].body.position).toBeGreaterThan(0);
  expect(server.writes[0].body.statusId).toBe(todo.id);
  await expect(card).toBeFocused();
});

test('buffered keyboard cross-column drop keeps the full card at its selected demo destination', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?demo=1');
  const card = page.locator('[data-motion-id="t-27"]');
  await card.focus();
  await page.clock.install({ time: new Date('2026-10-26T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-26T00:00:01Z'));
  await page.keyboard.press('Space');
  await expect(page.locator('.task-drag-overlay')).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Space');
  await page.clock.runFor(20);
  await page.clock.resume();
  await expect(page.locator('.task-drag-overlay')).toHaveCount(0);
  await expect(
    page
      .locator('.column')
      .filter({ has: page.locator('[data-motion-id="t-27"]') })
      .locator('.column-head'),
  ).toContainText('待验收');
  await expect(card.locator('.card-collaboration')).toBeVisible();
  await expect(card).toBeFocused();
});

for (const leave of ['stay', 'focus-search', 'hide', 'pagehide'] as const) {
  test(`remote claim restores keyboard focus after query refresh unless user leaves (${leave})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const todo = makeDemoBoard().statuses.find((status) => status.semantic === 'todo')!;
    const server = await fixture(page, (detail) => {
      detail.task.statusId = todo.id;
    });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: '任务详情' })).toHaveCount(0);
    server.holdWrites();
    const card = page.locator('[data-motion-id="t-27"]');
    await card.focus();
    await page.keyboard.press('Space');
    await expect(page.locator('.task-drag-overlay')).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.column[data-drop-target="true"] .column-head')).toContainText(
      '进行中',
    );
    await page.keyboard.press('Space');
    await expect.poll(() => server.writes.length).toBe(1);
    expect(server.writes[0].path).toContain('/claim');
    const search = page.getByPlaceholder('搜索任务、标签…');
    if (leave === 'focus-search') await search.focus();
    if (leave === 'pagehide')
      await page.evaluate(() =>
        window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })),
      );
    if (leave === 'hide')
      await page.evaluate(() => {
        Object.defineProperty(document, 'visibilityState', {
          configurable: true,
          get: () => 'hidden',
        });
        document.dispatchEvent(new Event('visibilitychange'));
      });
    server.releaseWrites();
    await expect(
      page.locator('.column').filter({ has: card }).locator('.column-head'),
    ).toContainText('进行中');
    await expect(page.locator('.task-drag-overlay')).toHaveCount(0);
    if (leave === 'focus-search') await expect(search).toBeFocused();
    else if (leave === 'hide') {
      await page.evaluate(() => {
        Object.defineProperty(document, 'visibilityState', {
          configurable: true,
          get: () => 'visible',
        });
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await expect(card).not.toBeFocused();
    } else if (leave === 'pagehide') await expect(card).not.toBeFocused();
    else await expect(card).toBeFocused();
  });
}

test('keyboard workflow drop opens its material drawer without restoring focus to the board', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await fixture(page);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: '任务详情' })).toHaveCount(0);
  const card = page.locator('[data-motion-id="t-27"]');
  await card.focus();
  await page.keyboard.press('Space');
  await expect(page.locator('.task-drag-overlay')).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.column[data-drop-target="true"] .column-head')).toContainText(
    '待验收',
  );
  await page.keyboard.press('Space');
  const drawer = page.getByRole('dialog', { name: '任务详情' });
  await expect(drawer).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => !!document.activeElement?.closest('[role=dialog]')))
    .toBe(true);
  await expect(card).not.toBeFocused();
});

test('pointer drag still cancels and leaves no keyboard adapter activity', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?demo=1');
  const card = page.locator('[data-motion-id="t-27"]');
  const box = (await card.boundingBox())!;
  await page.mouse.move(box.x + 40, box.y + 30);
  await page.mouse.down();
  await page.mouse.move(box.x + 100, box.y + 50, { steps: 5 });
  await expect(page.locator('.task-drag-overlay')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(page.locator('.task-drag-overlay')).toHaveCount(0);
  await expect(page.locator('[data-dragging="true"]')).toHaveCount(0);
  await card.focus();
  await page.keyboard.press('Space');
  await expect(page.locator('.task-drag-overlay')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.task-drag-overlay')).toHaveCount(0);
});
