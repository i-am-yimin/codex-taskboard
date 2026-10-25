import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { hash } from '@node-rs/argon2';
import type { Task, TaskClaim, TaskRun } from '../packages/core/src/index.ts';
import { createDatabase } from '../apps/server/src/db.ts';
import { migrate } from '../apps/server/src/migrate.ts';
import { buildApp } from '../apps/server/src/app.ts';
import { createCompanion } from '../apps/companion/src/main.ts';
import {
  LocalAgentRunner,
  configureRunner,
  type SpawnProcess,
} from '../apps/companion/src/runners.ts';
import { CompanionClient } from '../packages/cli/src/main.ts';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;
suite('Agent run API in independent PostgreSQL', () => {
  let db: ReturnType<typeof createDatabase>;
  let app: ReturnType<typeof buildApp>;
  let cookie = '';
  let otherCookie = '';
  let agentToken = '';
  let userId = '';
  let spaceId = '';
  let todo = '';
  let email = '';
  const password = 'synthetic-runtime-password';
  const req = (
    method: 'GET' | 'POST' | 'PATCH',
    path: string,
    body?: unknown,
    version?: number,
    headers: Record<string, string> = {},
  ) =>
    app.inject({
      method,
      url: `/api/v1${path}`,
      payload: body === undefined ? undefined : JSON.stringify(body),
      headers: {
        cookie,
        'content-type': 'application/json',
        'idempotency-key': randomUUID(),
        ...(version ? { 'if-match': String(version) } : {}),
        ...headers,
      },
    });
  const setup = async () => {
    const created = await req('POST', `/spaces/${spaceId}/tasks`, {
      title: 'Synthetic runtime',
      statusId: todo,
      reviewerId: userId,
    });
    expect(created.statusCode, created.body).toBe(201);
    const task = created.json<{ data: Task }>().data;
    const claimed = await req(
      'POST',
      `/tasks/${task.id}/claim`,
      { agentKind: 'codex-cli' },
      task.version,
    );
    expect(claimed.statusCode, claimed.body).toBe(201);
    return claimed.json<{ data: { task: Task; claim: TaskClaim } }>().data;
  };
  beforeAll(async () => {
    if (!url || !new URL(url).pathname.endsWith('_test'))
      throw new Error('independent *_test database required');
    db = createDatabase(url);
    await migrate(db);
    await migrate(db);
    app = buildApp({ db, sessionSecret: 'f'.repeat(64) });
    userId = randomUUID();
    email = `runtime-${userId}@example.test`;
    await db.query('INSERT INTO users(id,email,name,password_hash) VALUES($1,$2,$3,$4)', [
      userId,
      email,
      'Synthetic Runner',
      await hash(password),
    ]);
    const login = async (tokenKind = 'browser') =>
      app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email, password, deviceName: 'runtime-only-test', tokenKind },
      });
    const logged = await login();
    const raw = logged.headers['set-cookie'];
    cookie = Array.isArray(raw) ? raw[0] : String(raw);
    const other = await login();
    const second = other.headers['set-cookie'];
    otherCookie = Array.isArray(second) ? second[0] : String(second);
    const agent = await login('agent');
    agentToken = agent.json().data.deviceToken;
    const created = await req('POST', '/spaces', { name: 'Synthetic Runtime Space' });
    spaceId = created.json().data.id;
    const board = (await req('GET', `/spaces/${spaceId}/board`)).json().data as {
      statuses: { id: string; semantic: string }[];
    };
    todo = board.statuses.find((value) => value.semantic === 'todo')!.id;
  });
  afterAll(async () => {
    await app?.close();
    await db?.end();
  });
  it('reconciles cancelled subprocess facts through a real ephemeral companion after task edits conflict', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'taskboard-companion-run-test-'));
    const repository = 'https://example.test/synthetic/companion-run';
    await promisify(execFile)('git', ['init', directory]);
    await promisify(execFile)('git', ['-C', directory, 'remote', 'add', 'origin', repository]);
    await configureRunner(directory, 'codex-cli', process.execPath, join(directory, 'home'));
    const fixture = join(directory, 'fixture.cjs');
    await writeFile(
      fixture,
      'console.log(JSON.stringify({type:"thread.started",thread_id:"synthetic-http-session"}));setInterval(()=>{},1000);',
    );
    const spawnProcess: SpawnProcess = (_executable, args, options) =>
      args.includes('--version')
        ? spawn(process.execPath, ['-e', 'console.log("codex-cli 0.164.0")'], options)
        : args.includes('status')
          ? spawn(process.execPath, ['-e', 'process.exit(0)'], options)
          : spawn(process.execPath, [fixture], options);
    let supervisor: LocalAgentRunner | undefined;
    const address = app.server.listening
      ? `http://127.0.0.1:${(app.server.address() as { port: number }).port}`
      : await app.listen({ host: '127.0.0.1', port: 0 });
    const companion = await createCompanion({
      port: 0,
      dataDirectory: directory,
      upstream: address,
      createRunner: (path, mapping, report, authorize) => {
        supervisor = new LocalAgentRunner(path, mapping, report, spawnProcess, authorize);
        return supervisor;
      },
    });
    const client = new CompanionClient({
      endpoint: `http://127.0.0.1:${companion.port}`,
      key: companion.clientKey,
    });
    try {
      await client.request('/v1/login', 'POST', {
        email,
        password,
        deviceName: 'isolated-runner-e2e',
      });
      await client.request('/v1/mappings', 'POST', { repository, path: directory });
      const task = (
        await req('POST', `/spaces/${spaceId}/tasks`, {
          title: 'Synthetic companion lifecycle',
          statusId: todo,
          repository,
        })
      ).json().data as Task;
      const claimed = await client.mutation<{ task: Task; claim: TaskClaim }>(
        `/tasks/${task.id}/claim`,
        'POST',
        { agentKind: 'codex-cli' },
        task.version,
      );
      const started = await client.request<{ run: TaskRun }>('/v1/runners/start', 'POST', {
        taskId: task.id,
        claimId: claimed.claim.id,
        runner: 'codex-cli',
        permissionMode: 'read-only',
        version: claimed.task.version,
        idempotencyKey: randomUUID(),
      });
      const detail = await client.get<{ task: Task }>(`/tasks/${task.id}/detail`);
      expect(
        (
          await req(
            'PATCH',
            `/tasks/${task.id}`,
            { title: 'Edited while the local process runs' },
            detail.task.version,
          )
        ).statusCode,
      ).toBe(200);
      await supervisor!.cancel(started.run.id);
      for (let attempt = 0; attempt < 150; attempt++) {
        if ((await supervisor!.status(started.run.id)).phase === 'cancelled') break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      expect((await supervisor!.status(started.run.id)).phase).toBe('cancelled');
      const unsynced = await client.request<{ synchronized: boolean }>(
        `/v1/runners/${task.id}/${started.run.id}`,
      );
      expect(unsynced.synchronized).toBe(false);
      const synced = await client.request<{ synchronized: boolean }>(
        `/v1/runners/${task.id}/${started.run.id}/sync`,
        'POST',
        {},
      );
      expect(synced.synchronized).toBe(true);
      const runs = await client.get<TaskRun[]>(`/tasks/${task.id}/runs`);
      expect(runs[0].phase).toBe('cancelled');
      expect(runs[0].externalSessionId).toBe('synthetic-http-session');
    } finally {
      await companion.stop();
      await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    }
  }, 90000);
  it('has one start for parallel same-key retries and no fake execution submit', async () => {
    const { task, claim } = await setup();
    const key = randomUUID();
    const body = { claimId: claim.id, runner: 'codex-cli' };
    const responses = await Promise.all([
      req('POST', `/tasks/${task.id}/runs`, body, task.version, { 'idempotency-key': key }),
      req('POST', `/tasks/${task.id}/runs`, body, task.version, { 'idempotency-key': key }),
    ]);
    expect(responses.map((value) => value.statusCode)).toEqual([200, 200]);
    expect(responses[0].json().data.run.id).toBe(responses[1].json().data.run.id);
    expect((await db.query('SELECT * FROM task_runs WHERE task_id=$1', [task.id])).rowCount).toBe(
      1,
    );
    const detail = (await req('GET', `/tasks/${task.id}/detail`)).json().data;
    expect(detail.executions[0].phase).toBe('claimed');
    expect(
      (
        await req(
          'POST',
          `/tasks/${task.id}/submit`,
          { summary: 'not complete', verification: 'none', requirementsVersion: 1 },
          detail.task.version,
        )
      ).json().error.code,
    ).toBe('RUN_STATE_UNCONFIRMED');
  });
  it('rejects another device, arbitrary cwd/PID and a second active run', async () => {
    const { task, claim } = await setup();
    const path = `/tasks/${task.id}/runs`;
    expect(
      (
        await req('POST', path, { claimId: claim.id, runner: 'codex-cli' }, task.version, {
          cookie: otherCookie,
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await req(
          'POST',
          path,
          { claimId: claim.id, runner: 'codex-cli', cwd: 'C:\\private', pid: 1 },
          task.version,
        )
      ).statusCode,
    ).toBe(422);
    const first = await req('POST', path, { claimId: claim.id, runner: 'codex-cli' }, task.version);
    expect(first.statusCode, first.body).toBe(200);
    expect(
      (
        await req(
          'POST',
          path,
          { claimId: claim.id, runner: 'codex-cli' },
          first.json().data.task.version,
        )
      ).json().error.code,
    ).toBe('RUN_STATE_UNCONFIRMED');
  });
  it('revalidates revoked membership and viewer role even for the original claim holder', async () => {
    const editorId = randomUUID();
    const editorEmail = `runtime-editor-${editorId}@example.test`;
    await db.query('INSERT INTO users(id,email,name,password_hash) VALUES($1,$2,$3,$4)', [
      editorId,
      editorEmail,
      'Synthetic Editor',
      await hash(password),
    ]);
    await db.query("INSERT INTO space_members(space_id,user_id,role) VALUES($1,$2,'editor')", [
      spaceId,
      editorId,
    ]);
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: editorEmail, password, deviceName: 'revoked-runner' },
    });
    const raw = login.headers['set-cookie'];
    const editorCookie = Array.isArray(raw) ? raw[0] : String(raw);
    const task = (
      await req('POST', `/spaces/${spaceId}/tasks`, { title: 'Revoked permission', statusId: todo })
    ).json().data as Task;
    const claimed = await req('POST', `/tasks/${task.id}/claim`, {}, task.version, {
      cookie: editorCookie,
    });
    expect(claimed.statusCode).toBe(201);
    const body = { claimId: claimed.json().data.claim.id, runner: 'codex-cli' };
    await db.query("UPDATE space_members SET role='viewer' WHERE space_id=$1 AND user_id=$2", [
      spaceId,
      editorId,
    ]);
    expect(
      (
        await req('POST', `/tasks/${task.id}/runs`, body, claimed.json().data.task.version, {
          cookie: editorCookie,
        })
      ).statusCode,
    ).toBe(403);
    await db.query('DELETE FROM space_members WHERE space_id=$1 AND user_id=$2', [
      spaceId,
      editorId,
    ]);
    expect(
      (await req('GET', `/tasks/${task.id}/runs`, undefined, undefined, { cookie: editorCookie }))
        .statusCode,
    ).toBe(404);
  });
  it('keeps unknown immutable and requires explicit audited human resolution before release', async () => {
    const { task, claim } = await setup();
    const started = (
      await req(
        'POST',
        `/tasks/${task.id}/runs`,
        { claimId: claim.id, runner: 'claude-code' },
        task.version,
      )
    ).json().data as { task: Task; run: TaskRun };
    const path = `/tasks/${task.id}/runs/${started.run.id}`;
    const unknown = await req(
      'POST',
      `${path}/events`,
      { phase: 'unknown', failureReason: 'supervisor restarted' },
      started.task.version,
    );
    expect(unknown.statusCode, unknown.body).toBe(200);
    const current = unknown.json().data.task as Task;
    expect(
      (await req('POST', `${path}/events`, { phase: 'succeeded' }, current.version)).statusCode,
    ).toBe(409);
    expect(
      (await req('POST', `/tasks/${task.id}/release`, { reason: 'unsafe' }, current.version)).json()
        .error.code,
    ).toBe('RUN_STATE_UNCONFIRMED');
    expect(
      (
        await req(
          'POST',
          `${path}/resolve`,
          { reason: 'checked', confirmedProcessStopped: true },
          current.version,
          { cookie: '', authorization: `Bearer ${agentToken}` },
        )
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await req(
          'POST',
          `${path}/resolve`,
          { reason: 'checked', confirmedProcessStopped: false },
          current.version,
        )
      ).statusCode,
    ).toBe(422);
    const resolved = await req(
      'POST',
      `${path}/resolve`,
      { reason: 'I checked the original isolated process is gone', confirmedProcessStopped: true },
      current.version,
    );
    expect(resolved.statusCode, resolved.body).toBe(200);
    expect(resolved.json().data.run.phase).toBe('unknown');
    expect(resolved.json().data.run.resolvedBy).toBe(userId);
    expect(
      (
        await req(
          'POST',
          `/tasks/${task.id}/release`,
          { reason: 'handoff' },
          resolved.json().data.task.version,
        )
      ).statusCode,
    ).toBe(200);
  });
  it('permits strict normal lifecycle without changing task to review or done', async () => {
    const { task, claim } = await setup();
    const started = (
      await req(
        'POST',
        `/tasks/${task.id}/runs`,
        { claimId: claim.id, runner: 'codex-cli' },
        task.version,
      )
    ).json().data as { task: Task; run: TaskRun };
    const path = `/tasks/${task.id}/runs/${started.run.id}/events`;
    expect((await req('POST', path, { phase: 'succeeded' }, started.task.version)).statusCode).toBe(
      409,
    );
    const running = await req(
      'POST',
      path,
      { phase: 'running', externalSessionId: 'synthetic-session' },
      started.task.version,
    );
    expect(running.statusCode, running.body).toBe(200);
    const complete = await req(
      'POST',
      path,
      { phase: 'succeeded' },
      running.json().data.task.version,
    );
    expect(complete.statusCode, complete.body).toBe(200);
    expect(complete.json().data.task.statusId).toBe(started.task.statusId);
    expect(
      (await req('POST', path, { phase: 'running' }, complete.json().data.task.version)).statusCode,
    ).toBe(409);
  });
});
