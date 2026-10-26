import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createDatabase } from '../apps/server/src/db.ts';
import { migrate } from '../apps/server/src/migrate.ts';
import { buildApp } from '../apps/server/src/app.ts';
import { assessServerCompatibility } from '../packages/core/src/server-contract.ts';
const source = process.env.TEST_DATABASE_URL;
const suite = source ? describe : describe.skip;
suite('server candidate protocol and migration readiness', () => {
  let control: ReturnType<typeof createDatabase>;
  let db: ReturnType<typeof createDatabase>;
  let app: ReturnType<typeof buildApp>;
  const name = `compat_${randomUUID().replaceAll('-', '')}_test`;
  beforeAll(async () => {
    if (!source || !new URL(source).pathname.endsWith('_test'))
      throw new Error('requires a synthetic *_test root URL');
    control = createDatabase(source);
    await control.query(`CREATE DATABASE "${name}"`);
    const url = new URL(source);
    url.pathname = `/${name}`;
    db = createDatabase(url.toString());
    await migrate(db);
    await migrate(db);
    app = buildApp({ db, sessionSecret: 'c'.repeat(64), automation: { enabled: false } });
  }, 30000);
  afterAll(async () => {
    await app?.close();
    await db?.end();
    if (control) {
      if (!/^compat_[a-f0-9]{32}_test$/.test(name))
        throw new Error('refuse unexpected database cleanup');
      await control.query(
        'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()',
        [name],
      );
      await control.query(`DROP DATABASE IF EXISTS "${name}"`);
      await control.end();
    }
  });
  it('advertises the independent local candidate and usable protocol before first account setup', async () => {
    const response = await app.inject({ url: '/api/v1/health' });
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    const data = response.json().data;
    expect(data).toMatchObject({
      status: 'ok',
      database: 'ok',
      serverVersion: '0.1.4-preview.1',
      apiVersion: 1,
      capabilities: { collaborativeWorkflows: 1 },
      migrationRequired: false,
    });
    expect(assessServerCompatibility(data).status).toBe('compatible');
    expect(Object.keys(data).sort()).toEqual([
      'apiVersion',
      'capabilities',
      'database',
      'migrationRequired',
      'serverVersion',
      'status',
    ]);
    const unauthenticated = await app.inject({
      url: '/api/v1/tasks/00000000-0000-4000-8000-000000000001',
    });
    expect(unauthenticated.statusCode).toBe(401);
  });
  it('does not advertise collaborative readiness if any required migration marker is absent', async () => {
    await db.query("DELETE FROM schema_migrations WHERE id='0009_active_workflow_intervals'");
    const response = await app.inject({ url: '/api/v1/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({
      capabilities: { collaborativeWorkflows: 0 },
      migrationRequired: true,
    });
    expect(assessServerCompatibility(response.json().data).status).toBe('upgrade_required');
    await migrate(db);
    const ready = await app.inject({ url: '/api/v1/health' });
    expect(assessServerCompatibility(ready.json().data).status).toBe('compatible');
  });
});
