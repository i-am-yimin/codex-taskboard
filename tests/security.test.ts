import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { hash } from '@node-rs/argon2';
import type { FastifyInstance } from 'fastify';
import { createDatabase, type Database } from '../apps/server/src/db';
import { migrate } from '../apps/server/src/migrate';
import { buildApp } from '../apps/server/src/app';
import type { Board, Space, Task } from '../packages/core/src/index';

const databaseUrl = process.env.TEST_DATABASE_URL;
describe.skipIf(!databaseUrl)('independent security and concurrency acceptance', () => {
  let db: Database;
  let app: FastifyInstance;
  const password = 'test-only-password-at-least-12';
  const users = ['owner', 'outsider', 'viewer'].map((name) => ({
    id: randomUUID(),
    name,
    email: `${name}-${randomUUID()}@example.test`,
    cookie: '',
  }));
  let board: Board;
  let task: Task;
  let agentToken: string;
  const req = (
    user: number,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    url: string,
    payload?: Record<string, unknown>,
    headers: Record<string, string> = {},
  ) =>
    app.inject({
      method,
      url: `/api/v1${url}`,
      payload,
      headers: {
        cookie: users[user].cookie,
        ...(method !== 'GET' ? { 'idempotency-key': randomUUID() } : {}),
        ...headers,
      },
    });
  beforeAll(async () => {
    if (!databaseUrl || !new URL(databaseUrl).pathname.endsWith('_test'))
      throw new Error('Security tests require a separate *_test database');
    db = createDatabase(databaseUrl);
    await migrate(db);
    app = buildApp({ db, sessionSecret: 'f'.repeat(64) });
    for (const user of users) {
      await db.query('INSERT INTO users (id,email,name,password_hash) VALUES ($1,$2,$3,$4)', [
        user.id,
        user.email,
        user.name,
        await hash(password),
      ]);
      const login = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: user.email, password },
      });
      expect(login.statusCode).toBe(200);
      user.cookie = String(login.headers['set-cookie']).split(';')[0];
    }
    const spaceResponse = await req(0, 'POST', '/spaces', { name: 'Audit space' });
    expect(spaceResponse.statusCode).toBe(201);
    const space = spaceResponse.json<{ data: Space }>().data;
    await db.query("INSERT INTO space_members(space_id,user_id,role) VALUES ($1,$2,'viewer')", [
      space.id,
      users[2].id,
    ]);
    board = (await req(0, 'GET', `/spaces/${space.id}/board`)).json<{ data: Board }>().data;
    const taskResponse = await req(0, 'POST', `/spaces/${space.id}/tasks`, {
      title: 'Audit task',
      statusId: board.statuses[0].id,
    });
    expect(taskResponse.statusCode).toBe(201);
    task = taskResponse.json<{ data: Task }>().data;
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: users[0].email, password, tokenKind: 'agent' },
    });
    agentToken = login.json<{ data: { deviceToken: string } }>().data.deviceToken;
  });
  afterAll(async () => {
    if (app) await app.close();
    if (db) await db.end();
  });

  it('isolates guessed task IDs, board, list and export across spaces', async () => {
    for (const path of [
      `/tasks/${task.id}`,
      `/tasks/${task.id}/detail`,
      `/spaces/${board.space.id}/board`,
      `/spaces/${board.space.id}/tasks`,
      `/spaces/${board.space.id}/export`,
    ]) {
      const response = await req(1, 'GET', path);
      expect([403, 404]).toContain(response.statusCode);
      expect(response.body).not.toContain('Audit task');
    }
  });
  it('read-only members cannot comment or update a task', async () => {
    expect(
      (await req(2, 'POST', `/tasks/${task.id}/comments`, { body: 'forbidden comment' }))
        .statusCode,
    ).toBe(403);
    expect(
      (
        await req(
          2,
          'PATCH',
          `/tasks/${task.id}`,
          { title: 'forbidden edit' },
          { 'if-match': String(task.version) },
        )
      ).statusCode,
    ).toBe(403);
  });
  it('does not assign a task to an outsider', async () => {
    const response = await req(
      0,
      'PATCH',
      `/tasks/${task.id}`,
      { assigneeId: users[1].id },
      { 'if-match': String(task.version) },
    );
    expect([400, 403, 422]).toContain(response.statusCode);
    expect(
      (
        await req(0, 'POST', `/spaces/${board.space.id}/tasks`, {
          title: 'invalid assignee',
          statusId: board.statuses[0].id,
          assigneeId: users[1].id,
        })
      ).statusCode,
    ).toBe(422);
  });
  it('exports authorized task data and protects the owner from administrator mutations', async () => {
    const exported = await req(0, 'GET', `/spaces/${board.space.id}/export`);
    expect(exported.statusCode).toBe(200);
    expect(exported.json().data.tasks.some((t: Task) => t.id === task.id)).toBe(true);
    await db.query("UPDATE space_members SET role='admin' WHERE space_id=$1 AND user_id=$2", [
      board.space.id,
      users[2].id,
    ]);
    expect(
      (await req(2, 'POST', `/spaces/${board.space.id}/invitations`, { role: 'owner' })).statusCode,
    ).toBe(422);
    expect([403, 404, 422]).toContain(
      (
        await req(2, 'PATCH', `/spaces/${board.space.id}/members/${users[0].id}`, {
          role: 'viewer',
        })
      ).statusCode,
    );
    expect(
      (
        await db.query(
          "SELECT count(*)::int count FROM space_members WHERE space_id=$1 AND role='owner'",
          [board.space.id],
        )
      ).rows[0].count,
    ).toBe(1);
  });
  it('rolls back business writes when recording the idempotent response fails', async () => {
    await db.query(
      `CREATE OR REPLACE FUNCTION audit_idempotency_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.key = 'audit-fault-injection' THEN RAISE EXCEPTION 'simulated storage failure'; END IF; RETURN NEW; END $$`,
    );
    await db.query(
      'CREATE TRIGGER audit_idempotency_failure BEFORE INSERT ON idempotency_keys FOR EACH ROW EXECUTE FUNCTION audit_idempotency_failure()',
    );
    try {
      const result = await req(
        0,
        'POST',
        `/tasks/${task.id}/comments`,
        { body: 'must roll back with receipt' },
        { 'idempotency-key': 'audit-fault-injection' },
      );
      expect(result.statusCode).toBe(500);
      expect(
        (
          await db.query('SELECT count(*)::int count FROM comments WHERE task_id=$1 AND body=$2', [
            task.id,
            'must roll back with receipt',
          ])
        ).rows[0].count,
      ).toBe(0);
      expect(
        (
          await db.query(
            'SELECT count(*)::int count FROM activities WHERE task_id=$1 AND body=$2',
            [task.id, 'must roll back with receipt'],
          )
        ).rows[0].count,
      ).toBe(0);
    } finally {
      await db.query('DROP TRIGGER audit_idempotency_failure ON idempotency_keys');
      await db.query('DROP FUNCTION audit_idempotency_failure()');
    }
    const retry = await req(
      0,
      'POST',
      `/tasks/${task.id}/comments`,
      { body: 'must roll back with receipt' },
      { 'idempotency-key': 'audit-fault-injection' },
    );
    expect(retry.statusCode).toBe(201);
  });
  it('closes SSE immediately after logout and never sends another board event', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: users[0].email, password },
    });
    const streamCookie = String(login.headers['set-cookie']).split(';')[0];
    const address = await app.listen({ host: '127.0.0.1', port: 0 });
    const controller = new AbortController();
    try {
      const response = await fetch(`${address}/api/v1/spaces/${board.space.id}/events`, {
        headers: { cookie: streamCookie },
        signal: controller.signal,
      });
      expect(response.status).toBe(200);
      const reader = response.body!.getReader();
      const decode = new TextDecoder();
      expect(decode.decode((await reader.read()).value)).toContain('event: ready');
      const loggedOut = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
        headers: { cookie: streamCookie },
      });
      expect(loggedOut.statusCode).toBe(200);
      const event = await Promise.race([
        reader.read(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('SSE was not revoked')), 2000),
        ),
      ]);
      const text = decode.decode(event.value);
      expect(text).toContain('event: revoked');
      expect(text).not.toContain('event: board');
      await reader.cancel();
    } finally {
      controller.abort();
    }
  });
  it('serializes duplicate creation and rejects fingerprint reuse', async () => {
    const key = randomUUID();
    const input = { title: 'Exactly once', statusId: board.statuses[0].id };
    const responses = await Promise.all([
      req(0, 'POST', `/spaces/${board.space.id}/tasks`, input, { 'idempotency-key': key }),
      req(0, 'POST', `/spaces/${board.space.id}/tasks`, input, { 'idempotency-key': key }),
    ]);
    expect(responses.map((r) => r.statusCode)).toEqual([201, 201]);
    expect(responses[0].json().data.id).toBe(responses[1].json().data.id);
    expect(
      (
        await db.query('SELECT count(*)::int count FROM tasks WHERE space_id=$1 AND title=$2', [
          board.space.id,
          input.title,
        ])
      ).rows[0].count,
    ).toBe(1);
    const mismatch = await req(
      0,
      'POST',
      `/spaces/${board.space.id}/tasks`,
      { ...input, title: 'Different request' },
      { 'idempotency-key': key },
    );
    expect(mismatch.statusCode).toBe(409);
  });
  it('prevents Agent completion through both creation and updates', async () => {
    const done = board.statuses.find((status) => status.semantic === 'done')!;
    const headers = { authorization: `Bearer ${agentToken}`, 'if-match': String(task.version) };
    const created = await req(
      0,
      'POST',
      `/spaces/${board.space.id}/tasks`,
      { title: 'Agent completed without review', statusId: done.id },
      headers,
    );
    expect([403, 422]).toContain(created.statusCode);
    const updated = await req(0, 'PATCH', `/tasks/${task.id}`, { statusId: done.id }, headers);
    expect([403, 422]).toContain(updated.statusCode);
    expect([403, 422]).toContain(
      (await req(0, 'POST', `/tasks/${task.id}/accept`, {}, headers)).statusCode,
    );
  });
  it('accepts only one concurrent claim and records running status', async () => {
    const current = (await req(0, 'GET', `/tasks/${task.id}`)).json<{ data: Task }>().data;
    const responses = await Promise.all(
      [1, 2].map(() =>
        req(
          0,
          'POST',
          `/tasks/${task.id}/claim`,
          { threadId: 'audit-thread' },
          { 'if-match': String(current.version) },
        ),
      ),
    );
    expect(responses.filter((r) => r.statusCode === 201)).toHaveLength(1);
    expect(responses.filter((r) => r.statusCode === 409)).toHaveLength(1);
    const changed = (await req(0, 'GET', `/tasks/${task.id}`)).json<{ data: Task }>().data;
    expect(board.statuses.find((s) => s.id === changed.statusId)?.semantic).toBe('in_progress');
    expect(changed.version).toBe(current.version + 1);
  });
  it('replays owner transfer and status deletion after their mutable targets changed', async () => {
    const transferKey = randomUUID();
    const firstTransfer = await req(
      0,
      'POST',
      `/spaces/${board.space.id}/transfer-owner`,
      { userId: users[2].id },
      { 'idempotency-key': transferKey },
    );
    expect(firstTransfer.statusCode).toBe(200);
    const replayTransfer = await req(
      0,
      'POST',
      `/spaces/${board.space.id}/transfer-owner`,
      { userId: users[2].id },
      { 'idempotency-key': transferKey },
    );
    expect(replayTransfer.statusCode).toBe(200);
    expect(replayTransfer.json().data).toEqual(firstTransfer.json().data);
    const currentBoard = (await req(0, 'GET', `/spaces/${board.space.id}/board`)).json<{
      data: Board;
    }>().data;
    const todo = currentBoard.statuses.find((status) => status.semantic === 'todo')!;
    const temporary = await req(0, 'POST', `/spaces/${board.space.id}/statuses`, {
      name: 'temporary',
      semantic: 'todo',
      position: 99,
      color: '#64748b',
    });
    expect(temporary.statusCode).toBe(201);
    const deletionKey = randomUUID();
    const deleted = await req(
      0,
      'DELETE',
      `/statuses/${temporary.json().data.id}`,
      { targetStatusId: todo.id },
      { 'idempotency-key': deletionKey },
    );
    expect(deleted.statusCode).toBe(200);
    const replayDeleted = await req(
      0,
      'DELETE',
      `/statuses/${temporary.json().data.id}`,
      { targetStatusId: todo.id },
      { 'idempotency-key': deletionKey },
    );
    expect(replayDeleted.statusCode).toBe(200);
    expect(replayDeleted.json().data).toEqual(deleted.json().data);
  });
});
