import { test, expect, type Page } from '@playwright/test';
import type {
  AutomationRule,
  NotificationPreferences,
  TaskNotification,
  WorkflowMetrics,
} from '../../packages/core/src/workflow';
import { demoUser, makeDemoBoard, makeDemoDetail } from '../../apps/web/src/demo';

async function workflowFixture(page: Page, viewer = false) {
  const board = makeDemoBoard();
  const reviewerId = '22222222-2222-4222-8222-222222222222';
  board.members = board.members.map((member) => ({ ...member, id: member.name === '林舟' ? reviewerId : member.id }));
  if (viewer) board.space.role = 'viewer';
  const now = Date.now();
  const notices: TaskNotification[] = [0, 1].map((index) => ({
    id: `notice-${index}`,
    userId: demoUser.id,
    spaceId: board.space.id,
    taskId: 't-27',
    eventId: `event-${index}`,
    kind: 'comment.added',
    title: '合成任务的验收更新',
    body: `独立测试事件 ${index + 1}`,
    createdAt: new Date(now - index * 1000).toISOString(),
    readAt: null,
    handledAt: null,
    snoozedUntil: null,
    groupKey: 't-27:comment',
    deliveredAt: null,
  }));
  let preferences: NotificationPreferences = {
    userId: demoUser.id,
    spaceId: board.space.id,
    desktopEnabled: false,
    mutedUntil: null,
    mergeWindowSeconds: 60,
  };
  let metrics: WorkflowMetrics = {
    from: new Date(now - 86400000).toISOString(),
    to: new Date(now).toISOString(),
    timezone: 'UTC',
    items: [],
    legacyUnknownCount: 2,
  };
  const rules: AutomationRule[] = [];
  const writes: { path: string; body: Record<string, unknown> }[] = [];
  const leases = new Map<string, string>();
  let sequence = 0;
  await page.addInitScript(() => {
    class FakeEvents extends EventTarget {
      constructor() {
        super();
        setTimeout(() => this.dispatchEvent(new Event('ready')), 20);
      }
      close() {}
    }
    Object.defineProperty(window, 'EventSource', { value: FakeEvents });
    const state = window as unknown as {
      notificationRequests: number;
      notificationSends: { title: string; body: string }[];
    };
    state.notificationRequests = 0;
    state.notificationSends = [];
    class TestNotification {
      static permission = 'default';
      onshow: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onclick: (() => void) | null = null;
      static async requestPermission() {
        state.notificationRequests++;
        TestNotification.permission = 'granted';
        return 'granted';
      }
      constructor(title: string, options: { body: string }) {
        state.notificationSends.push({ title, body: options.body });
        setTimeout(() => this.onshow?.(), 0);
      }
      close() {}
    }
    Object.defineProperty(window, 'Notification', { value: TestNotification });
  });
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace('/api/v1', '');
    const method = req.method();
    let data: unknown = {};
    if (method !== 'GET') writes.push({ path, body: req.postDataJSON() ?? {} });
    if (path === '/setup') data = { required: false };
    else if (path === '/me') data = demoUser;
    else if (path === '/spaces') data = [board.space];
    else if (path.endsWith('/board')) data = board;
    else if (path.endsWith('/detail')) data = makeDemoDetail('t-27');
    else if (path === '/me/themes' || path === '/me/saved-filters') data = [];
    else if (path === '/me/appearance')
      return route.fulfill({
        status: 404,
        json: { error: { code: 'NOT_FOUND', message: 'unsupported' } },
      });
    else if (path === '/me/notifications') data = { items: notices, nextCursor: null };
    else if (path === '/me/notification-preferences') data = [preferences];
    else if (path.startsWith('/me/notification-preferences/')) {
      preferences = { ...preferences, ...req.postDataJSON() };
      data = preferences;
    } else if (path.startsWith('/me/notifications/')) {
      const [, , , id, action] = path.split('/');
      const item = notices.find((notice) => notice.id === id)!;
      if (action === 'read') item.readAt = new Date().toISOString();
      if (action === 'handle') item.handledAt = new Date().toISOString();
      if (action === 'snooze') {
        item.snoozedUntil = req.postDataJSON().until;
        item.deliveredAt = null;
        leases.delete(id);
      }
      if (action === 'delivery') {
        const token = `${Date.now()}.${++sequence}`;
        leases.set(id, token);
        data = { ...item, deliveryToken: token };
      } else if (action === 'delivered') {
        expect(req.postDataJSON().deliveryToken).toBe(leases.get(id));
        item.deliveredAt = new Date().toISOString();
        data = item;
      } else data = item;
    } else if (path.endsWith('/workflow-metrics')) data = metrics;
    else if (path.includes('/automation-rules')) {
      if (method === 'POST') {
        const body = req.postDataJSON();
        const rule = {
          ...body,
          id: `rule-${rules.length}`,
          spaceId: board.space.id,
          version: 1,
          createdBy: demoUser.id,
          createdAt: new Date().toISOString(),
          lastError: '',
        } as AutomationRule;
        rules.push(rule);
        data = rule;
      } else if (method === 'PATCH') {
        const id = path.split('/').at(-1);
        const index = rules.findIndex((rule) => rule.id === id);
        rules[index] = {
          ...rules[index],
          ...req.postDataJSON(),
          version: rules[index].version + 1,
        };
        data = rules[index];
      } else data = rules;
    }
    return route.fulfill({ json: { data } });
  });
  await page.goto('/?space=space-work');
  await expect(page.getByRole('button', { name: '规则与统计', exact: true })).toBeVisible();
  return {
    reviewerId,
    writes,
    notices,
    rules,
    setMetrics: (value: WorkflowMetrics) => {
      metrics = value;
    },
    dueNow: (id: string) => {
      notices.find((item) => item.id === id)!.snoozedUntil = new Date(
        Date.now() - 1000,
      ).toISOString();
    },
  };
}

