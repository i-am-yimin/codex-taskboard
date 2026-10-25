import type pg from 'pg';
export async function migrateRunPermissions(db: pg.PoolClient): Promise<void> {
  if ((await db.query("SELECT 1 FROM schema_migrations WHERE id='0008_run_permissions'")).rowCount)
    return;
  await db.query(`ALTER TABLE task_runs ADD COLUMN permission_mode text NOT NULL DEFAULT 'read-only' CHECK(permission_mode IN ('read-only','workspace-write'));
    INSERT INTO schema_migrations(id) VALUES('0008_run_permissions');`);
}
