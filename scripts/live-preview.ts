import { randomBytes, randomUUID } from 'node:crypto';
import { hash } from '@node-rs/argon2';
import pg from 'pg';
import { createDatabase } from '../apps/server/src/db';
import { migrate } from '../apps/server/src/migrate';
import { buildApp } from '../apps/server/src/app';
const connection = process.env.TEST_DATABASE_URL;
if (!connection || !new URL(connection).pathname.endsWith('_test'))
  throw new Error('Start scripts/test-db.ts --serve and supply its TEST_DATABASE_URL');
const admin = new pg.Client({ connectionString: connection });
await admin.connect();
if (!(await admin.query("SELECT 1 FROM pg_database WHERE datname='taskboard_preview'")).rowCount)
  await admin.query('CREATE DATABASE taskboard_preview');
await admin.end();
const url = new URL(connection);
url.pathname = '/taskboard_preview';
const db = createDatabase(url.toString());
await migrate(db);
const email = 'preview@example.test';
const password = 'Local-preview-only-2026';
await db.query(
  'INSERT INTO users(id,email,name,password_hash,instance_admin) VALUES ($1,$2,$3,$4,true) ON CONFLICT(email) DO NOTHING',
  [randomUUID(), email, '本机预览', await hash(password)],
);
const app = buildApp({
  db,
  sessionSecret: randomBytes(32).toString('hex'),
  origin: 'http://127.0.0.1:4173',
  logger: false,
});
await app.listen({ host: '127.0.0.1', port: 47830 });
console.log(
  'Live preview API http://127.0.0.1:47830 · synthetic account preview@example.test · see script for local-only password',
);
async function stop() {
  await app.close();
  await db.end();
}
process.on('SIGINT', () => {
  void stop();
});
process.on('SIGTERM', () => {
  void stop();
});
