import { buildApp } from './app.ts';
import { migrate } from './migrate.ts';
import { createDatabase } from './db.ts';
import { loadRuntimeEnvironment } from './runtime.ts';

const secrets = loadRuntimeEnvironment();
const db = createDatabase();
await migrate(db);
const app = buildApp({
  db,
  logger: true,
  setupToken: secrets?.setupToken,
  managedSecrets: Boolean(secrets),
});
if (secrets && !(await db.query('SELECT 1 FROM users WHERE instance_admin=true LIMIT 1')).rowCount)
  process.stdout.write(
    `Taskboard first-run setup token: ${secrets.setupToken}\nOpen the website to create your administrator account.\n`,
  );
let closing = false;
async function shutdown(signal: string): Promise<void> {
  if (closing) return;
  closing = true;
  app.log.info({ signal }, 'Shutting down Codex Taskboard');
  await app.close();
  await db.end();
}
process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
await app.listen({
  host: process.env.HOST ?? '127.0.0.1',
  port: Number(process.env.PORT ?? 47830),
});
