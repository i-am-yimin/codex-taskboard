import EmbeddedPostgres from 'embedded-postgres';
import { spawn, execFile, type ChildProcess } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
const databaseDir = resolve(process.env.TEST_PG_DIR ?? '.data/test-postgres');
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
// embedded-postgres force-kills a Windows process tree. PostgreSQL 18 I/O
// workers can retain handles after that teardown; own the test server handle
// instead and ask pg_ctl for a bounded, graceful fast shutdown.
let owned: ChildProcess | undefined;
let exited: Promise<void> | undefined;
let pgCtl: string | undefined;
async function startDatabase() {
  if (process.platform !== 'win32') return db.start();
  const require = createRequire(import.meta.url);
  const binaryPath = require.resolve(`@embedded-postgres/windows-${process.arch}`, {
    paths: [dirname(require.resolve('embedded-postgres'))],
  });
  const binaries = (await import(pathToFileURL(binaryPath).href)) as {
    postgres: string;
    pg_ctl: string;
  };
  pgCtl = binaries.pg_ctl;
  owned = spawn(binaries.postgres, ['-D', databaseDir, '-p', String(port), '-h', '127.0.0.1'], {
    windowsHide: true,
    env: { ...process.env, LC_MESSAGES: 'en_US.UTF-8' },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  exited = new Promise<void>((resolve) => owned!.once('exit', () => resolve()));
  await new Promise<void>((resolve, reject) => {
    let log = '';
    const timer = setTimeout(() => {
      reject(new Error('Isolated test PostgreSQL did not become ready within 20 seconds'));
    }, 20000);
    owned!.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    owned!.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Isolated test PostgreSQL exited during startup (${code}): ${log}`));
    });
    owned!.stderr!.on('data', (chunk: Buffer) => {
      log = (log + chunk.toString()).slice(-4000);
      if (log.includes('database system is ready to accept connections')) {
        clearTimeout(timer);
        resolve();
      }
    });
  });
}
async function stopDatabase() {
  if (!owned) return db.stop();
  if (owned.exitCode !== null) return;
  if (!pgCtl) throw new Error('Missing owned test PostgreSQL control executable');
  try {
    await promisify(execFile)(pgCtl, ['-D', databaseDir, 'stop', '-m', 'fast', '-w', '-t', '45'], {
      windowsHide: true,
      timeout: 50000,
    });
  } catch {
    // This cluster contains only disposable test data. A checkpoint can stall
    // on Windows slow volumes; explicitly stop it instead of leaving a listener
    // behind or reporting a failed runner as successful.
    console.error(
      'Test PostgreSQL fast shutdown timed out; requesting immediate shutdown of the owned test cluster.',
    );
    await promisify(execFile)(
      pgCtl,
      ['-D', databaseDir, 'stop', '-m', 'immediate', '-w', '-t', '10'],
      { windowsHide: true, timeout: 15000 },
    );
  }
  await exited;
}
try {
  await startDatabase();
} catch (error) {
  await stopDatabase().catch(() => undefined);
  throw error;
}
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
    await stopDatabase();
    process.exit();
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  await new Promise(() => {});
} else {
  let statusCode = 1;
  try {
    const args = process.argv.slice(2);
    const browserTests = args.includes('--playwright');
    const standaloneCheck = args.includes('--offline')
      ? 'scripts/check-offline.ts'
      : args.includes('--production')
        ? 'scripts/check-production.ts'
        : args.includes('--appearance')
          ? 'scripts/check-appearance.ts'
          : null;
    const child = spawn(
      process.execPath,
      standaloneCheck
        ? ['--import', 'tsx', resolve(standaloneCheck)]
        : browserTests
          ? [
              resolve('node_modules/@playwright/test/cli.js'),
              'test',
              ...args.filter((arg) => arg !== '--playwright'),
            ]
          : [resolve('node_modules/vitest/vitest.mjs'), 'run', ...args],
      { stdio: 'inherit', env: { ...process.env, TEST_DATABASE_URL: url } },
    );
    statusCode = await new Promise<number>((res, reject) => {
      child.on('error', reject);
      child.on('exit', (code) => res(code ?? 1));
    });
  } finally {
    await stopDatabase();
  }
  // The dependency's exit hook must not replace a failed runner's exit code.
  process.exit(statusCode);
}
