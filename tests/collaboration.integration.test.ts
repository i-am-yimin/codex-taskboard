/* eslint-disable @typescript-eslint/no-explicit-any -- Inject responses represent validated API envelopes. */
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { hash } from '@node-rs/argon2';
import { createDatabase } from '../apps/server/src/db.ts';
import { migrate } from '../apps/server/src/migrate.ts';
import { migrateCollaboration } from '../apps/server/src/collaboration-migration.ts';
import { buildApp } from '../apps/server/src/app.ts';
const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;
suite('collaborative task domain', () => {
  let db: ReturnType<typeof createDatabase>;
  let app: ReturnType<typeof buildApp>;
  let cookie = '';
  let userId = '';
  let spaceId = '';
  let todo = '';
  let done = '';
  const password = 'synthetic-collaboration-password';
  const request = async (
    method: string,
    path: string,
    body?: unknown,
    version?: number,
    overrides: Record<string, string> = {},
  ) =>
    app.inject({
      method: method as any,
      url: `/api/v1${path}`,
      payload: body as any,
      headers: {
        cookie,
        'idempotency-key': randomUUID(),
        ...(version ? { 'if-match': String(version) } : {}),
        ...overrides,
      },
    });
  const create = async (title: string, extra = {}) => {
    const response = await request('POST', `/spaces/${spaceId}/tasks`, {
      title,
      statusId: todo,
      reviewerId: userId,
      ...extra,
    });
    expect(response.statusCode, response.body).toBe(201);
    return response.json().data;
  };
  const read = async (id: string) => (await request('GET', `/tasks/${id}`)).json().data;
  const complete = async (task: any) => {
    const claimed = await request('POST', `/tasks/${task.id}/claim`, {}, task.version);
    expect(claimed.statusCode, claimed.body).toBe(201);
    expect(claimed.json().data.run).toBeNull();
    expect(claimed.json().data.execution.phase).toBe('claimed');
    const submitted = await request(
      'POST',
      `/tasks/${task.id}/submit`,
      {
        summary: 'implemented',
        verification: 'isolated database regression',
        requirementsVersion: task.requirementsVersion,
      },
      claimed.json().data.task.version,
    );
    expect(submitted.statusCode, submitted.body).toBe(200);
    const accepted = await request(
      'POST',
      `/tasks/${task.id}/accept`,
      {},
      submitted.json().data.task.version,
    );
    expect(accepted.statusCode, accepted.body).toBe(200);
    return accepted.json().data;
  };
  beforeAll(async () => {
    if (!url || !new URL(url).pathname.endsWith('_test'))
      throw new Error('requires independent *_test database');
    db = createDatabase(url);
    await migrate(db);
    await migrate(db);
    app = buildApp({ db, sessionSecret: 'e'.repeat(64) });
    userId = randomUUID();
    const email = `collaboration-${userId}@example.test`;
    await db.query('INSERT INTO users(id,email,name,password_hash) VALUES($1,$2,$3,$4)', [
      userId,
      email,
      'Synthetic Domain',
      await hash(password),
    ]);
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password, deviceName: 'domain-test' },
    });
    const raw = login.headers['set-cookie'];
    cookie = Array.isArray(raw) ? raw[0] : raw!;
    const space = await request('POST', '/spaces', { name: 'Synthetic collaboration' });
    expect(space.statusCode, space.body).toBe(201);
    spaceId = space.json().data.id;
    const board = (await request('GET', `/spaces/${spaceId}/board`)).json().data;
    todo = board.statuses.find((s: any) => s.semantic === 'todo').id;
    done = board.statuses.find((s: any) => s.semantic === 'done').id;
  }, 30000);
  afterAll(async () => {
    await app?.close();
    await db?.end();
  });
  it('rejects direct completion and atomically claims once without inventing an OS run', async () => {
    const invalid = await request('POST', `/spaces/${spaceId}/tasks`, {
      title: 'bypass',
      statusId: done,
    });
    expect(invalid.statusCode).toBe(422);
    const task = await create('Claim concurrency');
    const patch = await request('PATCH', `/tasks/${task.id}`, { statusId: done }, task.version);
    expect(patch.statusCode).toBe(422);
    const replies = await Promise.all([
      request('POST', `/tasks/${task.id}/claim`, {}, task.version),
      request('POST', `/tasks/${task.id}/claim`, {}, task.version),
    ]);
    expect(replies.map((r) => r.statusCode).sort()).toEqual([201, 409]);
    const detail = (await request('GET', `/tasks/${task.id}/detail`)).json().data;
    expect(detail.claims.filter((c: any) => !c.releasedAt)).toHaveLength(1);
    expect(detail.runs).toEqual([]);
  });
  it('rejects non-HTTPS submission PR links without changing the claim or task version', async () => {
    const task = await create('HTTPS submission link');
    const claimed = await request('POST', `/tasks/${task.id}/claim`, {}, task.version);
    expect(claimed.statusCode, claimed.body).toBe(201);
    const version = claimed.json().data.task.version;
    for (const prUrl of [
      'http://example.test/pull/1',
      'javascript:alert(1)',
      'data:text/html,example',
      'file:///tmp/result.html',
    ]) {
      const rejected = await request(
        'POST',
        `/tasks/${task.id}/submit`,
        {
          summary: 'implemented',
          verification: 'isolated PostgreSQL regression',
          requirementsVersion: 1,
          prUrl,
        },
        version,
      );
      expect(rejected.statusCode, rejected.body).toBe(422);
      expect(rejected.json().error.code).toBe('VALIDATION_ERROR');
      expect((await read(task.id)).version).toBe(version);
      expect(
        (
          await db.query('SELECT released_at FROM task_claims WHERE id=$1', [
            claimed.json().data.claim.id,
          ])
        ).rows[0].released_at,
      ).toBeNull();
      expect(
        (
          await db.query('SELECT phase FROM executions WHERE id=$1', [
            claimed.json().data.execution.id,
          ])
        ).rows[0].phase,
      ).toBe('claimed');
    }
    const accepted = await request(
      'POST',
      `/tasks/${task.id}/submit`,
      {
        summary: 'implemented',
        verification: 'isolated PostgreSQL regression',
        requirementsVersion: 1,
        prUrl: 'https://example.test/pull/1',
      },
      version,
    );
    expect(accepted.statusCode, accepted.body).toBe(200);
    expect(accepted.json().data.execution.prUrl).toBe('https://example.test/pull/1');
    const noLink = await create('Null submission link');
    const secondClaim = await request('POST', `/tasks/${noLink.id}/claim`, {}, noLink.version);
    const nullable = await request(
      'POST',
      `/tasks/${noLink.id}/submit`,
      {
        summary: 'implemented without PR',
        verification: 'isolated PostgreSQL regression',
        requirementsVersion: 1,
        prUrl: null,
      },
      secondClaim.json().data.task.version,
    );
    expect(nullable.statusCode, nullable.body).toBe(200);
    expect(nullable.json().data.execution.prUrl).toBeNull();
  });
  it('keeps independent child acceptance and requires explicit parent integration acceptance', async () => {
    const parent = await create('Parent integration');
    const childResponse = await request(
      'POST',
      `/tasks/${parent.id}/children`,
      { title: 'Leaf', statusId: todo, reviewerId: userId },
      parent.version,
    );
    expect(childResponse.statusCode, childResponse.body).toBe(200);
    const child = childResponse.json().data;
    const blocked = await request(
      'POST',
      `/tasks/${parent.id}/submit`,
      { summary: 'premature', verification: 'none', requirementsVersion: 1 },
      (await read(parent.id)).version,
    );
    expect(blocked.json().error.code).toBe('REQUIRED_CHILDREN_NOT_DONE');
    await complete(child);
    const current = await read(parent.id);
    expect(current.statusId).toBe(todo);
    const submitted = await request(
      'POST',
      `/tasks/${parent.id}/submit`,
      {
        summary: 'integrated',
        verification: 'all child interfaces verified',
        limitations: 'synthetic database only',
        requirementsVersion: 1,
      },
      current.version,
    );
    expect(submitted.statusCode, submitted.body).toBe(200);
    expect(submitted.json().data.execution.agentKind).toBe('integration');
    expect(submitted.json().data.execution.claimId).toBeNull();
    const accepted = await request(
      'POST',
      `/tasks/${parent.id}/accept`,
      {},
      submitted.json().data.task.version,
    );
    expect(accepted.statusCode, accepted.body).toBe(200);
    const addition = await request(
      'POST',
      `/tasks/${parent.id}/children`,
      { title: 'late', statusId: todo },
      accepted.json().data.version,
    );
    expect(addition.statusCode).toBe(422);
  });
  it('rejects dependency cycles including children that depend on their parent and isolates spaces', async () => {
    const first = await create('First');
    const second = await create('Second');
    const edge = await request(
      'PUT',
      `/tasks/${first.id}/dependencies/${second.id}`,
      {},
      first.version,
    );
    expect(edge.statusCode, edge.body).toBe(200);
    const reverse = await request(
      'PUT',
      `/tasks/${second.id}/dependencies/${first.id}`,
      {},
      second.version,
    );
    expect(reverse.json().error.code).toBe('DEPENDENCY_CYCLE');
    const claim = await request(
      'POST',
      `/tasks/${first.id}/claim`,
      {},
      (await read(first.id)).version,
    );
    expect(claim.json().error.code).toBe('DEPENDENCIES_NOT_DONE');
    const parent = await create('Parent graph');
    const child = await create('Child graph', { parentTaskId: parent.id });
    const deadlock = await request(
      'PUT',
      `/tasks/${child.id}/dependencies/${parent.id}`,
      {},
      child.version,
    );
    expect(deadlock.json().error.code).toBe('DEPENDENCY_CYCLE');
    const otherSpace = (await request('POST', '/spaces', { name: 'Other synthetic' })).json().data;
    const otherBoard = (await request('GET', `/spaces/${otherSpace.id}/board`)).json().data;
    const foreign = (
      await request('POST', `/spaces/${otherSpace.id}/tasks`, {
        title: 'Foreign',
        statusId: otherBoard.statuses.find((s: any) => s.semantic === 'todo').id,
      })
    ).json().data;
    const cross = await request(
      'PUT',
      `/tasks/${second.id}/dependencies/${foreign.id}`,
      {},
      second.version,
    );
    expect(cross.json().error.code).toBe('CROSS_SPACE_RELATION');
  });
  it('preserves human proposal provenance, confirms adjusted content and rejects obsolete submission', async () => {
    const task = await create('Requirements');
    const claim = await request('POST', `/tasks/${task.id}/claim`, {}, task.version);
    expect(claim.statusCode).toBe(201);
    const proposed = await request(
      'POST',
      `/tasks/${task.id}/proposals`,
      {
        kind: 'requirements',
        payload: {
          description: 'v2',
          acceptanceCriteria: 'new criteria',
          impact: 'leaf work must be reviewed',
        },
      },
      claim.json().data.task.version,
    );
    expect(proposed.statusCode, proposed.body).toBe(200);
    expect(proposed.json().data.source).toBe('human');
    const confirmed = await request(
      'POST',
      `/tasks/${task.id}/proposals/${proposed.json().data.id}/confirm`,
      {
        payload: {
          description: 'v2 adjusted',
          acceptanceCriteria: 'confirmed criteria',
          impact: 'confirmed impact',
        },
      },
      (await read(task.id)).version,
    );
    expect(confirmed.statusCode, confirmed.body).toBe(200);
    expect(confirmed.json().data.confirmedPayload.description).toBe('v2 adjusted');
    const current = await read(task.id);
    expect(current.requirementsVersion).toBe(2);
    const stale = await request(
      'POST',
      `/tasks/${task.id}/submit`,
      { summary: 'old result', verification: 'old checks', requirementsVersion: 1 },
      current.version,
    );
    expect(stale.json().error.code).toBe('REQUIREMENTS_CHANGED');
    const missing = await request(
      'POST',
      `/tasks/${task.id}/submit`,
      { summary: 'result', verification: 'checks' },
      current.version,
    );
    expect(missing.statusCode).toBe(422);
  });
  it('tracks blockers and material changes without granting viewer task permissions', async () => {
    const task = await create('Evidence and blockers');
    const noReason = await request('PATCH', `/tasks/${task.id}`, { blocked: true }, task.version);
    expect(noReason.json().error.code).toBe('BLOCK_REASON_REQUIRED');
    const blocked = await request(
      'PATCH',
      `/tasks/${task.id}`,
      { blocked: true, blockedReason: 'waiting on fixture' },
      task.version,
    );
    expect(blocked.statusCode, blocked.body).toBe(200);
    const intervals = await db.query(
      "SELECT * FROM task_state_intervals WHERE task_id=$1 AND kind='blocked'",
      [task.id],
    );
    expect(intervals.rowCount).toBe(1);
    expect(intervals.rows[0].precision).toBe('exact');
    const artifact = await request(
      'POST',
      `/tasks/${task.id}/artifacts`,
      {
        kind: 'test',
        title: 'Database regression',
        text: 'passed',
        verificationScope: 'source+real PG',
        limitations: 'not desktop',
      },
      blocked.json().data.version,
    );
    expect(artifact.statusCode, artifact.body).toBe(200);
    const deleted = await request(
      'DELETE',
      `/tasks/${task.id}/artifacts/${artifact.json().data.id}`,
      {},
      (await read(task.id)).version,
    );
    expect(deleted.statusCode, deleted.body).toBe(200);
    expect(deleted.json().data.deletedAt).not.toBeNull();
    const viewerId = randomUUID();
    const email = `viewer-${viewerId}@example.test`;
    await db.query('INSERT INTO users(id,email,name,password_hash) VALUES($1,$2,$3,$4)', [
      viewerId,
      email,
      'Viewer',
      await hash(password),
    ]);
    await db.query("INSERT INTO space_members(space_id,user_id,role) VALUES($1,$2,'viewer')", [
      spaceId,
      viewerId,
    ]);
    const invalidReviewer = await request(
      'PATCH',
      `/tasks/${task.id}`,
      { reviewerId: viewerId },
      (await read(task.id)).version,
    );
    expect(invalidReviewer.json().error.code).toBe('INVALID_REVIEWER');
    const viewerLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password },
    });
    const raw = viewerLogin.headers['set-cookie'];
    const viewerCookie = Array.isArray(raw) ? raw[0] : raw!;
    await db.query(
      'INSERT INTO task_participants(task_id,user_id,responsibility) VALUES($1,$2,$3)',
      [task.id, viewerId, 'Observe'],
    );
    const edit = await request(
      'PUT',
      `/tasks/${task.id}/participants/${viewerId}`,
      { responsibility: 'Observe', progress: 100 },
      (await read(task.id)).version,
      { cookie: viewerCookie },
    );
    expect(edit.statusCode).toBe(403);
  });
  it('counts only active blocker and review intervals across creation, terminal states and archives', async () => {
    const open = async (id: string, kind: string) =>
      Number(
        (
          await db.query(
            'SELECT count(*)::int n FROM task_state_intervals WHERE task_id=$1 AND kind=$2 AND ended_at IS NULL',
            [id, kind],
          )
        ).rows[0].n,
      );
    let task = await create('Blocked lifecycle', {
      blocked: true,
      blockedReason: 'external fixture',
    });
    expect(await open(task.id, 'blocked')).toBe(1);
    const cancelled = await request(
      'POST',
      `/tasks/${task.id}/cancel`,
      { reason: 'pause request' },
      task.version,
    );
    expect(cancelled.statusCode, cancelled.body).toBe(200);
    task = cancelled.json().data;
    expect(task.blocked).toBe(true);
    expect(await open(task.id, 'blocked')).toBe(0);
    expect(
      (
        await request(
          'POST',
          `/tasks/${task.id}/progress`,
          { progress: 50, summary: 'late', blocked: true, blockedReason: 'late' },
          task.version,
        )
      ).json().error.code,
    ).toBe('TASK_NOT_ACTIVE');
    expect(
      (
        await request(
          'PATCH',
          `/tasks/${task.id}`,
          { blocked: true, blockedReason: 'late' },
          task.version,
        )
      ).json().error.code,
    ).toBe('TASK_NOT_ACTIVE');
    const reopened = await request(
      'POST',
      `/tasks/${task.id}/reopen`,
      { reason: 'resume requirement' },
      task.version,
    );
    expect(reopened.statusCode, reopened.body).toBe(200);
    task = reopened.json().data;
    expect(await open(task.id, 'blocked')).toBe(1);
    const archived = await request('PATCH', `/tasks/${task.id}`, { archived: true }, task.version);
    expect(archived.statusCode, archived.body).toBe(200);
    task = archived.json().data;
    expect(await open(task.id, 'blocked')).toBe(0);
    expect(
      (
        await request(
          'POST',
          `/tasks/${task.id}/progress`,
          { progress: 50, summary: 'archived' },
          task.version,
        )
      ).statusCode,
    ).toBe(409);
    const restored = await request('PATCH', `/tasks/${task.id}`, { archived: false }, task.version);
    expect(restored.statusCode, restored.body).toBe(200);
    task = restored.json().data;
    expect(await open(task.id, 'blocked')).toBe(1);
    const spaceArchive = await request('POST', `/spaces/${spaceId}/archive`, {});
    expect(spaceArchive.statusCode).toBe(200);
    expect(await open(task.id, 'blocked')).toBe(0);
    const spaceRestore = await request('POST', `/spaces/${spaceId}/restore`, {});
    expect(spaceRestore.statusCode, spaceRestore.body).toBe(200);
    expect(await open(task.id, 'blocked')).toBe(1);
    const clear = await request(
      'PATCH',
      `/tasks/${task.id}`,
      { blocked: false, blockedReason: '' },
      task.version,
    );
    expect(clear.statusCode, clear.body).toBe(200);
    expect(await open(task.id, 'blocked')).toBe(0);
    task = await create('Review lifecycle');
    const claim = await request('POST', `/tasks/${task.id}/claim`, {}, task.version);
    expect(claim.statusCode, claim.body).toBe(201);
    const submit = await request(
      'POST',
      `/tasks/${task.id}/submit`,
      { summary: 'implementation', verification: 'source facts', requirementsVersion: 1 },
      claim.json().data.task.version,
    );
    expect(submit.statusCode, submit.body).toBe(200);
    task = submit.json().data.task;
    expect(await open(task.id, 'review_wait')).toBe(1);
    const reviewArchived = await request(
      'PATCH',
      `/tasks/${task.id}`,
      { archived: true },
      task.version,
    );
    expect(reviewArchived.statusCode, reviewArchived.body).toBe(200);
    expect(await open(task.id, 'review_wait')).toBe(0);
    const reviewRestored = await request(
      'PATCH',
      `/tasks/${task.id}`,
      { archived: false },
      reviewArchived.json().data.version,
    );
    expect(reviewRestored.statusCode, reviewRestored.body).toBe(200);
    task = reviewRestored.json().data;
    expect(await open(task.id, 'review_wait')).toBe(1);
    const blockedReview = await request(
      'PATCH',
      `/tasks/${task.id}`,
      { blocked: true, blockedReason: 'review concern' },
      task.version,
    );
    expect(blockedReview.statusCode, blockedReview.body).toBe(200);
    task = blockedReview.json().data;
    expect(await open(task.id, 'blocked')).toBe(1);
    const accepted = await request('POST', `/tasks/${task.id}/accept`, {}, task.version);
    expect(accepted.statusCode, accepted.body).toBe(200);
    task = accepted.json().data;
    expect(await open(task.id, 'blocked')).toBe(0);
    expect(await open(task.id, 'review_wait')).toBe(0);
    const doneReopened = await request(
      'POST',
      `/tasks/${task.id}/reopen`,
      { reason: 'new review concerns' },
      task.version,
    );
    expect(doneReopened.statusCode, doneReopened.body).toBe(200);
    expect(await open(task.id, 'blocked')).toBe(1);
    expect(await open(task.id, 'review_wait')).toBe(0);
  });
});

