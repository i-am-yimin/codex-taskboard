import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hash } from '@node-rs/argon2';
import { createDatabase } from '../apps/server/src/db.ts';
import { migrate } from '../apps/server/src/migrate.ts';
import { buildApp } from '../apps/server/src/app.ts';
import { createCompanion } from '../apps/companion/src/main.ts';

const source = process.env.TEST_DATABASE_URL;
const suite = source ? describe : describe.skip;
suite('personal workflows through an isolated real companion', () => {
  const databaseName = `personal_${randomUUID().replaceAll('-', '')}_test`;
  const password = 'synthetic-personal-bridge-password';
  const accounts = [randomUUID(), randomUUID()].map((id) => ({
    id,
    email: `personal-${id}@example.test`,
  }));
  let control: ReturnType<typeof createDatabase>;
  let db: ReturnType<typeof createDatabase>;
  let server: ReturnType<typeof buildApp>;
  let companion: Awaited<ReturnType<typeof createCompanion>>;
  let directory: string;
  let spaceId: string;
  let taskId: string;
  const notificationId = randomUUID();
  type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  const local = (method: Method, path: string, payload?: object, version?: number) =>
    companion.app.inject({
      method,
      url: path,
      headers: {
        'x-taskboard-companion-key': companion.clientKey,
        'idempotency-key': randomUUID(),
        ...(version ? { 'if-match': String(version) } : {}),
      },
      ...(payload === undefined ? {} : { payload }),
    });
  const browser = (method: Method, path: string, payload?: object, version?: number) =>
    local(method, `/api/v1${path}`, payload, version);
  const login = async (index: number) => {
    const response = await local('POST', '/v1/browser/login', {
      email: accounts[index].email,
      password,
      deviceName: 'synthetic-personal-bridge',
    });
    expect(response.statusCode, response.body).toBe(200);
  };
  beforeAll(async () => {
    if (!source || !new URL(source).pathname.endsWith('_test'))
      throw new Error('requires an independent *_test root URL');
    control = createDatabase(source);
    await control.query(`CREATE DATABASE "${databaseName}"`);
    const target = new URL(source);
    target.pathname = `/${databaseName}`;
    db = createDatabase(target.toString());
    await migrate(db);
    for (const account of accounts)
      await db.query('INSERT INTO users(id,email,name,password_hash) VALUES($1,$2,$3,$4)', [
        account.id,
        account.email,
        'Synthetic personal user',
        await hash(password),
      ]);
    server = buildApp({ db, sessionSecret: 'a'.repeat(64), automation: { enabled: false } });
    const upstream = await server.listen({ host: '127.0.0.1', port: 0 });
    directory = await mkdtemp(join(tmpdir(), 'taskboard-personal-bridge-test-'));
    companion = await createCompanion({ port: 0, dataDirectory: directory, upstream });
    await login(0);
    const created = await browser('POST', '/spaces', { name: 'Synthetic personal space' });
    expect(created.statusCode, created.body).toBe(200);
    spaceId = created.json().data.id;
    await db.query('INSERT INTO space_members(space_id,user_id,role) VALUES($1,$2,$3)', [
      spaceId,
      accounts[1].id,
      'editor',
    ]);
    const board = (await browser('GET', `/spaces/${spaceId}/board`)).json().data;
    const task = await browser('POST', `/spaces/${spaceId}/tasks`, {
      title: 'Personal bridge task',
      statusId: board.statuses.find((status: { semantic: string }) => status.semantic === 'todo')
        .id,
      assigneeId: accounts[0].id,
    });
    expect(task.statusCode, task.body).toBe(200);
    taskId = task.json().data.id;
    await db.query(
      'INSERT INTO notifications(id,user_id,space_id,task_id,event_id,kind,title,group_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
      [
        notificationId,
        accounts[0].id,
        spaceId,
        taskId,
        randomUUID(),
        'assigned',
        'Synthetic notice',
        'synthetic',
      ],
    );
  }, 30000);
  afterAll(async () => {
    await companion?.stop();
    await server?.close();
    await db?.end();
    if (control) {
      if (!/^personal_[a-f0-9]{32}_test$/.test(databaseName)) throw new Error('unsafe cleanup');
      await control.query(
        'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()',
        [databaseName],
      );
      await control.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
      await control.end();
    }
    if (directory) await rm(directory, { recursive: true, force: true });
  });
  it('forwards personal queries and persists filter CRUD with version conflicts', async () => {
    const tasks = await browser(
      'GET',
      `/me/tasks?relation=responsible&spaceId=${spaceId}&search=bridge&priority=1&limit=10`,
    );
    expect(tasks.statusCode, tasks.body).toBe(200);
    // A second query checks the actual assigned task without assuming its default priority.
    const assigned = await browser(
      'GET',
      `/me/tasks?relation=responsible&spaceId=${spaceId}&limit=10`,
    );
    expect(assigned.json().data.items.map((task: { id: string }) => task.id)).toContain(taskId);
    expect((await browser('GET', '/me/tasks?unexpected=true')).statusCode).toBe(422);
    const input = { name: 'Assigned', spaceId, query: { relation: 'responsible', spaceId } };
    const created = await browser('POST', '/me/saved-filters', input);
    expect(created.statusCode, created.body).toBe(200);
    const filter = created.json().data;
    expect((await browser('GET', '/me/saved-filters')).json().data).toContainEqual(filter);
    const changed = await browser(
      'PATCH',
      `/me/saved-filters/${filter.id}`,
      { ...input, name: 'Renamed' },
      filter.version,
    );
    expect(changed.statusCode, changed.body).toBe(200);
    expect(changed.json().data.version).toBe(filter.version + 1);
    expect(
      (await browser('DELETE', `/me/saved-filters/${filter.id}`, undefined, filter.version))
        .statusCode,
    ).toBe(409);
    expect(
      (
        await browser(
          'DELETE',
          `/me/saved-filters/${filter.id}`,
          undefined,
          changed.json().data.version,
        )
      ).json().data,
    ).toEqual({ deleted: true });
    expect((await browser('GET', '/me/saved-filters')).json().data).toEqual([]);
  });
  it('persists notification preferences and actions and isolates account switches', async () => {
    const preference = await browser('PUT', `/me/notification-preferences/${spaceId}`, {
      desktopEnabled: true,
      mergeWindowSeconds: 30,
      mutedUntil: null,
    });
    expect(preference.statusCode, preference.body).toBe(200);
    expect((await browser('GET', '/me/notification-preferences')).json().data).toContainEqual(
      expect.objectContaining({ spaceId, desktopEnabled: true, mergeWindowSeconds: 30 }),
    );
    const read = await browser('POST', `/me/notifications/${notificationId}/read`, {});
    expect(read.statusCode, read.body).toBe(200);
    expect(read.json().data.readAt).toBeTruthy();
    expect(
      (await db.query('SELECT read_at FROM notifications WHERE id=$1', [notificationId])).rows[0]
        .read_at,
    ).toBeTruthy();
    const filter = (
      await browser('POST', '/me/saved-filters', { name: 'Private A', query: {} })
    ).json().data;
    await login(1);
    expect((await browser('GET', '/me/saved-filters')).json().data).toEqual([]);
    expect((await browser('GET', '/me/notifications')).json().data.items).toEqual([]);
    expect((await browser('GET', '/me/notification-preferences')).json().data).toEqual([]);
    expect(
      (
        await browser(
          'PATCH',
          `/me/saved-filters/${filter.id}`,
          { name: 'Stolen', query: {} },
          filter.version,
        )
      ).statusCode,
    ).toBe(404);
    expect(
      (await browser('DELETE', `/me/saved-filters/${filter.id}`, undefined, filter.version))
        .statusCode,
    ).toBe(404);
    expect(
      (await browser('POST', `/me/notifications/${notificationId}/handle`, {})).statusCode,
    ).toBe(404);
    await login(0);
    expect((await browser('GET', '/me/saved-filters')).json().data).toContainEqual(filter);
    expect(
      (await browser('GET', '/me/notifications?unread=false&limit=10')).json().data.items,
    ).toContainEqual(expect.objectContaining({ id: notificationId, handledAt: null }));
  });
  it('rejects Agent personal writes and keeps CLI and streaming proxy boundaries', async () => {
    const logged = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: accounts[0].email,
        password,
        deviceName: 'synthetic-agent',
        tokenKind: 'agent',
      },
    });
    expect(logged.statusCode).toBe(200);
    const token = logged.json().data.deviceToken;
    for (const [method, path, payload] of [
      ['POST', '/me/saved-filters', { name: 'Forbidden', query: {} }],
      ['POST', `/me/notifications/${notificationId}/read`, {}],
      ['PUT', `/me/notification-preferences/${spaceId}`, { desktopEnabled: false }],
    ] as const) {
      const response = await server.inject({
        method,
        url: `/api/v1${path}`,
        headers: { authorization: `Bearer ${token}`, 'idempotency-key': randomUUID() },
        payload,
      });
      expect(response.statusCode, response.body).toBe(403);
      expect(response.json().error.code).toBe('AGENT_SCOPE_FORBIDDEN');
    }
    expect(
      (
        await local('POST', '/v1/api/me/saved-filters', {
          body: { name: 'Forbidden', query: {} },
          idempotencyKey: randomUUID(),
        })
      ).statusCode,
    ).toBe(403);
    expect((await browser('GET', '/me/notification-events')).statusCode).toBe(403);
    expect((await browser('POST', '/me/tasks', {})).statusCode).toBe(403);
    expect((await browser('GET', '/me/saved-filters/anything/else')).statusCode).toBe(403);
  });
});
