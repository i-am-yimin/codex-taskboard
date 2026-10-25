/* eslint-disable @typescript-eslint/no-explicit-any -- Acceptance inspects HTTP JSON envelopes. */
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { hash } from '@node-rs/argon2';
import pg from 'pg';
import { createDatabase } from '../apps/server/src/db';
import { migrate } from '../apps/server/src/migrate';
import { buildApp } from '../apps/server/src/app';

// Independent acceptance: actual production page, HTTP, accounts and PostgreSQL. No route mocks.
const parent = new URL(process.env.TEST_DATABASE_URL ?? '');
if (!parent.pathname.endsWith('_test')) throw new Error('Requires independent *_test database');
const evidence = resolve('.artifacts/collaborative-workflows/acceptance');
await mkdir(evidence, { recursive: true });
const control = new pg.Client({ connectionString: parent.toString() });
await control.connect();
const name = `collaboration_acceptance_${randomUUID().replaceAll('-', '')}_test`;
await control.query(`CREATE DATABASE "${name}"`);
const isolated = new URL(parent);
isolated.pathname = `/${name}`;
const db = createDatabase(isolated.toString());
process.env.WEB_ROOT = resolve(evidence, 'web');
const app = buildApp({ db, sessionSecret: randomBytes(32).toString('hex') });
let browser: Browser | undefined;
let origin = '';
let space = '';
const observations: string[] = [];
type Actor = { id: string; context: BrowserContext; page: Page; token: string };
const actors: Actor[] = [];
async function call(
  actor: Actor,
  method: string,
  path: string,
  data?: unknown,
  version?: number,
  agent = false,
) {
  const response = await actor.context.request.fetch(`${origin}/api/v1${path}`, {
    method,
    data,
    headers: {
      'idempotency-key': randomUUID(),
      ...(version ? { 'if-match': String(version) } : {}),
      ...(agent ? { authorization: `Bearer ${actor.token}` } : {}),
    },
  });
  return { status: response.status(), body: await response.json() };
}
async function ok(actor: Actor, method: string, path: string, data?: unknown, version?: number) {
  const result = await call(actor, method, path, data, version);
  expect(result.status, JSON.stringify(result.body)).toBeLessThan(300);
  return result.body.data;
}
async function task(id: string) {
  return ok(actors[0], 'GET', `/tasks/${id}`);
}
async function open(actor: Actor, id: string) {
  await actor.page.goto(`${origin}/?space=${space}&task=${id}`);
  await expect(actor.page.getByRole('heading', { name: '状态操作', exact: true })).toBeVisible();
}
async function submit(actor: Actor, id: string, integration = false) {
  await open(actor, id);
  await actor.page
    .getByRole('button', { name: integration ? '提交集成验收' : '提交结果至待验收', exact: true })
    .click();
  const modal = actor.page.getByRole('dialog', { name: '提交验收结果', exact: true });
  await modal
    .getByLabel('完成说明', { exact: true })
    .fill(integration ? 'Independent parent integration' : 'Independent leaf report');
  await modal
    .getByLabel('验证记录', { exact: true })
    .fill('Actual HTTP / PostgreSQL / production-browser acceptance');
  await modal.getByLabel('工作分支', { exact: true }).fill('codex/collaborative-agent-workflows');
  await modal
    .getByLabel('提交 SHA', { exact: true })
    .fill('dde5d2eabf77adf1a4347525d85046c1f44b0a4b');
  await modal
    .getByLabel('已知限制', { exact: true })
    .fill(
      'Synthetic report; no paid model, public PR or installed package was executed. SHA identifies baseline, not uncommitted changes.',
    );
  await modal
    .getByLabel('交接摘要', { exact: true })
    .fill('Reviewer independently verifies each leaf; owner integrates afterwards.');
  await modal.getByRole('button', { name: '提交验收', exact: true }).click();
  await expect(modal).not.toBeVisible();
  observations.push(`UI submitted ${integration ? 'parent integration' : 'leaf'} ${id}`);
}
async function review(actor: Actor, id: string, accept: boolean) {
  await open(actor, id);
  const title = accept ? '验收并完成' : '退回修改';
  await actor.page.getByRole('button', { name: title, exact: true }).click();
  const modal = actor.page.getByRole('dialog', { name: title, exact: true });
  await modal
    .locator('textarea')
    .fill(
      accept
        ? 'Independent human reviewed recorded verification and limitations'
        : 'Leaf A needs a second verification record',
    );
  await modal.getByRole('button', { name: '确认操作', exact: true }).click();
  await expect(modal).not.toBeVisible();
  observations.push(`UI human ${accept ? 'accepted' : 'returned'} ${id}`);
}
try {
  await migrate(db);
  origin = await app.listen({ host: '127.0.0.1', port: 0 });
  browser = await chromium.launch({
    headless: true,
    channel: process.env.CI ? undefined : 'chrome',
  });
  for (const label of [
    'Owner',
    'Codex Implementer',
    'Claude Implementer',
    'Human Reviewer',
    'Viewer',
    'Outsider',
  ]) {
    const id = randomUUID();
    const email = `${id}@example.test`;
    const password = randomBytes(20).toString('hex');
    await db.query('INSERT INTO users(id,email,name,password_hash) VALUES($1,$2,$3,$4)', [
      id,
      email,
      label,
      await hash(password),
    ]);
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: 'reduce',
    });
    const login = await context.request.post(`${origin}/api/v1/auth/login`, {
      data: { email, password, deviceName: `acceptance-${label}` },
    });
    expect(login.status()).toBe(200);
    const agentLogin = await context.request.post(`${origin}/api/v1/auth/login`, {
      data: { email, password, deviceName: `agent-${label}`, tokenKind: 'agent' },
    });
    expect(agentLogin.status()).toBe(200);
    const tokenData = (await agentLogin.json()).data;
    actors.push({
      id,
      context,
      page: await context.newPage(),
      token: tokenData.token ?? tokenData.deviceToken,
    });
  }
  const [owner, a, b, reviewer, viewer, outsider] = actors;
  space = (await ok(owner, 'POST', '/spaces', { name: 'Independent collaboration acceptance' })).id;
  for (const person of [a, b, reviewer, viewer])
    await db.query('INSERT INTO space_members(space_id,user_id,role) VALUES($1,$2,$3)', [
      space,
      person.id,
      person === viewer ? 'viewer' : 'editor',
    ]);
  const board = await ok(owner, 'GET', `/spaces/${space}/board`);
  const todo = board.statuses.find((s: any) => s.semantic === 'todo').id;
  const done = board.statuses.find((s: any) => s.semantic === 'done').id;
  const parentTask = await ok(owner, 'POST', `/spaces/${space}/tasks`, {
    title: 'Independent parent integration',
    statusId: todo,
    assigneeId: owner.id,
    reviewerId: reviewer.id,
  });
  const leaves: any[] = [];
  for (const [person, title] of [
    [a, 'Independent Codex leaf'],
    [b, 'Independent Claude leaf'],
  ] as const) {
    const current = await task(parentTask.id);
    leaves.push(
      await ok(
        owner,
        'POST',
        `/tasks/${parentTask.id}/children`,
        { title, statusId: todo, assigneeId: person.id, reviewerId: reviewer.id },
        current.version,
      ),
    );
  }
  const [leafA, leafB] = leaves;
  const early = await call(
    owner,
    'POST',
    `/tasks/${parentTask.id}/submit`,
    { summary: 'Premature', verification: 'none', requirementsVersion: 1 },
    (await task(parentTask.id)).version,
  );
  expect(early.body.error.code).toBe('REQUIRED_CHILDREN_NOT_DONE');
  for (const [person, leaf, agentKind] of [
    [a, leafA, 'codex-cli'],
    [b, leafB, 'claude-code'],
  ] as const) {
    const claimed = await call(
      person,
      'POST',
      `/tasks/${leaf.id}/claim`,
      { agentKind },
      (await task(leaf.id)).version,
      true,
    );
    expect(claimed.status, JSON.stringify(claimed.body)).toBe(201);
    expect(claimed.body.data.run).toBeNull();
    const detail = await ok(person, 'GET', `/tasks/${leaf.id}/detail`);
    expect(detail.claims[0].actorId).toBe(person.id);
    expect(detail.runs).toHaveLength(0);
    observations.push(`Independent ${agentKind} account/device claimed; no fabricated process`);
  }
  await submit(a, leafA.id);
  await submit(b, leafB.id);
  const agentAccept = await call(
    reviewer,
    'POST',
    `/tasks/${leafB.id}/accept`,
    {},
    (await task(leafB.id)).version,
    true,
  );
  expect(agentAccept.status).toBe(403);
  await review(reviewer, leafA.id, false);
  const returnEvents = await db.query(
    "SELECT user_id FROM notifications WHERE task_id=$1 AND kind='task.returned'",
    [leafA.id],
  );
  expect(returnEvents.rows.map((row) => row.user_id)).toEqual([a.id]);
  const ownInbox = await ok(a, 'GET', '/me/notifications');
  const returned = ownInbox.items.find(
    (item: any) => item.kind === 'task.returned' && item.taskId === leafA.id,
  );
  expect(returned).toBeTruthy();
  const foreignNotification = await call(b, 'POST', `/me/notifications/${returned.id}/read`, {});
  expect(foreignNotification.status).toBe(404);
  await open(a, leafA.id);
  await a.page.keyboard.press('Escape');
  await expect(a.page.getByRole('dialog', { name: '任务详情', exact: true })).not.toBeVisible();
  await a.page.getByRole('button', { name: /^收件箱/ }).click();
  const inbox = a.page.getByRole('dialog', { name: '收件箱', exact: true });
  const notification = inbox
    .locator('.notification-event')
    .filter({ hasText: 'Leaf A needs a second verification record' });
  await expect(notification).toHaveCount(1);
  await notification.getByRole('button', { name: '标为已读', exact: true }).click();
  await expect(notification.locator('.notification-flags')).toContainText('已读');
  await expect(notification.locator('.notification-flags')).toContainText('未处理');
  await notification.getByRole('button', { name: '设置稍后', exact: true }).click();
  await expect(notification.locator('.notification-flags')).toContainText('稍后至');
  await notification.getByRole('button', { name: '标为已处理', exact: true }).click();
  await expect(notification.locator('.notification-flags')).toContainText('已处理');
  await a.page.screenshot({ path: resolve(evidence, 'return-inbox-read-snooze-handle.png') });
  await inbox.getByRole('button', { name: '关闭收件箱', exact: true }).click();
  observations.push(
    'Return event persisted only for leaf A implementer/owner; unrelated B cannot mutate its private notification. UI read, snooze and handle remained independent.',
  );
  await review(reviewer, leafB.id, true);
  const freshA = await task(leafA.id);
  const reclaim = await call(
    a,
    'POST',
    `/tasks/${leafA.id}/claim`,
    { agentKind: 'codex-cli' },
    freshA.version,
    true,
  );
  expect(reclaim.status, JSON.stringify(reclaim.body)).toBe(201);
  await submit(a, leafA.id);
  await review(reviewer, leafA.id, true);
  expect((await task(parentTask.id)).statusId).toBe(todo);
  await submit(owner, parentTask.id, true);
  expect((await task(parentTask.id)).statusId).not.toBe(done);
  await review(reviewer, parentTask.id, true);
  expect((await task(parentTask.id)).statusId).toBe(done);
  const proposalTask = await ok(owner, 'POST', `/spaces/${space}/tasks`, {
    title: 'Independent AI proposal review',
    statusId: todo,
    assigneeId: owner.id,
    reviewerId: reviewer.id,
    description: 'Original requirement',
  });
  const proposed = await call(
    a,
    'POST',
    `/tasks/${proposalTask.id}/proposals`,
    {
      kind: 'requirements',
      payload: {
        description: 'AI suggested requirement',
        acceptanceCriteria: 'AI condition',
        impact: 'Affected implementation',
      },
    },
    proposalTask.version,
    true,
  );
  expect(proposed.status, JSON.stringify(proposed.body)).toBe(200);
  expect((await task(proposalTask.id)).description).toBe('Original requirement');
  const forbiddenConfirm = await call(
    owner,
    'POST',
    `/tasks/${proposalTask.id}/proposals/${proposed.body.data.id}/confirm`,
    {},
    (await task(proposalTask.id)).version,
    true,
  );
  expect(forbiddenConfirm.status).toBe(403);
  await open(owner, proposalTask.id);
  const proposalUI = owner.page.locator('.proposal-item').filter({ hasText: 'AI 提议' });
  await expect(proposalUI).toContainText('当前已确认内容');
  await writeFile(resolve(evidence, 'proposal-dom.html'), await proposalUI.innerHTML());
  await proposalUI
    .locator('label')
    .filter({ hasText: /^新需求/ })
    .locator('textarea')
    .fill('Human adjusted requirement');
  await proposalUI
    .locator('label')
    .filter({ hasText: /^新验收条件/ })
    .locator('textarea')
    .fill('Human verified condition');
  await proposalUI.getByRole('button', { name: '确认并应用调整', exact: true }).click();
  await expect(
    proposalUI.getByRole('button', { name: '确认并应用调整', exact: true }),
  ).not.toBeVisible();
  const changed = await task(proposalTask.id);
  expect(changed.description).toBe('Human adjusted requirement');
  expect(changed.requirementsVersion).toBe(2);
  const storedProposal = (await ok(owner, 'GET', `/tasks/${proposalTask.id}/detail`)).proposals[0];
  expect(storedProposal.payload.description).toBe('AI suggested requirement');
  expect(storedProposal.confirmedPayload.description).toBe('Human adjusted requirement');
  const proposalClaim = await ok(
    owner,
    'POST',
    `/tasks/${proposalTask.id}/claim`,
    {},
    changed.version,
  );
  const staleSubmit = await call(
    owner,
    'POST',
    `/tasks/${proposalTask.id}/submit`,
    { summary: 'Old requirements', verification: 'must fail', requirementsVersion: 1 },
    proposalClaim.task.version,
  );
  expect(staleSubmit.status).toBe(409);
  observations.push(
    'Agent requirements proposal had no pre-confirmation side effect; agent confirmation denied; owner UI displayed original/proposed diff, adjusted and confirmed, persisted both payloads and v2; v1 submission denied.',
  );
  const artifactIds: string[] = [];
  for (const kind of ['pr', 'commit', 'screenshot', 'document', 'test', 'other']) {
    const artifact = await ok(
      owner,
      'POST',
      `/tasks/${proposalTask.id}/artifacts`,
      {
        kind,
        title: `Independent ${kind} evidence`,
        text: 'Synthetic acceptance record; not a published PR or model-generated change.',
        verificationScope: 'Real PostgreSQL material persistence',
        limitations:
          'No public PR exists for this uncommitted workspace; external evidence links intentionally omitted.',
      },
      (await task(proposalTask.id)).version,
    );
    artifactIds.push(artifact.id);
  }
  await ok(
    owner,
    'PATCH',
    `/tasks/${proposalTask.id}/artifacts/${artifactIds[0]}`,
    { title: 'Corrected evidence title' },
    (await task(proposalTask.id)).version,
  );
  await ok(
    owner,
    'DELETE',
    `/tasks/${proposalTask.id}/artifacts/${artifactIds[1]}`,
    undefined,
    (await task(proposalTask.id)).version,
  );
  const materialDetail = await ok(owner, 'GET', `/tasks/${proposalTask.id}/detail`);
  expect(materialDetail.artifacts).toHaveLength(6);
  expect(materialDetail.artifacts.find((item: any) => item.id === artifactIds[0]).title).toBe(
    'Corrected evidence title',
  );
  expect(
    materialDetail.artifacts.find((item: any) => item.id === artifactIds[1]).deletedAt,
  ).toBeTruthy();
  const unsafeMaterial = await call(
    owner,
    'POST',
    `/tasks/${proposalTask.id}/artifacts`,
    { kind: 'pr', title: 'Unsafe material', url: 'javascript:alert(1)' },
    (await task(proposalTask.id)).version,
  );
  expect(unsafeMaterial.status).toBe(422);
  observations.push(
    'All six material kinds persisted explicit scope/limitations; update and soft-delete retained records; javascript evidence URL rejected. No public PR was fabricated.',
  );
  for (const person of [viewer, outsider]) {
    const denied = await call(
      person,
      'PATCH',
      `/tasks/${leafB.id}`,
      { title: 'Unauthorized change' },
      (await task(leafB.id)).version,
    );
    expect([403, 404]).toContain(denied.status);
  }
  const hidden = await call(outsider, 'GET', `/tasks/${leafB.id}/detail`);
  expect([403, 404]).toContain(hidden.status);
  await open(reviewer, parentTask.id);
  await reviewer.page.screenshot({
    path: resolve(evidence, 'parent-human-accepted.png'),
    fullPage: true,
  });
  observations.push(
    'Human reviewer distinct from both implementers and owner accepted each leaf and independently integrated parent; viewer/cross-space writes denied.',
  );
  console.log('Independent production-browser multi-account collaboration passed.');
} catch (error) {
  observations.push(`FAIL: ${error instanceof Error ? error.stack : String(error)}`);
  for (let i = 0; i < actors.length; i++)
    await actors[i].page
      .screenshot({ path: resolve(evidence, `failure-${i}.png`) })
      .catch(() => undefined);
  throw error;
} finally {
  await writeFile(
    resolve(evidence, 'results.json'),
    JSON.stringify({ database: name, observations }, null, 2),
  );
  await browser?.close();
  await app.close();
  await db.end();
  await control.query(`DROP DATABASE "${name}" WITH (FORCE)`);
  await control.end();
}
