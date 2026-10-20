import { createDatabase } from './db.ts';
import { loadRuntimeEnvironment } from './runtime.ts';
import { migrate } from './migrate.ts';
loadRuntimeEnvironment();
const db = createDatabase();
try {
  await migrate(db);
} finally {
  await db.end();
}
