import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import pg from 'pg';

const url = new URL(process.env.TEST_DATABASE_URL ?? '');
if (!url.pathname.endsWith('_test'))
  throw new Error('Requires isolated TEST_DATABASE_URL ending in _test');
const control = new pg.Client({ connectionString: url.toString() });
await control.connect();
const name = `production_check_${randomUUID().replaceAll('-', '')}`;
await control.query(`CREATE DATABASE "${name}"`);
url.pathname = `/${name}`;
const env = {
  ...process.env,
  DATABASE_URL: url.toString(),
  TASKBOARD_ADMIN_PASSWORD: 'compiled-entry-test-password',
  SESSION_KEY: 'a'.repeat(64),
};
async function run(entry: string, args: string[] = []) {
  const child = spawn(process.execPath, [resolve(`dist/${entry}.js`), ...args], {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (value) => {
    output += value;
  });
  child.stderr.on('data', (value) => {
    output += value;
  });
  const code = await new Promise<number | null>((res, reject) => {
    child.once('error', reject);
    child.once('exit', res);
  });
  if (code !== 0) throw new Error(`${entry} exited ${code}: ${output}`);
  return output;
}
try {
  await run('migrate');
  const result = await run('admin', [
    'bootstrap',
    '--email',
    'compiled@example.test',
    '--name',
    'Compiled check',
  ]);
  if (!result.includes('Created instance administrator'))
    throw new Error('Compiled admin did not execute');
  const db = new pg.Client({ connectionString: url.toString() });
  await db.connect();
  try {
    const rows = await db.query('SELECT count(*)::int count FROM users WHERE instance_admin=true');
    if (rows.rows[0].count !== 1)
      throw new Error('Compiled bootstrap did not create exactly one admin');
    const migrations = await db.query('SELECT id FROM schema_migrations ORDER BY id');
    const expected = [
      '0001_initial',
      '0002_owner_integrity',
      '0003_instance_settings',
      '0004_user_themes',
      '0005_collaborative_workflows',
      '0006_workflow_services',
      '0007_run_recovery',
      '0008_run_permissions',
      '0009_active_workflow_intervals',
      '0010_account_center',
    ];
    if (migrations.rows.map((row) => row.id).join(',') !== expected.join(','))
      throw new Error('Unexpected migration state');
    const accountTables = await db.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema='public'
      AND table_name=ANY($1::text[]) ORDER BY table_name`,
      [
        [
          'account_audit',
          'account_verifications',
          'mail_outbox',
          'smtp_settings',
          'space_takeovers',
          'user_avatars',
        ],
      ],
    );
    if (accountTables.rowCount !== 6)
      throw new Error('Compiled migration did not create every account-center table');
    const profile = (
      await db.query('SELECT profile_version,email_verified_at,avatar_version,contacts FROM users')
    ).rows[0];
    if (
      profile.profile_version !== 1 ||
      profile.email_verified_at !== null ||
      profile.avatar_version !== 0 ||
      ['phone', 'wechat', 'qq'].some(
        (kind) =>
          profile.contacts[kind]?.value !== '' || profile.contacts[kind]?.visibility !== 'private',
      )
    )
      throw new Error('Compiled bootstrap did not preserve private account defaults');
  } finally {
    await db.end();
  }
  console.log('Compiled migrate + admin verified against a fresh PostgreSQL database.');
} finally {
  // Only the random database created by this process is removed.
  await control.query(`DROP DATABASE "${name}" WITH (FORCE)`);
  await control.end();
}