test('persistent inbox groups without losing events and handles read, process and mention drafts independently', async ({
  page,
}) => {
  const server = await workflowFixture(page);
  await page.getByRole('button', { name: /^收件箱/ }).click();
  const inbox = page.getByRole('dialog', { name: '收件箱' });
  await expect(inbox.getByText('2 条更新，2 条未读')).toBeVisible();
  await inbox.getByText('展开全部事件').click();
  await expect(inbox.getByText('独立测试事件 1')).toBeVisible();
  await expect(inbox.getByText('独立测试事件 2')).toBeVisible();
  await inbox.getByRole('button', { name: '标为已处理' }).first().click();
  await expect.poll(() => server.notices[0].handledAt).not.toBeNull();
  expect(server.notices[0].readAt).toBeNull();
  await inbox.getByRole('button', { name: '标为已读' }).first().click();
  await expect.poll(() => server.notices[0].readAt).not.toBeNull();
  await inbox.getByRole('button', { name: '打开任务' }).first().click();
  await expect(page).toHaveURL(/task=t-27/);
  await page.getByText('提及空间成员', { exact: true }).click();
  await page.getByLabel('林舟', { exact: true }).check();
  await page.getByRole('textbox', { name: '评论', exact: true }).fill('请帮我复核独立测试');
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('button', { name: /完成 Codex 桌面端看板入口/ }).click();
  await page.getByText('提及空间成员（已选 1 人）').click();
  await expect(page.getByLabel('林舟', { exact: true })).toBeChecked();
  await expect(page.getByRole('textbox', { name: '评论', exact: true })).toHaveValue(
    '请帮我复核独立测试',
  );
});

