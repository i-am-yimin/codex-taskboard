/* eslint-disable @typescript-eslint/no-explicit-any -- Inject test envelopes are decoded at the API boundary. */
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { hash } from '@node-rs/argon2';
import { createDatabase } from '../apps/server/src/db.ts';
import { migrate } from '../apps/server/src/migrate.ts';
import { buildApp } from '../apps/server/src/app.ts';
const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;
suite('persistent workflow services', () => {
  let db: ReturnType<typeof createDatabase>;
  let app: ReturnType<typeof buildApp>;
  let cookie = '';
  let reviewerCookie = '';
  let userId = '';
  let reviewerId = '';
  let spaceId = '';
  let todo = '';
  let clock = new Date();
  const password = 'synthetic-workflow-password';
  const request = (
    method: string,
    path: string,
    payload?: unknown,
    version?: number,
    userCookie = cookie,
  ) =>
    app.inject({
      method,
      url: `/api/v1${path}`,
      payload,
      headers: {
        cookie: userCookie,
        'idempotency-key': randomUUID(),
        ...(version ? { 'if-match': String(version) } : {}),
      },
    } as any) as unknown as Promise<{ statusCode: number; body: string; json(): any }>;
  const task = async (title: string, extra = {}) => {
    const reply = await request('POST', `/spaces/${spaceId}/tasks`, {
      title,
      statusId: todo,
      reviewerId,
      ...extra,
    });
    expect(reply.statusCode, reply.body).toBe(201);
    return reply.json().data;
  };
  const rule = async (type: string, config: unknown) => {
    const reply = await request('POST', `/spaces/${spaceId}/automation-rules`, {
      type,
      config,
      timezone: 'Asia/Shanghai',
      nextRunAt: clock.toISOString(),
    });
    expect(reply.statusCode, reply.body).toBe(200);
    return reply.json().data;
  };
  beforeAll(async () => {
    if (!url || !new URL(url).pathname.endsWith('_test'))
      throw new Error('requires independent *_test database');
    db = createDatabase(url);
    await migrate(db);
    app = buildApp({
      db,
      sessionSecret: 'd'.repeat(64),
      automation: { enabled: false, clock: () => clock },
    });
    for (const role of ['owner', 'reviewer']) {
      const id = randomUUID();
      const email = `workflow-${id}@example.test`;
      await db.query('INSERT INTO users(id,email,name,password_hash) VALUES($1,$2,$3,$4)', [
        id,
        email,
        role,
        await hash(password),
      ]);
      const login = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email, password },
      });
      const raw = login.headers['set-cookie'];
      if (role === 'owner') {
        userId = id;
        cookie = Array.isArray(raw) ? raw[0] : raw!;
      } else {
        reviewerId = id;
        reviewerCookie = Array.isArray(raw) ? raw[0] : raw!;
      }
    }
    const created = await request('POST', '/spaces', { name: 'Synthetic workflow services' });
    expect(created.statusCode).toBe(201);
    spaceId = created.json().data.id;
    await db.query("INSERT INTO space_members(space_id,user_id,role) VALUES($1,$2,'editor')", [
      spaceId,
      reviewerId,
    ]);
    todo = (await request('GET', `/spaces/${spaceId}/board`))
      .json()
      .data.statuses.find((s: any) => s.semantic === 'todo').id;
  }, 30000);
  afterAll(async () => {
    await app?.close();
    await db?.end();
  });
  it('persists precise recipient notifications, mention targets and independent read/handle/snooze', async () => {
    const created = await task('Notification target');
    const comment = await request('POST', `/tasks/${created.id}/comments`, {
      body: 'Please inspect this result',
      mentionIds: [reviewerId],
    });
    expect(comment.statusCode).toBe(201);
    const result = await request(
      'GET',
      `/me/notifications?spaceId=${spaceId}`,
      undefined,
      undefined,
      reviewerCookie,
    );
    expect(result.statusCode, result.body).toBe(200);
    const notification = result
      .json()
      .data.items.find((item: any) => item.kind === 'comment.added' && item.taskId === created.id);
    expect(notification).toBeDefined();
    const actor = await request('GET', `/me/notifications?spaceId=${spaceId}`);
    expect(
      actor
        .json()
        .data.items.some(
          (item: any) => item.kind === 'comment.added' && item.taskId === created.id,
        ),
    ).toBe(false);
    const read = await request(
      'POST',
      `/me/notifications/${notification.id}/read`,
      {},
      undefined,
      reviewerCookie,
    );
    expect(read.json().data.readAt).not.toBeNull();
    expect(read.json().data.handledAt).toBeNull();
    const snooze = await request(
      'POST',
      `/me/notifications/${notification.id}/snooze`,
      { until: new Date(Date.now() + 3600000).toISOString() },
      undefined,
      reviewerCookie,
    );
    expect(snooze.statusCode).toBe(200);
    const handle = await request(
      'POST',
      `/me/notifications/${notification.id}/handle`,
      {},
      undefined,
      reviewerCookie,
    );
    expect(handle.json().data.handledAt).not.toBeNull();
    const wrong = await request('POST', `/me/notifications/${notification.id}/read`, {});
    expect(wrong.statusCode).toBe(404);
    const preferences = await request(
      'PUT',
      `/me/notification-preferences/${spaceId}`,
      {
        desktopEnabled: true,
        mutedUntil: new Date(Date.now() + 3600000).toISOString(),
        mergeWindowSeconds: 60,
      },
      undefined,
      reviewerCookie,
    );
    expect(preferences.statusCode).toBe(200);
    const delivery = await request(
      'POST',
      `/me/notifications/${notification.id}/delivery`,
      {},
      undefined,
      reviewerCookie,
    );
    expect(delivery.json().error.code).toBe('NOTIFICATION_MUTED');
  });
  it('claims desktop delivery once while preserving unread state and deduplicates the event', async () => {
    const created = await task('Desktop delivery fact');
    await request('POST', `/tasks/${created.id}/comments`, {
      body: 'Desktop fact',
      mentionIds: [reviewerId],
    });
    const inbox = (
      await request(
        'GET',
        `/me/notifications?spaceId=${spaceId}`,
        undefined,
        undefined,
        reviewerCookie,
      )
    ).json().data.items;
    const notification = inbox.find(
      (n: any) => n.kind === 'comment.added' && n.taskId === created.id,
    );
    await request(
      'PUT',
      `/me/notification-preferences/${spaceId}`,
      { desktopEnabled: true, mutedUntil: null, mergeWindowSeconds: 60 },
      undefined,
      reviewerCookie,
    );
    const first = await request(
      'POST',
      `/me/notifications/${notification.id}/delivery`,
      {},
      undefined,
      reviewerCookie,
    );
    expect(first.statusCode, first.body).toBe(200);
    expect(first.json().data.readAt).toBeNull();
    const duplicate = await request(
      'POST',
      `/me/notifications/${notification.id}/delivery`,
      {},
      undefined,
      reviewerCookie,
    );
    expect(duplicate.json().error.code).toBe('DELIVERY_CLAIMED');
    const ack = await request(
      'POST',
      `/me/notifications/${notification.id}/delivered`,
      { deliveryToken: first.json().data.deliveryToken },
      undefined,
      reviewerCookie,
    );
    expect(ack.statusCode, ack.body).toBe(200);
    expect(ack.json().data.deliveredAt).not.toBeNull();
    expect(ack.json().data.readAt).toBeNull();
  });
  it('returns real personal relations and versioned private filters with strict query validation', async () => {
    const created = await task('Personal focus');
    const mine = await request(
      'GET',
      `/me/tasks?relation=responsible&spaceId=${spaceId}&search=Personal`,
    );
    expect(mine.json().data.items.map((t: any) => t.id)).toContain(created.id);
    const save = await request('POST', '/me/saved-filters', {
      name: 'My focus',
      spaceId,
      query: { relation: 'responsible', spaceId, search: 'Personal' },
    });
    expect(save.statusCode, save.body).toBe(200);
    const id = save.json().data.id;
    const stale = await request(
      'PATCH',
      `/me/saved-filters/${id}`,
      { name: 'stale', spaceId, query: {} },
      99,
    );
    expect(stale.statusCode).toBe(409);
    const list = await request('GET', '/me/saved-filters', undefined, undefined, reviewerCookie);
    expect(list.json().data.some((f: any) => f.id === id)).toBe(false);
    const invalid = await request('POST', '/me/saved-filters', {
      name: 'invalid',
      query: { sql: 'drop' },
    });
    expect(invalid.statusCode).toBe(422);
  });
  it('actually generates fixed interval tasks once across competing workers and supports disable', async () => {
    const recurring = await rule('recurring', {
      title: 'Scheduled real task',
      description: 'generated from stored rule',
      assigneeId: userId,
      reviewerId,
      acceptanceCriteria: 'review required',
      intervalHours: 2,
    });
    const second = buildApp({
      db,
      sessionSecret: 'c'.repeat(64),
      automation: { enabled: false, clock: () => clock },
    });
    await second.ready();
    await Promise.all([app.runWorkflowAutomation(), second.runWorkflowAutomation()]);
    await second.close();
    const occurrences = await db.query('SELECT * FROM automation_occurrences WHERE rule_id=$1', [
      recurring.id,
    ]);
    expect(occurrences.rowCount).toBe(1);
    expect(occurrences.rows[0].task_id).not.toBeNull();
    const generated = (
      await db.query('SELECT title,reviewer_id FROM tasks WHERE id=$1', [
        occurrences.rows[0].task_id,
      ])
    ).rows[0];
    expect(generated).toMatchObject({ title: 'Scheduled real task', reviewer_id: reviewerId });
    const current = (await request('GET', `/spaces/${spaceId}/automation-rules`))
      .json()
      .data.find((r: any) => r.id === recurring.id);
    const paused = await request(
      'PATCH',
      `/spaces/${spaceId}/automation-rules/${recurring.id}`,
      { enabled: false },
      current.version,
    );
    expect(paused.statusCode, paused.body).toBe(200);
    clock = new Date(clock.getTime() + 3 * 3600000);
    await app.runWorkflowAutomation();
    expect(
      (
        await db.query('SELECT count(*)::int n FROM automation_occurrences WHERE rule_id=$1', [
          recurring.id,
        ])
      ).rows[0].n,
    ).toBe(1);
  });
  it('starts the real bounded worker on application readiness and closes it cleanly', async () => {
    const recurring = await rule('recurring', { title: 'Lifecycle task', intervalHours: 24 });
    const worker = buildApp({
      db,
      sessionSecret: 'b'.repeat(64),
      automation: { clock: () => clock, intervalMs: 1000 },
    });
    await worker.ready();
    await worker.runWorkflowAutomation();
    expect(
      (
        await db.query('SELECT count(*)::int n FROM automation_occurrences WHERE rule_id=$1', [
          recurring.id,
        ])
      ).rows[0].n,
    ).toBe(1);
    await worker.close();
  });
  it('escalates real overdue and review waits without repeating occurrences', async () => {
    const overdue = await task('Actually overdue', {
      dueAt: new Date(clock.getTime() - 3600000).toISOString(),
    });
    const overdueRule = await rule('overdue', { thresholdMinutes: 10 });
    await app.runWorkflowAutomation();
    clock = new Date(clock.getTime() + 120000);
    await app.runWorkflowAutomation();
    expect(
      (
        await db.query(
          'SELECT count(*)::int n FROM automation_occurrences WHERE rule_id=$1 AND task_id=$2',
          [overdueRule.id, overdue.id],
        )
      ).rows[0].n,
    ).toBe(1);
    expect(
      (
        await db.query(
          "SELECT count(*)::int n FROM notifications WHERE task_id=$1 AND kind='automation.overdue'",
          [overdue.id],
        )
      ).rows[0].n,
    ).toBeGreaterThan(0);
    const review = await task('Long review');
    await db.query(
      "INSERT INTO task_state_intervals(id,task_id,kind,started_at) VALUES($1,$2,'review_wait',$3)",
      [randomUUID(), review.id, new Date(clock.getTime() - 7200000)],
    );
    const reviewRule = await rule('review_wait', { thresholdMinutes: 30 });
    await app.runWorkflowAutomation();
    expect(
      (
        await db.query(
          'SELECT count(*)::int n FROM automation_occurrences WHERE rule_id=$1 AND task_id=$2',
          [reviewRule.id, review.id],
        )
      ).rows[0].n,
    ).toBe(1);
  });
  it('starts a new snooze delivery round and rejects the previous exact lease token', async () => {
    const created = await task('Synthetic reminder round');
    await request('POST', `/tasks/${created.id}/comments`, {
      body: 'Synthetic reminder only',
      mentionIds: [reviewerId],
    });
    await request(
      'PUT',
      `/me/notification-preferences/${spaceId}`,
      { desktopEnabled: true, mutedUntil: null, mergeWindowSeconds: 60 },
      undefined,
      reviewerCookie,
    );
    const notifications = await request(
      'GET',
      `/me/notifications?spaceId=${spaceId}`,
      undefined,
      undefined,
      reviewerCookie,
    );
    const notice = notifications.json().data.items.find((item: any) => item.taskId === created.id);
    expect(notice).toBeDefined();
    const claim = () =>
      request('POST', `/me/notifications/${notice.id}/delivery`, {}, undefined, reviewerCookie);
    const ack = (deliveryToken: string) =>
      request(
        'POST',
        `/me/notifications/${notice.id}/delivered`,
        { deliveryToken },
        undefined,
        reviewerCookie,
      );
    const firstKey = randomUUID();
    const firstClaimRequest = {
      method: 'POST' as const,
      url: `/api/v1/me/notifications/${notice.id}/delivery`,
      headers: { cookie: reviewerCookie, 'idempotency-key': firstKey },
      payload: {},
    };
    const first = await app.inject(firstClaimRequest);
    expect(first.statusCode, first.body).toBe(200);
    const token1 = first.json().data.deliveryToken;
    expect(typeof token1).toBe('string');
    const snoozed = await request(
      'POST',
      `/me/notifications/${notice.id}/snooze`,
      { until: new Date(Date.now() + 60000).toISOString() },
      undefined,
      reviewerCookie,
    );
    expect(snoozed.statusCode, snoozed.body).toBe(200);
    expect(snoozed.json().data.deliveryClaimedAt).toBeNull();
    const replayed = await app.inject(firstClaimRequest);
    expect(replayed.statusCode, replayed.body).toBe(409);
    expect(replayed.json().error.code).toBe('DELIVERY_LEASE_EXPIRED');
    expect((await ack(token1)).json().error.code).toBe('DELIVERY_LEASE_EXPIRED');
    expect((await claim()).json().error.code).toBe('NOTIFICATION_MUTED');
    // Independent synthetic database only: advance the reminder's eligibility without a real wait.
    await db.query(
      "UPDATE notifications SET snoozed_until=clock_timestamp()-interval '1 second' WHERE id=$1",
      [notice.id],
    );
    const second = await claim();
    expect(second.statusCode, second.body).toBe(200);
    const token2 = second.json().data.deliveryToken;
    expect(token2).not.toBe(token1);
    const stale = await ack(token1);
    expect(stale.statusCode).toBe(409);
    expect(stale.json().error.code).toBe('DELIVERY_LEASE_EXPIRED');
    const current = await ack(token2);
    expect(current.statusCode, current.body).toBe(200);
    expect(current.json().data.readAt).toBeNull();
    expect(current.json().data.handledAt).toBeNull();
    expect(current.json().data.deliveredAt).not.toBeNull();
    await request('POST', `/me/notifications/${notice.id}/read`, {}, undefined, reviewerCookie);
    const readSnooze = await request(
      'POST',
      `/me/notifications/${notice.id}/snooze`,
      { until: new Date(Date.now() + 60000).toISOString() },
      undefined,
      reviewerCookie,
    );
    expect(readSnooze.statusCode, readSnooze.body).toBe(200);
    expect(readSnooze.json().data.readAt).not.toBeNull();
    await db.query(
      "UPDATE notifications SET snoozed_until=clock_timestamp()-interval '1 second' WHERE id=$1",
      [notice.id],
    );
    const third = await claim();
    expect(third.statusCode, third.body).toBe(200);
    const thirdAck = await ack(third.json().data.deliveryToken);
    expect(thirdAck.json().data.readAt).not.toBeNull();
    await request('POST', `/me/notifications/${notice.id}/handle`, {}, undefined, reviewerCookie);
    const handledSnooze = await request(
      'POST',
      `/me/notifications/${notice.id}/snooze`,
      { until: new Date(Date.now() + 60000).toISOString() },
      undefined,
      reviewerCookie,
    );
    expect(handledSnooze.statusCode).toBe(409);
    expect(handledSnooze.json().error.code).toBe('NOTIFICATION_HANDLED');
  });
  it('selects an old due snooze independently of the newest inbox page', async () => {
    const created = await task('Old synthetic reminder');
    await request(
      'PUT',
      `/me/notification-preferences/${spaceId}`,
      { desktopEnabled: true, mutedUntil: null, mergeWindowSeconds: 60 },
      undefined,
      reviewerCookie,
    );
    const oldId = randomUUID();
    const rows = Array.from({ length: 61 }, (_, index) => ({
      id: randomUUID(),
      eventId: randomUUID(),
      createdAt: new Date(Date.now() - index * 1000).toISOString(),
    }));
    await db.query(
      'INSERT INTO notifications(id,user_id,space_id,task_id,event_id,kind,title,body,group_key,created_at,read_at) SELECT item.id,$2,$3,$4,item."eventId",\'synthetic.read\',\'Newer read event\',\'\',\'synthetic\',item."createdAt",clock_timestamp() FROM jsonb_to_recordset($1::jsonb) AS item(id uuid,"eventId" uuid,"createdAt" timestamptz)',
      [JSON.stringify(rows), reviewerId, spaceId, created.id],
    );
    await db.query(
      "INSERT INTO notifications(id,user_id,space_id,task_id,event_id,kind,title,body,group_key,created_at,read_at,snoozed_until) VALUES($1,$2,$3,$4,$5,'synthetic.snooze','Old due event','','old-snooze',clock_timestamp()-interval '2 days',clock_timestamp()-interval '1 day',clock_timestamp()-interval '1 minute')",
      [oldId, reviewerId, spaceId, created.id, randomUUID()],
    );
    const latest = await request(
      'GET',
      `/me/notifications?spaceId=${spaceId}&limit=50`,
      undefined,
      undefined,
      reviewerCookie,
    );
    expect(latest.json().data.items.some((item: any) => item.id === oldId)).toBe(false);
    const eligible = await request(
      'GET',
      `/me/notifications?deliverable=true&spaceId=${spaceId}&limit=50`,
      undefined,
      undefined,
      reviewerCookie,
    );
    expect(eligible.statusCode, eligible.body).toBe(200);
    expect(eligible.json().data.items.some((item: any) => item.id === oldId)).toBe(true);
    expect(eligible.json().data.items.length).toBeLessThanOrEqual(50);
    expect(eligible.json().data.nextCursor).toBeNull();
  });
  it('derives dependency reminders and exact metrics from persisted facts, excluding legacy estimates', async () => {
    const upstream = await task('Upstream fact');
    const downstream = await task('Downstream fact');
    await db.query('INSERT INTO task_dependencies(task_id,depends_on_task_id) VALUES($1,$2)', [
      downstream.id,
      upstream.id,
    ]);
    await db.query(
      "UPDATE tasks SET status_id=(SELECT id FROM statuses WHERE space_id=$2 AND semantic='done' LIMIT 1) WHERE id=$1",
      [upstream.id, spaceId],
    );
    const dependencyRule = await rule('dependency_reminder', {});
    await app.runWorkflowAutomation();
    expect(
      (
        await db.query(
          'SELECT count(*)::int n FROM automation_occurrences WHERE rule_id=$1 AND task_id=$2',
          [dependencyRule.id, downstream.id],
        )
      ).rows[0].n,
    ).toBe(1);
    await db.query(
      "INSERT INTO task_state_intervals(id,task_id,kind,started_at,ended_at,precision) VALUES($1,$2,'blocked',$3,$4,'exact'),($5,$2,'blocked',$3,$4,'legacy_unknown')",
      [
        randomUUID(),
        downstream.id,
        new Date(clock.getTime() - 7200000),
        new Date(clock.getTime() - 3600000),
        randomUUID(),
      ],
    );
    const metric = await request(
      'GET',
      `/spaces/${spaceId}/workflow-metrics?from=${encodeURIComponent(new Date(clock.getTime() - 86400000).toISOString())}&to=${encodeURIComponent(clock.toISOString())}`,
    );
    expect(metric.statusCode, metric.body).toBe(200);
    const blocked = metric.json().data.items.find((i: any) => i.kind === 'blocked');
    expect(blocked.totalSeconds).toBe(3600);
    expect(blocked.sampleCount).toBe(1);
    expect(metric.json().data.legacyUnknownCount).toBe(1);
    await db.query('DELETE FROM space_members WHERE space_id=$1 AND user_id=$2', [
      spaceId,
      reviewerId,
    ]);
    const revoked = await request(
      'GET',
      `/me/notifications?spaceId=${spaceId}`,
      undefined,
      undefined,
      reviewerCookie,
    );
    expect(revoked.json().data.items).toEqual([]);
  });
});
