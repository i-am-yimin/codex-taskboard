import { buildApp } from './app.ts';
import { migrate } from './migrate.ts';
import { createDatabase } from './db.ts';

const db = createDatabase();
await migrate(db);
const app = buildApp({ db, logger: true });
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
