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
  const db = createDatabase(url);
  const app = buildApp({ db, sessionSecret: 'f'.repeat(64) });
  const password = 'a-long-test-password';
  let cookie = '';
  let userId = '';
  let spaceId = '';
  let taskId = '';

  beforeAll(async () => {
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
    await app.close();
  });
  type InjectResult = { statusCode: number; json(): any };
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
      { summary: 'Done', verification: 'vitest' },
      { 'if-match': String(claim.json().data.task.version) },
    );
    expect(submit.statusCode).toBe(200);
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
      { summary: 'late', verification: 'late' },
      { 'if-match': String(released.json().data.task.version) },
    );
    expect(stale.statusCode).toBe(409);
  });
});