test('only explicit enable requests system permission and delivery acknowledgments keep unread state', async ({
  page,
}) => {
  const server = await workflowFixture(page);
  expect(
    await page.evaluate(
      () => (window as unknown as { notificationRequests: number }).notificationRequests,
    ),
  ).toBe(0);
  await page.getByRole('button', { name: /^收件箱/ }).click();
  const inbox = page.getByRole('dialog', { name: '收件箱' });
  await inbox.getByText('空间提醒设置', { exact: true }).click();
  await inbox.getByRole('button', { name: '启用此设备系统提醒' }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { notificationRequests: number }).notificationRequests,
      ),
    )
    .toBe(1);
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { notificationSends: unknown[] }).notificationSends.length,
      ),
    )
    .toBe(1);
  await expect
    .poll(() => server.writes.filter((item) => item.path.endsWith('/delivered')).length)
    .toBe(2);
  expect(server.notices.every((item) => item.readAt === null && item.handledAt === null)).toBe(
    true,
  );
  await expect(
    inbox.getByText('已向系统请求提醒；显示由系统决定，不会自动标为已读。'),
  ).toBeVisible();
  await inbox.getByText('展开全部事件').click();
  await inbox
    .getByRole('combobox', { name: /^稍后提醒/ })
    .first()
    .selectOption('1');
  await inbox.getByRole('button', { name: '设置稍后' }).first().click();
  await expect.poll(() => server.writes.some((item) => item.path.endsWith('/snooze'))).toBe(true);
  server.dueNow('notice-0');
  await inbox.getByRole('button', { name: '刷新收件箱' }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { notificationSends: unknown[] }).notificationSends.length,
      ),
    )
    .toBe(2);
});

test('admin saves a real-shaped fixed interval rule while metrics show actual samples or an honest empty state', async ({
  page,
}) => {
  const server = await workflowFixture(page);
  await page.getByRole('button', { name: '规则与统计', exact: true }).click();
  const panel = page.getByRole('dialog', { name: '规则与统计' });
  await expect(panel.getByText('此范围没有可精确计时的样本')).toBeVisible();
  await panel.getByRole('button', { name: '新建规则' }).click();
  await panel.getByLabel('规则类型').selectOption('recurring');
  await panel.getByLabel('固定间隔（小时）').fill('12');
  await panel.getByLabel('任务标题模板').fill('独立测试周期复核');
  await panel.getByLabel('模板验收人').selectOption(server.reviewerId);
  await panel.getByRole('button', { name: '保存规则', exact: true }).click();
  await expect.poll(() => server.rules.length).toBe(1);
  expect(server.rules[0]).toMatchObject({
    type: 'recurring',
    config: { intervalHours: 12, title: '独立测试周期复核', reviewerId: server.reviewerId },
  });
  await expect(panel.getByText('独立测试周期复核', { exact: true })).toBeVisible();
  await panel.getByRole('button', { name: '停用规则' }).click();
  await expect.poll(() => server.rules[0].enabled).toBe(false);
  server.setMetrics({
    from: new Date(Date.now() - 86400000).toISOString(),
    to: new Date().toISOString(),
    timezone: 'UTC',
    legacyUnknownCount: 2,
    items: [{ kind: 'blocked', sampleCount: 3, totalSeconds: 7200, currentCount: 1 }],
  });
  await panel.getByRole('button', { name: '查询统计' }).click();
  await expect(panel.getByRole('cell', { name: '2.0 小时', exact: true })).toBeVisible();
});

test('viewer can inspect rules and a narrow reduced-motion inbox without configuration controls', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await workflowFixture(page, true);
  await page.getByRole('button', { name: '规则与统计', exact: true }).click();
  const panel = page.getByRole('dialog', { name: '规则与统计' });
  await expect(panel.getByRole('button', { name: '新建规则' })).toHaveCount(0);
  await expect(panel.getByText('只读查看；规则由空间管理员配置。', { exact: false })).toBeVisible();
  await page.screenshot({ path: '.artifacts/collaboration-ui/automation-narrow.png' });
  await panel.getByRole('button', { name: '关闭规则与统计' }).click();
  await page.getByRole('button', { name: /^收件箱/ }).click();
  const inbox = page.getByRole('dialog', { name: '收件箱' });
  await expect(inbox).toBeVisible();
  expect(await inbox.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: '.artifacts/collaboration-ui/inbox-narrow.png' });
});
