import EmbeddedPostgres from 'embedded-postgres';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
const databaseDir = resolve('.data/test-postgres');
const port = Number(process.env.TEST_PG_PORT ?? 55439);
const db = new EmbeddedPostgres({
  databaseDir,
  port,
  user: 'taskboard',
  password: 'test-local-only-password',
  persistent: true,
  authMethod: 'scram-sha-256',
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  postgresFlags: ['-h', '127.0.0.1'],
  onLog: () => {},
  onError: () => {},
});
if (!existsSync(resolve(databaseDir, 'PG_VERSION'))) await db.initialise();
await db.start();
const client = db.getPgClient();
await client.connect();
if (!(await client.query("SELECT 1 FROM pg_database WHERE datname='taskboard_test'")).rowCount)
  await client.query('CREATE DATABASE taskboard_test');
await client.end();
const url = `postgres://taskboard:test-local-only-password@127.0.0.1:${port}/taskboard_test`;
if (process.argv.includes('--serve')) {
  console.log(`Local TEST_DATABASE_URL=${url}`);
  let stopped = false;
  const stop = async () => {
    if (stopped) return;
    stopped = true;
    await db.stop();
    process.exit();
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  await new Promise(() => {});
} else {
  try {
    const child = spawn(
      process.execPath,
      [resolve('node_modules/vitest/vitest.mjs'), 'run', ...process.argv.slice(2)],
      { stdio: 'inherit', env: { ...process.env, TEST_DATABASE_URL: url } },
    );
    process.exitCode = await new Promise<number>((res) =>
      child.on('exit', (code) => res(code ?? 1)),
    );
  } finally {
    await db.stop();
  }
}
