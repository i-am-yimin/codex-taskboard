/* eslint-disable @typescript-eslint/no-explicit-any -- Fastify inject JSON is intentionally untyped in endpoint tests. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabase } from '../apps/server/src/db.ts';
import { migrate } from '../apps/server/src/migrate.ts';
import { buildApp } from '../apps/server/src/app.ts';
import { hash, Algorithm } from '@node-rs/argon2';
import { randomUUID } from 'node:crypto';

const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

suite('server API', () => {
  let db: ReturnType<typeof createDatabase>;
  let app: ReturnType<typeof buildApp>;
  const password = 'a-long-test-password';
  let cookie = '';
  let userId = '';
  let spaceId = '';
  let taskId = '';

  beforeAll(async () => {
    if (!url || !new URL(url).pathname.endsWith('_test'))
      throw new Error('Server integration tests require a separate *_test database');
    db = createDatabase(url);
    app = buildApp({ db, sessionSecret: 'f'.repeat(64) });
    await migrate(db);
    userId = randomUUID();
    await db.query(
      'INSERT INTO users (id,email,name,password_hash,instance_admin) VALUES ($1,$2,$3,$4,true)',
      [
        userId,
        `server-${userId}@example.test`,
        'Server Test',
        await hash(password, { algorithm: Algorithm.Argon2id }),
      ],
    );
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: `server-${userId}@example.test`,
        password,
        deviceName: 'test',
      },
    });
    expect(login.statusCode).toBe(200);
    const setCookie = login.headers['set-cookie'];
    cookie = Array.isArray(setCookie) ? setCookie[0] : setCookie!;
  });
  afterAll(async () => {
    if (app) await app.close();
    if (db) await db.end();
  });
  type InjectResult = { body: string; statusCode: number; json(): any };
  const request = (
    method: string,
    url: string,
    payload?: unknown,
    headers: Record<string, string> = {},
  ) =>
    app.inject({
      method,
      url,
      payload,
      headers: { cookie, ...headers },
    } as any) as unknown as Promise<InjectResult>;
  const write = (
    method: string,
    url: string,
    payload?: unknown,
    headers: Record<string, string> = {},
  ) =>
    request(method, url, payload, {
      'idempotency-key': randomUUID(),
      ...headers,
    });

  it('isolates theme packages, retries idempotently, rejects stale versions and falls back atomically on deletion', async () => {
    const current = await request('GET', '/api/v1/me/appearance');
    expect(current.json().data).toMatchObject({ themeId: 'glass', version: 1 });
    const manifest = {
      formatVersion: 1,
      name: 'Forest',
      author: 'Test',
      version: '1.0.0',
      base: 'island',
      layout: 'rail',
      light: {},
      dark: {},
    };
    const uploaded = await write('POST', '/api/v1/me/themes', manifest);
    expect(uploaded.statusCode).toBe(200);
    const id = uploaded.json().data.id;
    expect((await write('POST', '/api/v1/me/themes', manifest)).json().data.id).toBe(id);
    expect((await request('GET', '/api/v1/me/themes')).json().data).toHaveLength(1);
    const selection = { themeId: id, mode: 'dark', layout: 'auto' };
    const headers = { 'if-match': '1', 'idempotency-key': randomUUID() };
    expect(
      (await write('PUT', '/api/v1/me/appearance', selection, headers)).json().data.version,
    ).toBe(2);
    expect(
      (await write('PUT', '/api/v1/me/appearance', selection, headers)).json().data.version,
    ).toBe(2);
    expect(
      (await write('PUT', '/api/v1/me/appearance', selection, { 'if-match': '1' })).statusCode,
    ).toBe(409);
    expect(
      (
        await write(
          'PUT',
          '/api/v1/me/appearance',
          { ...selection, themeId: 'a'.repeat(64) },
          { 'if-match': '2' },
        )
      ).statusCode,
    ).toBe(422);
    const otherId = randomUUID();
    await db.query('INSERT INTO users(id,email,name,password_hash) VALUES ($1,$2,$3,$4)', [
      otherId,
      `${otherId}@example.test`,
      'Other',
      await hash(password),
    ]);
    const otherLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: `${otherId}@example.test`, password, deviceName: 'theme-isolation' },
    });
    const rawCookie = otherLogin.headers['set-cookie'];
    const otherCookie = Array.isArray(rawCookie) ? rawCookie[0] : rawCookie!;
    const other = await app.inject({
      method: 'GET',
      url: '/api/v1/me/themes',
      headers: { cookie: otherCookie },
    });
    expect(other.json().data).toEqual([]);
    await app.inject({
      method: 'DELETE',
      url: `/api/v1/me/themes/${id}`,
      headers: { cookie: otherCookie, 'idempotency-key': randomUUID() },
    });
    expect((await request('GET', '/api/v1/me/themes')).json().data).toHaveLength(1);
    const removed = await write('DELETE', `/api/v1/me/themes/${id}`);
    expect(removed.json().data).toMatchObject({ themeId: 'glass', mode: 'dark', version: 3 });
    await migrate(db);
    expect((await request('GET', '/api/v1/me/appearance')).json().data.version).toBe(3);
    expect(
      (await write('POST', '/api/v1/me/themes', { ...manifest, css: 'body{display:none}' }))
        .statusCode,
    ).toBe(422);
    expect(
      (await write('POST', '/api/v1/me/themes', { ...manifest, name: 'x'.repeat(66000) }))
        .statusCode,
    ).toBe(413);
  });

  it('creates a space with the default workflow and enforces optimistic task updates', async () => {
    const created = await write('POST', '/api/v1/spaces', {
      name: '工作',
      icon: '◈',
      color: '#7466e8',
      description: '',
    });
    expect(created.statusCode).toBe(201);
    spaceId = created.json().data.id;
    const board = await request('GET', `/api/v1/spaces/${spaceId}/board`);
    expect(board.json().data.statuses).toHaveLength(5);
    const todo = board
      .json()
      .data.statuses.find((status: { semantic: string }) => status.semantic === 'todo');
    const task = await write('POST', `/api/v1/spaces/${spaceId}/tasks`, {
      title: 'Implement endpoint',
      statusId: todo.id,
      reviewerId: userId,
    });
    expect(task.statusCode).toBe(201);
    taskId = task.json().data.id;
    const version = task.json().data.version;
    const changed = await write(
      'PATCH',
      `/api/v1/tasks/${taskId}`,
      { title: 'Implement API endpoint' },
      { 'if-match': String(version) },
    );
    expect(changed.statusCode).toBe(200);
    const conflict = await write(
      'PATCH',
      `/api/v1/tasks/${taskId}`,
      { title: 'stale' },
      { 'if-match': String(version) },
    );
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json().error.code).toBe('VERSION_CONFLICT');
  });

  it('uses a single atomic claim and requires human acceptance', async () => {
    const task = (await request('GET', `/api/v1/tasks/${taskId}`)).json().data;
    const claim = await write(
      'POST',
      `/api/v1/tasks/${taskId}/claim`,
      { threadId: 'thread-test' },
      { 'if-match': String(task.version) },
    );
    expect(claim.statusCode).toBe(201);
    const duplicate = await write(
      'POST',
      `/api/v1/tasks/${taskId}/claim`,
      { threadId: null },
      { 'if-match': String(claim.json().data.task.version) },
    );
    expect(duplicate.statusCode).toBe(409);
    const submit = await write(
      'POST',
      `/api/v1/tasks/${taskId}/submit`,
      { summary: 'Done', verification: 'vitest', requirementsVersion: 1 },
      { 'if-match': String(claim.json().data.task.version) },
    );
    expect(submit.statusCode, submit.body).toBe(200);
    const accepted = await write(
      'POST',
      `/api/v1/tasks/${taskId}/accept`,
      {},
      { 'if-match': String(submit.json().data.task.version) },
    );
    expect(accepted.statusCode).toBe(200);
  });

  it('requires an idempotency key for writes', async () => {
    const response = await request('POST', `/api/v1/tasks/${taskId}/comments`, {
      body: 'missing key',
    });
    expect(response.statusCode).toBe(428);
  });

  it('allows only one concurrent claim and constrains agent tokens', async () => {
    const board = (await request('GET', `/api/v1/spaces/${spaceId}/board`)).json().data;
    const todo = board.statuses.find((status: { semantic: string }) => status.semantic === 'todo');
    const done = board.statuses.find((status: { semantic: string }) => status.semantic === 'done');
    const fresh = await write('POST', `/api/v1/spaces/${spaceId}/tasks`, {
      title: 'Concurrent claim',
      statusId: todo.id,
      reviewerId: userId,
    });
    const freshTask = fresh.json().data;
    const [first, second] = await Promise.all([
      write(
        'POST',
        `/api/v1/tasks/${freshTask.id}/claim`,
        { threadId: 'one' },
        { 'if-match': String(freshTask.version) },
      ),
      write(
        'POST',
        `/api/v1/tasks/${freshTask.id}/claim`,
        { threadId: 'two' },
        { 'if-match': String(freshTask.version) },
      ),
    ]);
    expect([first.statusCode, second.statusCode].sort()).toEqual([201, 409]);
    const agentLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: `server-${userId}@example.test`,
        password,
        deviceName: 'agent-test',
        tokenKind: 'agent',
      },
    });
    const token = agentLogin.json().data.deviceToken;
    const agentHeaders = {
      authorization: `Bearer ${token}`,
      'idempotency-key': randomUUID(),
    };
    const directDone = await app.inject({
      method: 'POST',
      url: `/api/v1/spaces/${spaceId}/tasks`,
      payload: { title: 'Bad done', statusId: done.id },
      headers: agentHeaders,
    });
    expect(directDone.statusCode).toBe(422);
    const forbidden = await app.inject({
      method: 'POST',
      url: `/api/v1/spaces/${spaceId}/statuses`,
      payload: {
        name: 'Nope',
        semantic: 'todo',
        position: 99,
        color: '#000000',
      },
      headers: {
        authorization: `Bearer ${token}`,
        'idempotency-key': randomUUID(),
      },
    });
    expect(forbidden.statusCode).toBe(403);
  });

  it('releases a stranded claim with a reason and rejects stale submission', async () => {
    const board = (await request('GET', `/api/v1/spaces/${spaceId}/board`)).json().data;
    const todo = board.statuses.find((status: { semantic: string }) => status.semantic === 'todo');
    const created = await write('POST', `/api/v1/spaces/${spaceId}/tasks`, {
      title: 'Recover claim',
      statusId: todo.id,
      reviewerId: userId,
    });
    const claimed = await write(
      'POST',
      `/api/v1/tasks/${created.json().data.id}/claim`,
      { threadId: 'lost-device' },
      { 'if-match': String(created.json().data.version) },
    );
    const released = await write(
      'POST',
      `/api/v1/tasks/${created.json().data.id}/release`,
      { reason: '旧设备不可用' },
      { 'if-match': String(claimed.json().data.task.version) },
    );
    expect(released.statusCode).toBe(200);
    expect(released.json().data.execution.phase).toBe('released');
    const stale = await write(
      'POST',
      `/api/v1/tasks/${created.json().data.id}/submit`,
      { summary: 'late', verification: 'late', requirementsVersion: 1 },
      { 'if-match': String(released.json().data.task.version) },
    );
    expect(stale.statusCode).toBe(409);
  });
});
