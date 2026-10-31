import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, realpath, rm } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { hash } from '@node-rs/argon2';
import { createDatabase, type Database } from '../apps/server/src/db.ts';
import { migrate } from '../apps/server/src/migrate.ts';
import { startAccountTestServer } from './fixtures/account-server.ts';
import { mailText, startSmtpFixture } from './fixtures/smtp.ts';

const suite = process.env.TEST_DATABASE_URL ? describe : describe.skip;
suite('real Nodemailer transport with isolated TLS SMTP', () => {
  let db: Database, control: Database, directory: string;
  let app: Awaited<ReturnType<typeof startAccountTestServer>>;
  const receivers: Awaited<ReturnType<typeof startSmtpFixture>>[] = [];
  const schema = `smtp_${randomUUID().replaceAll('-', '')}`;
  const password = 'smtp-real-transport-test-2026';
  const email = 'smtp-admin@example.test';
  let databaseUrl: string, certificate: string, key: string, caFile: string;
  let cookie = '';
  const request = (method: string, path: string, payload?: unknown) =>
    app.inject({
      method,
      url: `/api/v1${path}`,
      payload,
      headers: { cookie, 'idempotency-key': randomUUID() },
    });
  beforeAll(async () => {
    const url = new URL(process.env.TEST_DATABASE_URL!);
    if (!url.pathname.endsWith('_test')) throw new Error('Use an isolated *_test database');
    control = createDatabase(url.toString());
    await control.query(`CREATE SCHEMA "${schema}"`);
    url.searchParams.set('options', `-csearch_path=${schema}`);
    databaseUrl = url.toString();
    db = createDatabase(databaseUrl);
    await migrate(db);
    await db.query(
      'INSERT INTO users(id,email,name,password_hash,instance_admin) VALUES($1,$2,$3,$4,true)',
      [randomUUID(), email, 'SMTP transport test', await hash(password)],
    );
    await mkdir(resolve('.artifacts'), { recursive: true });
    directory = await mkdtemp(resolve('.artifacts/smtp-transport-'));
    caFile = join(directory, 'test-ca.pem');
    const keyFile = join(directory, 'test-key.pem');
    let openssl = 'openssl';
    if (spawnSync(openssl, ['version'], { windowsHide: true, stdio: 'ignore' }).status !== 0) {
      const gitPath = execFileSync('git', ['--exec-path'], {
        encoding: 'utf8',
        windowsHide: true,
      }).trim();
      openssl = resolve(gitPath, '../../../usr/bin/openssl.exe');
      if (!existsSync(openssl))
        throw new Error('OpenSSL is required for the isolated SMTP certificate');
    }
    execFileSync(
      openssl,
      [
        'req',
        '-x509',
        '-newkey',
        'rsa:2048',
        '-nodes',
        '-days',
        '1',
        '-subj',
        '/CN=localhost',
        '-addext',
        'subjectAltName=DNS:localhost,IP:127.0.0.1',
        '-keyout',
        keyFile,
        '-out',
        caFile,
      ],
      { windowsHide: true, stdio: 'ignore', timeout: 15000 },
    );
    certificate = await readFile(caFile, 'utf8');
    key = await readFile(keyFile, 'utf8');
    app = await startAccountTestServer({
      databaseUrl,
      sessionSecret: 'a'.repeat(64),
      encryptionKey: 'b'.repeat(64),
      smtpTransport: true,
    });
    const login = await request('POST', '/auth/login', { email, password });
    expect(login.statusCode).toBe(200);
    cookie = String(login.headers['set-cookie']).split(';')[0];
    await db.query(
      "INSERT INTO instance_settings(id,public_origin,log_level) VALUES(1,$1,'info')",
      [app.base],
    );
  });
  afterAll(async () => {
    await app?.close();
    await Promise.all(receivers.map((receiver) => receiver.close()));
    await db?.end();
    if (control) {
      await control.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await control.end();
    }
    if (directory) {
      const actual = await realpath(directory);
      if (!actual.startsWith((await realpath('.artifacts')) + sep))
        throw new Error('Refuse SMTP cleanup outside test artifacts');
      await rm(actual, { recursive: true, force: true });
    }
  });
  it(
    'rejects an untrusted certificate, retries with trust, and completes verification over STARTTLS',
    { timeout: 60000 },
    async () => {
      const tlsReceiver = await startSmtpFixture({
        key,
        cert: certificate,
        username: 'test-sender',
        password: 'test-smtp-password',
      });
      receivers.push(tlsReceiver);
      const smtp = (port: number, security: 'tls' | 'starttls', replacePassword = true) =>
        request('PUT', '/admin/smtp', {
          host: '127.0.0.1',
          port,
          security,
          username: 'test-sender',
          password: replacePassword ? 'test-smtp-password' : '',
          fromAddress: 'taskboard@example.test',
          fromName: 'SMTP acceptance',
          currentPassword: password,
        });
      expect((await smtp(tlsReceiver.port, 'tls')).statusCode).toBe(200);
      const queued = await request('POST', '/admin/smtp/test', { currentPassword: password });
      expect(queued.statusCode).toBe(200);
      const mailId = queued.json().data.mailId;
      await app.runAccountMail();
      expect(
        (await db.query('SELECT status,attempts,last_error FROM mail_outbox WHERE id=$1', [mailId]))
          .rows[0],
      ).toMatchObject({ status: 'pending', attempts: 1, last_error: 'SMTP_DELIVERY_FAILED' });
      expect(tlsReceiver.authentications()).toBe(0);
      expect(tlsReceiver.messages).toHaveLength(0);
      await app.close();
      app = await startAccountTestServer({
        databaseUrl,
        sessionSecret: 'a'.repeat(64),
        encryptionKey: 'b'.repeat(64),
        smtpTransport: true,
        trustedCa: caFile,
      });
      await db.query('UPDATE instance_settings SET public_origin=$1 WHERE id=1', [app.base]);
      await db.query(
        "UPDATE mail_outbox SET next_attempt_at=now()-interval '1 second' WHERE id=$1",
        [mailId],
      );
      await app.runAccountMail();
      expect(
        (
          await db.query('SELECT status,attempts,payload_encrypted FROM mail_outbox WHERE id=$1', [
            mailId,
          ])
        ).rows[0],
      ).toMatchObject({ status: 'accepted', attempts: 2, payload_encrypted: null });
      expect(tlsReceiver.authentications()).toBe(1);
      expect(tlsReceiver.messages).toHaveLength(1);
      const starttlsReceiver = await startSmtpFixture({
        key,
        cert: certificate,
        starttls: true,
        username: 'test-sender',
        password: 'test-smtp-password',
      });
      receivers.push(starttlsReceiver);
      expect((await smtp(starttlsReceiver.port, 'starttls', false)).statusCode).toBe(200);
      expect(
        (await request('POST', '/me/email/request', { currentPassword: password })).statusCode,
      ).toBe(200);
      await app.runAccountMail();
      expect(starttlsReceiver.upgrades()).toBe(1);
      expect(starttlsReceiver.authentications()).toBe(1);
      expect(starttlsReceiver.messages).toHaveLength(1);
      const text = mailText(starttlsReceiver.messages[0]);
      expect(text).toContain(`${app.base}/#verify=`);
      const token = text.match(/#verify=([\w-]+)/)?.[1];
      expect(token).toBeTruthy();
      expect((await request('POST', '/auth/email/complete', { token })).statusCode).toBe(200);
      expect((await request('GET', '/me/profile')).json().data.emailVerified).toBe(true);
    },
  );
});