suite('collaboration upgrade from legacy records', () => {
  it('backfills running claims without fabricating runs and is repeatable', async () => {
    if (!url || !new URL(url).pathname.endsWith('_test'))
      throw new Error('requires independent *_test database');
    const db = createDatabase(url);
    const client = await db.connect();
    const schema = `legacy_${randomUUID().replaceAll('-', '')}`;
    try {
      await client.query('BEGIN');
      await client.query(`CREATE SCHEMA "${schema}"`);
      await client.query(`SET LOCAL search_path TO "${schema}"`);
      await client.query(`CREATE TABLE schema_migrations(id text PRIMARY KEY);
CREATE TABLE users(id uuid PRIMARY KEY);
CREATE TABLE devices(id uuid PRIMARY KEY);
CREATE TABLE statuses(id uuid PRIMARY KEY,semantic text NOT NULL);
CREATE TABLE tasks(id uuid PRIMARY KEY,assignee_id uuid REFERENCES users(id),blocked boolean NOT NULL,updated_at timestamptz NOT NULL,status_id uuid REFERENCES statuses(id));
CREATE TABLE executions(id uuid PRIMARY KEY,task_id uuid REFERENCES tasks(id),actor_id uuid REFERENCES users(id),device_id uuid REFERENCES devices(id),phase text CONSTRAINT executions_phase_check CHECK(phase IN ('running','submitted','released')),created_at timestamptz NOT NULL);
CREATE UNIQUE INDEX one_running_execution_per_task ON executions(task_id) WHERE phase='running';
CREATE TABLE comments(id uuid PRIMARY KEY,task_id uuid REFERENCES tasks(id),body text NOT NULL);`);
      const user = randomUUID(),
        device = randomUUID(),
        task = randomUUID(),
        status = randomUUID(),
        execution = randomUUID();
      await client.query('INSERT INTO users VALUES($1)', [user]);
      await client.query('INSERT INTO devices VALUES($1)', [device]);
      await client.query("INSERT INTO statuses VALUES($1,'in_progress')", [status]);
      await client.query('INSERT INTO tasks VALUES($1,$2,true,now(),$3)', [task, user, status]);
      await client.query("INSERT INTO executions VALUES($1,$2,$3,$4,'running',now())", [
        execution,
        task,
        user,
        device,
      ]);
      await client.query('INSERT INTO comments VALUES($1,$2,$3)', [
        randomUUID(),
        task,
        'legacy evidence must survive',
      ]);
      await migrateCollaboration(client);
      await migrateCollaboration(client);
      expect((await client.query('SELECT count(*)::int n FROM task_claims')).rows[0].n).toBe(1);
      expect((await client.query('SELECT count(*)::int n FROM task_runs')).rows[0].n).toBe(0);
      expect((await client.query('SELECT phase,claim_id FROM executions')).rows[0]).toMatchObject({
        phase: 'claimed',
        claim_id: execution,
      });
      expect((await client.query('SELECT reviewer_id FROM tasks')).rows[0].reviewer_id).toBeNull();
      expect(
        (await client.query('SELECT precision FROM task_state_intervals')).rows[0].precision,
      ).toBe('legacy_unknown');
      expect((await client.query('SELECT body FROM comments')).rows[0].body).toBe(
        'legacy evidence must survive',
      );
    } finally {
      await client.query('ROLLBACK');
      client.release();
      await db.end();
    }
  });
});
