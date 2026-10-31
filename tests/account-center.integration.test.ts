/* eslint-disable @typescript-eslint/no-explicit-any -- Endpoint JSON and synthetic database rows are inspected at test boundaries. */
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { hash, Algorithm } from '@node-rs/argon2';
import sharp from 'sharp';
import { runAdmin } from '../apps/server/src/admin.ts';
import { createDatabase, type Database } from '../apps/server/src/db.ts';
import { migrate } from '../apps/server/src/migrate.ts';
import { buildApp } from '../apps/server/src/app.ts';
import type { MailMessage } from '../apps/server/src/account-mail.ts';

const suite = process.env.TEST_DATABASE_URL ? describe : describe.skip;
suite('account center with real PostgreSQL', () => {
  let db: Database, control: Database, app: ReturnType<typeof buildApp>, schema: string;
  let adminId: string, adminCookie: string;
  const password = 'account-center-test-password';
  const messages: MailMessage[] = [];
  const request = async (
    method: string,
    path: string,
    body?: any,
    cookie = adminCookie,
    extra: Record<string, string> = {},
  ) =>
    app.inject({
      method: method as any,
      url: `/api/v1${path}`,
      payload: body,
      headers: { cookie, 'idempotency-key': randomUUID(), ...extra },
    });
  const user = async (name: string, admin = false) => {
    const id = randomUUID();
    const email = `${id}@example.test`;
    await db.query(
      'INSERT INTO users(id,email,name,password_hash,instance_admin) VALUES($1,$2,$3,$4,$5)',
      [id, email, name, await hash(password, { algorithm: Algorithm.Argon2id }), admin],
    );
    const login = await request(
      'POST',
      '/auth/login',
      { email, password, deviceName: 'synthetic browser' },
      '',
    );
    return { id, email, cookie: String(login.headers['set-cookie']).split(';')[0] };
  };
  const space = async (cookie = adminCookie) => {
    const response = await request('POST', '/spaces', { name: 'Independent test space' }, cookie);
    expect(response.statusCode).toBe(201);
    return response.json().data.id as string;
  };
  const smtp = async () => {
    const response = await request('PUT', '/admin/smtp', {
      host: 'smtp.example.test',
      port: 587,
      security: 'starttls',
      username: 'mail-user',
      password: 'smtp-private-test-password',
      fromAddress: 'taskboard@example.test',
      fromName: 'Taskboard test',
      currentPassword: password,
    });
    expect(response.statusCode).toBe(200);
  };
  beforeEach(async () => {
    const url = new URL(process.env.TEST_DATABASE_URL!);
    if (!url.pathname.endsWith('_test'))
      throw new Error('An independent *_test database is required');
    control = createDatabase(url.toString());
    schema = `account_${randomUUID().replaceAll('-', '')}`;
    await control.query(`CREATE SCHEMA "${schema}"`);
    url.searchParams.set('options', `-csearch_path=${schema}`);
    db = createDatabase(url.toString());
    await migrate(db);
    messages.length = 0;
    app = buildApp({
      db,
      origin: 'https://board.example.test',
      sessionSecret: 'b'.repeat(64),
      automation: { enabled: false },
      mail: {
        encryptionKey: 'c'.repeat(64),
        worker: false,
        send: async (message) => {
          messages.push(message);
        },
      },
    });
    const root = await user('Root', true);
    adminId = root.id;
    adminCookie = root.cookie;
  });
  afterEach(async () => {
    await app?.close();
    await db?.end();
    if (control) {
      await control.query(`DROP SCHEMA "${schema}" CASCADE`);
      await control.end();
    }
  });

  it('versions profiles, protects private contacts, and rechecks current common membership', async () => {
    const other = await user('Member');
    const outsider = await user('Outsider');
    const spaceId = await space();
    await db.query("INSERT INTO space_members(space_id,user_id,role) VALUES($1,$2,'viewer')", [
      spaceId,
      other.id,
    ]);
    const profile = (await request('GET', '/me/profile')).json().data;
    const input = {
      name: 'A different display name',
      contacts: {
        phone: { value: 'private-phone', visibility: 'private' },
        wechat: { value: 'shared-wechat', visibility: 'members' },
        qq: { value: '', visibility: 'private' },
      },
    };
    const headers = { 'if-match': String(profile.version), 'idempotency-key': randomUUID() };
    expect((await request('PATCH', '/me/profile', input, adminCookie, headers)).statusCode).toBe(
      200,
    );
    expect((await request('PATCH', '/me/profile', input, adminCookie, headers)).statusCode).toBe(
      200,
    );
    expect(
      (
        await request('PATCH', '/me/profile', { ...input, name: 'stale' }, adminCookie, {
          'if-match': '1',
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (await request('GET', `/users/${adminId}/profile`, undefined, other.cookie)).json().data
        .contacts,
    ).toEqual({ wechat: 'shared-wechat' });
    expect((await request('GET', `/users/${adminId}/profile`)).json().data.contacts).toEqual({
      wechat: 'shared-wechat',
    });
    expect(
      (await request('GET', `/users/${adminId}/profile`, undefined, outsider.cookie)).statusCode,
    ).toBe(404);
    await db.query('DELETE FROM space_members WHERE space_id=$1 AND user_id=$2', [
      spaceId,
      other.id,
    ]);
    expect(
      (await request('GET', `/users/${adminId}/profile`, undefined, other.cookie)).statusCode,
    ).toBe(404);
    const saved = await db.query('SELECT response::text FROM idempotency_keys WHERE user_id=$1', [
      adminId,
    ]);
    expect(JSON.stringify(saved.rows)).not.toContain('private-phone');
  });
  it('validates and normalizes avatar bytes, preserves old image on failure and rejects stale deletion', async () => {
    const png = await sharp({
      create: { width: 400, height: 300, channels: 3, background: '#e5a44b' },
    })
      .png()
      .toBuffer();
    const uploaded = await request('POST', '/me/avatar', png, adminCookie, {
      'content-type': 'image/png',
      'if-match': '1',
    });
    expect(uploaded.statusCode).toBe(200);
    const image = await request('GET', `/users/${adminId}/avatar`);
    expect(image.headers['content-type']).toContain('image/webp');
    expect(image.headers['cache-control']).toBe('no-store');
    expect(await sharp(image.rawPayload).metadata()).toMatchObject({
      format: 'webp',
      width: 256,
      height: 256,
    });
    expect(
      (
        await request('POST', '/me/avatar', Buffer.from('<svg/>'), adminCookie, {
          'content-type': 'image/png',
          'if-match': '2',
        })
      ).statusCode,
    ).toBe(422);
    expect(
      (await request('DELETE', '/me/avatar', undefined, adminCookie, { 'if-match': '1' }))
        .statusCode,
    ).toBe(409);
    expect((await request('GET', `/users/${adminId}/avatar`)).statusCode).toBe(200);
    expect(
      (await request('DELETE', '/me/avatar', undefined, adminCookie, { 'if-match': '2' }))
        .statusCode,
    ).toBe(200);
    expect((await request('GET', `/users/${adminId}/avatar`)).statusCode).toBe(404);
    expect(
      (
        await request('POST', '/me/avatar', Buffer.alloc(2097153), adminCookie, {
          'content-type': 'image/png',
          'if-match': '3',
        })
      ).statusCode,
    ).toBe(413);
  });
  it('encrypts SMTP and queued links, verifies email once, and blocks legacy email bypass', async () => {
    await smtp();
    const current = (await request('GET', '/me')).json().data;
    expect(
      (
        await request('PATCH', '/admin/account', {
          name: 'Root',
          email: 'bypass@example.test',
          currentPassword: password,
        })
      ).json().error.code,
    ).toBe('EMAIL_VERIFICATION_REQUIRED');
    expect(
      (await request('POST', '/me/email/request', { currentPassword: password })).statusCode,
    ).toBe(200);
    const outbox = await db.query('SELECT payload_encrypted FROM mail_outbox');
    expect(JSON.stringify(outbox.rows)).not.toContain(current.email);
    expect(JSON.stringify((await db.query('SELECT * FROM smtp_settings')).rows)).not.toContain(
      'smtp-private-test-password',
    );
    expect((await request('GET', '/admin/smtp')).json().data).toMatchObject({
      configured: true,
      passwordConfigured: true,
    });
    expect((await request('GET', '/admin/smtp')).body).not.toContain('smtp-private-test-password');
    await app.runAccountMail();
    expect(messages).toHaveLength(1);
    const raw = new URLSearchParams(
      new URL(messages[0].text.match(/https:\/\/\S+/)![0]).hash.slice(1),
    ).get('verify');
    expect((await request('POST', '/auth/email/complete', { token: raw }, '')).statusCode).toBe(
      200,
    );
    expect((await request('POST', '/auth/email/complete', { token: raw }, '')).statusCode).toBe(
      400,
    );
    expect((await request('GET', '/me/profile')).json().data.emailVerified).toBe(true);
    expect(
      (await db.query('SELECT payload_encrypted FROM mail_outbox')).rows[0].payload_encrypted,
    ).toBeNull();
  });
  it('keeps the old email until confirmation and revokes sessions after email change', async () => {
    await smtp();
    const pending = await request('POST', '/me/email/request', {
      currentPassword: password,
      email: 'replacement@example.test',
    });
    expect(pending.statusCode).toBe(200);
    expect((await request('GET', '/me')).json().data.email).not.toBe('replacement@example.test');
    await app.runAccountMail();
    const raw = new URLSearchParams(
      new URL(messages[0].text.match(/https:\/\/\S+/)![0]).hash.slice(1),
    ).get('verify');
    expect((await request('POST', '/auth/email/complete', { token: raw }, '')).statusCode).toBe(
      200,
    );
    expect((await request('GET', '/me')).json().data.email).toBe('replacement@example.test');
    expect((await db.query('SELECT email FROM users WHERE id=$1', [adminId])).rows[0].email).toBe(
      'replacement@example.test',
    );
    expect(
      (await db.query("SELECT count(*) FROM mail_outbox WHERE kind='email_changed_notice'")).rows[0]
        .count,
    ).toBe('1');
  });
  it('hides account existence during recovery, expires links and revokes all sessions on successful reset', async () => {
    await smtp();
    const target = await user('Recoverable');
    expect(
      (
        await request('POST', '/auth/recovery/request', { email: 'absent@example.test' }, '')
      ).json(),
    ).toEqual(
      (await request('POST', '/auth/recovery/request', { email: target.email }, '')).json(),
    );
    await app.runAccountMail();
    const raw = new URLSearchParams(
      new URL(messages[0].text.match(/https:\/\/\S+/)![0]).hash.slice(1),
    ).get('recovery');
    const reset = await request(
      'POST',
      '/auth/recovery/complete',
      { token: raw, password: 'brand-new-recovery-password' },
      '',
    );
    expect(reset.statusCode).toBe(200);
    expect((await request('GET', '/me', undefined, target.cookie)).statusCode).toBe(401);
    expect(
      (await request('POST', '/auth/recovery/complete', { token: raw, password }, '')).statusCode,
    ).toBe(400);
  });
  it('protects the final administrator under concurrency and requires owner transfer before disabling', async () => {
    expect(
      (
        await request('PATCH', `/admin/users/${adminId}`, {
          instanceAdmin: false,
          currentPassword: password,
          reason: 'test',
        })
      ).json().error.code,
    ).toBe('LAST_ADMIN');
    expect(
      (
        await request('PATCH', `/admin/users/${adminId}`, {
          disabled: true,
          currentPassword: password,
          reason: 'test',
        })
      ).json().error.code,
    ).toBe('SELF_DISABLE_FORBIDDEN');
    const second = await user('Second root', true);
    const results = await Promise.all([
      request('PATCH', `/admin/users/${adminId}`, {
        instanceAdmin: false,
        currentPassword: password,
        reason: 'concurrent test',
      }),
      request(
        'PATCH',
        `/admin/users/${second.id}`,
        { instanceAdmin: false, currentPassword: password, reason: 'concurrent test' },
        second.cookie,
      ),
    ]);
    expect(results.map((result) => result.statusCode).sort()).toEqual([200, 409]);
    expect(
      (await db.query('SELECT count(*) FROM users WHERE instance_admin AND archived_at IS NULL'))
        .rows[0].count,
    ).toBe('1');
  });
  it('scopes takeover to one browser session and space, audits it, expires it and preserves real membership', async () => {
    const owner = await user('Real owner');
    const spaceId = await space(owner.cookie);
    const before = await db.query('SELECT * FROM space_members WHERE space_id=$1', [spaceId]);
    expect((await request('GET', `/spaces/${spaceId}/board`)).statusCode).toBe(403);
    const granted = await request('POST', `/admin/spaces/${spaceId}/takeover`, {
      currentPassword: password,
      reason: 'Investigate a synthetic issue',
    });
    expect(granted.statusCode).toBe(200);
    expect((await request('GET', `/spaces/${spaceId}/board`)).json().data).toMatchObject({
      space: { role: 'admin' },
      takeover: { id: granted.json().data.id },
    });
    expect(
      (await db.query('SELECT * FROM space_members WHERE space_id=$1', [spaceId])).rows,
    ).toEqual(before.rows);
    const relogin = await request(
      'POST',
      '/auth/login',
      {
        email: (await request('GET', '/me')).json().data.email,
        password,
        deviceName: 'second session',
      },
      '',
    );
    expect(
      (
        await request(
          'GET',
          `/spaces/${spaceId}/board`,
          undefined,
          String(relogin.headers['set-cookie']).split(';')[0],
        )
      ).statusCode,
    ).toBe(403);
    const agent = await request(
      'POST',
      '/auth/login',
      {
        email: (await request('GET', '/me')).json().data.email,
        password,
        deviceName: 'synthetic agent',
        tokenKind: 'agent',
      },
      '',
      { 'x-taskboard-client': 'agent' },
    );
    const bearer = agent.json().data.deviceToken;
    expect(typeof bearer).toBe('string');
    expect(
      (
        await request('GET', `/spaces/${spaceId}/board`, undefined, '', {
          authorization: `Bearer ${bearer}`,
        })
      ).statusCode,
    ).not.toBe(200);
    expect(
      (await request('GET', '/me/profile', undefined, '', { authorization: `Bearer ${bearer}` }))
        .statusCode,
    ).not.toBe(200);
    await db.query("UPDATE space_takeovers SET expires_at=now()-interval '1 second' WHERE id=$1", [
      granted.json().data.id,
    ]);
    expect((await request('GET', `/spaces/${spaceId}/board`)).statusCode).toBe(403);
    expect(
      (await db.query("SELECT count(*) FROM account_audit WHERE action='space.takeover_read'"))
        .rows[0].count,
    ).toBe('1');
  });
  it('revokes superseded invitations, transfers ownership before disable and restores without reviving old sessions', async () => {
    await smtp();
    const invited = await request('POST', '/admin/invitations', {
      email: 'invited@example.test',
      role: 'viewer',
    });
    expect(invited.statusCode).toBe(200);
    await app.runAccountMail();
    const firstToken = new URLSearchParams(
      new URL(messages[0].text.match(/https:\/\/\S+/)![0]).hash.slice(1),
    ).get('invite');
    expect(
      (await request('POST', `/admin/invitations/${invited.json().data.id}/resend`)).statusCode,
    ).toBe(200);
    expect(
      (
        await request(
          'POST',
          '/auth/invitations/accept',
          { token: firstToken, email: 'invited@example.test', name: 'Invited', password },
          '',
        )
      ).statusCode,
    ).toBe(400);
    const owner = await user('Owner to disable');
    const next = await user('New owner');
    const spaceId = await space(owner.cookie);
    await db.query("INSERT INTO space_members(space_id,user_id,role) VALUES($1,$2,'admin')", [
      spaceId,
      next.id,
    ]);
    const body = { currentPassword: password, reason: 'Transfer before disabling an account' };
    expect(
      (await request('PATCH', `/admin/users/${owner.id}`, { ...body, disabled: true })).json().error
        .code,
    ).toBe('OWNER_TRANSFER_REQUIRED');
    await request('POST', `/admin/spaces/${spaceId}/takeover`, body);
    expect(
      (
        await request('POST', `/admin/spaces/${spaceId}/transfer-owner`, {
          ...body,
          userId: next.id,
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (await request('PATCH', `/admin/users/${owner.id}`, { ...body, disabled: true })).statusCode,
    ).toBe(200);
    expect((await request('GET', '/me', undefined, owner.cookie)).statusCode).toBe(401);
    expect(
      (await request('PATCH', `/admin/users/${owner.id}`, { ...body, disabled: false })).statusCode,
    ).toBe(200);
    expect((await request('GET', '/me', undefined, owner.cookie)).statusCode).toBe(401);
    expect(
      (
        await db.query("SELECT user_id FROM space_members WHERE space_id=$1 AND role='owner'", [
          spaceId,
        ])
      ).rows[0].user_id,
    ).toBe(next.id);
  });
  it('bounds failed SMTP retries, persists encrypted work across restart, and keeps login available without a mail key', async () => {
    await smtp();
    await app.close();
    app = buildApp({
      db,
      origin: 'https://board.example.test',
      sessionSecret: 'b'.repeat(64),
      automation: { enabled: false },
      mail: {
        encryptionKey: 'c'.repeat(64),
        worker: false,
        send: async () => {
          throw new Error('synthetic secret SMTP failure');
        },
      },
    });
    const queued = await request('POST', '/admin/smtp/test', { currentPassword: password });
    expect(queued.statusCode).toBe(200);
    for (let attempt = 0; attempt < 3; attempt++) {
      await db.query("UPDATE mail_outbox SET next_attempt_at=now()-interval '1 second'");
      await app.runAccountMail();
    }
    const row = (await db.query('SELECT * FROM mail_outbox')).rows[0];
    expect(row.status).toBe('failed');
    expect(row.attempts).toBe(3);
    expect(row.last_error).toBe('SMTP_DELIVERY_FAILED');
    expect(row.payload_encrypted).not.toContain('synthetic secret');
    await app.close();
    app = buildApp({
      db,
      origin: 'https://board.example.test',
      sessionSecret: 'b'.repeat(64),
      automation: { enabled: false },
      mail: {
        encryptionKey: 'c'.repeat(64),
        worker: false,
        send: async (message) => {
          messages.push(message);
        },
      },
    });
    expect((await request('POST', `/admin/mail/${row.id}/retry`)).statusCode).toBe(200);
    await app.runAccountMail();
    expect(messages).toHaveLength(1);
    expect(
      (await db.query('SELECT status,payload_encrypted FROM mail_outbox WHERE id=$1', [row.id]))
        .rows[0],
    ).toMatchObject({ status: 'accepted', payload_encrypted: null });
    await app.close();
    app = buildApp({
      db,
      origin: 'https://board.example.test',
      sessionSecret: 'b'.repeat(64),
      automation: { enabled: false },
      mail: { encryptionKey: 'invalid', worker: false },
    });
    expect((await request('GET', '/me')).statusCode).toBe(200);
    expect((await request('GET', '/admin/smtp')).json().data.keyReady).toBe(false);
    expect(
      (await request('POST', '/auth/recovery/request', { email: 'unknown@example.test' }, ''))
        .statusCode,
    ).toBe(503);
    await app.close();
    app = buildApp({
      db,
      origin: 'https://board.example.test',
      sessionSecret: 'b'.repeat(64),
      automation: { enabled: false },
      mail: { encryptionKey: 'd'.repeat(64), worker: false },
    });
    // Explicit replacement can recover SMTP with a new key even though its old
    // password is no longer decryptable.
    await smtp();
    expect((await request('GET', '/admin/smtp')).json().data.passwordConfigured).toBe(true);
    expect(
      (await request('POST', '/auth/recovery/request', { email: 'unknown@example.test' }, ''))
        .statusCode,
    ).toBe(200);
  });
  it('rejects expired verification and recovery tokens without changing the account', async () => {
    await smtp();
    const email = (await request('GET', '/me')).json().data.email;
    await request('POST', '/me/email/request', { currentPassword: password });
    await request('POST', '/auth/recovery/request', { email }, '');
    await app.runAccountMail();
    await db.query("UPDATE account_verifications SET expires_at=now()-interval '1 second'");
    await db.query("UPDATE recovery_links SET expires_at=now()-interval '1 second'");
    const verifyToken = new URLSearchParams(
      new URL(
        messages
          .find((message) => message.subject === '验证 Taskboard 邮箱')!
          .text.match(/https:\/\/\S+/)![0],
      ).hash.slice(1),
    ).get('verify');
    const recoveryToken = new URLSearchParams(
      new URL(
        messages
          .find((message) => message.subject === '重设 Taskboard 密码')!
          .text.match(/https:\/\/\S+/)![0],
      ).hash.slice(1),
    ).get('recovery');
    expect(
      (await request('POST', '/auth/email/complete', { token: verifyToken }, '')).statusCode,
    ).toBe(400);
    expect(
      (
        await request(
          'POST',
          '/auth/recovery/complete',
          { token: recoveryToken, password: 'should-not-replace-password' },
          '',
        )
      ).statusCode,
    ).toBe(400);
    expect((await request('GET', '/me/profile')).json().data.emailVerified).toBe(false);
  });
  it('rechecks a queued space creation after account suspension without leaving an inactive owner', async () => {
    const target = await user('Pending creator');
    const blocker = await db.connect();
    let pending: ReturnType<typeof request> | undefined;
    try {
      await blocker.query('BEGIN');
      await blocker.query("SELECT pg_advisory_xact_lock(hashtext('taskboard:account-governance'))");
      pending = request(
        'POST',
        '/spaces',
        { name: 'Must not be created after suspension' },
        target.cookie,
      );
      await expect
        .poll(
          async () =>
            Number(
              (
                await db.query(
                  "SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND wait_event='advisory' AND query LIKE '%account-governance%' AND pid<>pg_backend_pid()",
                )
              ).rows[0].count,
            ),
          { timeout: 5000 },
        )
        .toBeGreaterThan(0);
      await blocker.query('UPDATE users SET archived_at=now() WHERE id=$1', [target.id]);
      await blocker.query('COMMIT');
      expect((await pending).statusCode).toBe(401);
      expect(
        (await db.query('SELECT count(*) FROM space_members WHERE user_id=$1', [target.id])).rows[0]
          .count,
      ).toBe('0');
    } finally {
      await blocker.query('ROLLBACK');
      blocker.release();
      await pending;
    }
  });
  it('rejects an ownership transfer queued behind suspension of its target', async () => {
    const target = await user('Pending owner');
    const spaceId = await space();
    await db.query("INSERT INTO space_members(space_id,user_id,role) VALUES($1,$2,'admin')", [
      spaceId,
      target.id,
    ]);
    const blocker = await db.connect();
    let pending: ReturnType<typeof request> | undefined;
    try {
      await blocker.query('BEGIN');
      await blocker.query("SELECT pg_advisory_xact_lock(hashtext('taskboard:account-governance'))");
      pending = request('POST', `/spaces/${spaceId}/transfer-owner`, { userId: target.id });
      await expect
        .poll(
          async () =>
            Number(
              (
                await db.query(
                  "SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND wait_event='advisory' AND query LIKE '%account-governance%' AND pid<>pg_backend_pid()",
                )
              ).rows[0].count,
            ),
          { timeout: 5000 },
        )
        .toBeGreaterThan(0);
      await blocker.query('UPDATE users SET archived_at=now() WHERE id=$1', [target.id]);
      await blocker.query('COMMIT');
      expect((await pending).statusCode).toBe(404);
      expect(
        (
          await db.query("SELECT user_id FROM space_members WHERE space_id=$1 AND role='owner'", [
            spaceId,
          ])
        ).rows[0].user_id,
      ).toBe(adminId);
    } finally {
      await blocker.query('ROLLBACK');
      blocker.release();
      await pending;
    }
  });
  it('keeps web recovery behind email verification while console recovery remains available without SMTP', async () => {
    const email = (await request('GET', '/me')).json().data.email;
    const legacy = await request('POST', '/admin/recovery', { email });
    expect(legacy.statusCode).toBe(409);
    expect(legacy.json().error.code).toBe('EMAIL_RECOVERY_REQUIRED');
    expect((await db.query('SELECT count(*) FROM recovery_links')).rows[0].count).toBe('0');
    const link = await runAdmin(['recovery', '--email', email], db);
    const token = new URLSearchParams(new URL(link).hash.slice(1)).get('recovery');
    expect(token).toBeTruthy();
    const row = (
      await db.query(
        'SELECT token_hash,extract(epoch FROM expires_at-created_at) lifetime FROM recovery_links',
      )
    ).rows[0];
    expect(row.token_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(row.token_hash).not.toBe(token);
    expect(Number(row.lifetime)).toBeLessThanOrEqual(1800);
    const resetPassword = 'console-reset-account-test-2026';
    expect(
      (await request('POST', '/auth/recovery/complete', { token, password: resetPassword }, ''))
        .statusCode,
    ).toBe(200);
    expect((await request('GET', '/me')).statusCode).toBe(401);
    expect(
      (await request('POST', '/auth/login', { email, password: resetPassword }, '')).statusCode,
    ).toBe(200);
  });
  it('upgrades an old schema without changing account identity, password or active session', async () => {
    const prior = (await request('GET', '/me')).json().data;
    await db.query(`DROP TABLE account_audit,space_takeovers,mail_outbox,smtp_settings,account_verifications,user_avatars;
      ALTER TABLE users DROP COLUMN profile_version,DROP COLUMN contacts,DROP COLUMN email_verified_at,DROP COLUMN avatar_version;
      ALTER TABLE devices DROP COLUMN last_active_at;ALTER TABLE invitations DROP COLUMN revoked_at;
      DELETE FROM schema_migrations WHERE id IN ('0010_account_center','0011_account_recovery_hardening');`);
    await db.query(
      `INSERT INTO idempotency_keys (user_id,key,request_hash,response,status_code)
       VALUES ($1,'legacy-recovery-cache','test',$2,201),($1,'preserved-invitation-cache','test',$3,201)`,
      [
        prior.id,
        { url: 'https://board.example.test/#recovery=synthetic-legacy-link' },
        { url: 'https://board.example.test/#invite=synthetic-invitation' },
      ],
    );
    await migrate(db);
    await migrate(db);
    expect((await db.query('SELECT key FROM idempotency_keys ORDER BY key')).rows).toEqual([
      { key: 'preserved-invitation-cache' },
    ]);
    expect((await request('GET', '/me')).json().data.id).toBe(prior.id);
    expect((await request('GET', '/me/profile')).json().data).toMatchObject({
      id: prior.id,
      email: prior.email,
      emailVerified: false,
      version: 1,
    });
  });
});
