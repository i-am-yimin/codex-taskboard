import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { hash } from '@node-rs/argon2';
import { createDatabase, type Database } from '../apps/server/src/db.ts';
import { migrate } from '../apps/server/src/migrate.ts';
import { buildApp } from '../apps/server/src/app.ts';
import { RuntimeLogs } from '../apps/server/src/runtime.ts';
import serverPackage from '../apps/server/package.json' with { type: 'json' };

const databaseUrl = process.env.TEST_DATABASE_URL;
describe.skipIf(!databaseUrl)('browser server initialization and administration', () => {
  let control: Database;
  let db: Database;
  let app: ReturnType<typeof buildApp>;
  const schema = `setup_${randomUUID().replaceAll('-', '')}`;
  const token = 'c'.repeat(64);
  const secret = 'd'.repeat(64);
  const password = 'first-run-admin-password';
  const nextPassword = 'changed-admin-password-2026';
  const origin = 'http://127.0.0.1:47830';
  let cookie = '';
  let email = 'owner@example.test';
  let url: URL;
  const logs = new RuntimeLogs([token, secret], false);
  const makeApp = () =>
    buildApp({
      db,
      setupToken: token,
      sessionSecret: secret,
      databaseUrl: url.toString(),
      logger: true,
      runtimeLogs: logs,
      managedSecrets: true,
    });
  const setup = { token, name: 'Owner', email, password, publicOrigin: origin };
  const login = (loginEmail = email, loginPassword = password, tokenKind = 'browser') =>
    app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: loginEmail, password: loginPassword, tokenKind },
    });
  const write = (
    path: string,
    payload: Record<string, unknown>,
    method: 'POST' | 'PATCH' = 'POST',
  ) =>
    app.inject({
      method,
      url: `/api/v1${path}`,
      headers: { cookie, 'idempotency-key': randomUUID() },
      payload,
    });
  beforeAll(async () => {
    if (!databaseUrl || !new URL(databaseUrl).pathname.endsWith('_test'))
      throw new Error('Requires an isolated *_test database');
    control = createDatabase(databaseUrl);
    await control.query(`CREATE SCHEMA "${schema}"`);
    url = new URL(databaseUrl);
    url.searchParams.set('options', `-csearch_path=${schema}`);
    db = createDatabase(url.toString());
    await migrate(db);
    app = makeApp();
  });
  afterAll(async () => {
    await app?.close();
    await db?.end();
    if (control) {
      await control.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await control.end();
    }
  });
  it('requires a valid operator token and serializes competing initialization attempts', async () => {
    expect((await app.inject('/api/v1/setup')).json().data.required).toBe(true);
    const invalid = await app.inject({
      method: 'POST',
      url: '/api/v1/setup',
      payload: { ...setup, token: 'wrong-token' },
    });
    expect(invalid.statusCode).toBe(403);
    const responses = await Promise.all(
      [0, 1].map(() => app.inject({ method: 'POST', url: '/api/v1/setup', payload: setup })),
    );
    expect(responses.map((response) => response.statusCode).sort()).toEqual([201, 409]);
    expect(
      (await db.query('SELECT count(*)::int count FROM users WHERE instance_admin=true')).rows[0]
        .count,
    ).toBe(1);
    expect((await app.inject('/api/v1/setup')).json().data.required).toBe(false);
    const response = await login();
    expect(response.statusCode).toBe(200);
    cookie = String(response.headers['set-cookie']).split(';')[0];
  });
  it('protects management and plaintext secrets with browser admin authentication and password verification', async () => {
    expect((await app.inject('/api/v1/admin/instance')).statusCode).toBe(401);
    const info = await app.inject({ url: '/api/v1/admin/instance', headers: { cookie } });
    expect(info.statusCode).toBe(200);
    expect(info.json().data.version).toBe(serverPackage.version);
    expect(info.json().data).toMatchObject({
      publicOrigin: origin,
      database: { managed: true, status: 'ok' },
    });
    expect(info.body).not.toContain(secret);
    expect(
      (await write('/admin/secrets/reveal', { currentPassword: 'wrong-password-long' })).statusCode,
    ).toBe(403);
    const reveal = await write('/admin/secrets/reveal', { currentPassword: password });
    expect(reveal.statusCode).toBe(200);
    expect(reveal.headers['cache-control']).toBe('no-store');
    expect(reveal.json().data.sessionKey).toBe(secret);
    expect(
      (
        await db.query('SELECT 1 FROM idempotency_keys WHERE response::text LIKE $1', [
          `%${secret}%`,
        ])
      ).rowCount,
    ).toBe(0);
    const agentLogin = await login(email, password, 'agent');
    const agentToken = agentLogin.json().data.deviceToken;
    expect(
      (
        await app.inject({
          url: '/api/v1/admin/logs',
          headers: { authorization: `Bearer ${agentToken}` },
        })
      ).statusCode,
    ).toBe(403);
    const outsiderEmail = 'outsider@example.test';
    await db.query('INSERT INTO users(id,email,name,password_hash) VALUES($1,$2,$3,$4)', [
      randomUUID(),
      outsiderEmail,
      'Member',
      await hash(password),
    ]);
    const memberLogin = await login(outsiderEmail);
    expect(
      (
        await app.inject({
          url: '/api/v1/admin/instance',
          headers: { cookie: String(memberLogin.headers['set-cookie']).split(';')[0] },
        })
      ).statusCode,
    ).toBe(403);
  });
  it('persists proxy origin and log level and uses HTTPS cookies', async () => {
    const httpsOrigin = 'https://board.example.test';
    const response = await write(
      '/admin/instance',
      { publicOrigin: httpsOrigin, logLevel: 'warn' },
      'PATCH',
    );
    expect(response.statusCode).toBe(200);
    expect(app.log.level).toBe('warn');
    expect(
      (
        await app.inject({
          url: '/api/v1/me',
          headers: { cookie, origin: 'https://attacker.example.test' },
        })
      ).statusCode,
    ).toBe(403);
    const secureLogin = await login();
    expect(secureLogin.headers['set-cookie']).toContain('Secure');
    expect(
      (
        await write(
          '/admin/instance',
          { publicOrigin: 'http://public.example.test', logLevel: 'info' },
          'PATCH',
        )
      ).statusCode,
    ).toBe(422);
    expect(
      (await write('/admin/instance', { publicOrigin: origin, logLevel: 'info' }, 'PATCH'))
        .statusCode,
    ).toBe(200);
  });
  it('verifies account edits, revokes other sessions and agent tokens on password change, and keeps this session usable', async () => {
    const otherLogin = await login();
    const otherCookie = String(otherLogin.headers['set-cookie']).split(';')[0];
    const updated = {
      name: 'Updated Owner',
      email: 'updated@example.test',
      currentPassword: password,
      newPassword: nextPassword,
    };
    expect(
      (await write('/admin/account', { ...updated, currentPassword: 'invalid-password' }, 'PATCH'))
        .statusCode,
    ).toBe(403);
    expect((await write('/admin/account', updated, 'PATCH')).statusCode).toBe(200);
    email = updated.email;
    expect((await login(email, password)).statusCode).toBe(401);
    expect((await login(email, nextPassword)).statusCode).toBe(200);
    expect(
      (await app.inject({ url: '/api/v1/me', headers: { cookie: otherCookie } })).statusCode,
    ).toBe(401);
    expect((await app.inject({ url: '/api/v1/me', headers: { cookie } })).json().data.name).toBe(
      'Updated Owner',
    );
    expect(
      (await db.query('SELECT 1 FROM devices WHERE token_hash IS NOT NULL AND revoked_at IS NULL'))
        .rowCount,
    ).toBe(0);
  });
  it('keeps setup closed and settings and sessions intact after an application restart', async () => {
    await app.close();
    await migrate(db);
    app = makeApp();
    expect((await app.inject('/api/v1/setup')).json().data.required).toBe(false);
    expect(
      (await app.inject({ method: 'POST', url: '/api/v1/setup', payload: setup })).statusCode,
    ).toBe(409);
    expect(
      (await app.inject({ url: '/api/v1/admin/instance', headers: { cookie } })).json().data
        .publicOrigin,
    ).toBe(origin);
    const output = await app.inject({ url: '/api/v1/admin/logs', headers: { cookie } });
    expect(output.json().data.scope).toBe('current-process');
    expect(output.json().data.entries.length).toBeGreaterThan(0);
    expect(output.body).not.toContain(token);
    expect(output.body).not.toContain(secret);
    expect(
      (await db.query('SELECT id FROM schema_migrations ORDER BY id')).rows.map((row) => row.id),
    ).toEqual([
      '0001_initial',
      '0002_owner_integrity',
      '0003_instance_settings',
      '0004_user_themes',
      '0005_collaborative_workflows',
      '0006_workflow_services',
      '0007_run_recovery',
      '0008_run_permissions',
      '0009_active_workflow_intervals',
    ]);
  });
});
