import { type Database, withTransaction } from './db.ts';

const migration = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS schema_migrations (id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS users (
 id uuid PRIMARY KEY, email text NOT NULL UNIQUE, name text NOT NULL, password_hash text NOT NULL,
 instance_admin boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), archived_at timestamptz
);
CREATE TABLE IF NOT EXISTS devices (id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, name text NOT NULL, token_hash text UNIQUE, created_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz);
CREATE TABLE IF NOT EXISTS sessions (id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, device_id uuid REFERENCES devices(id) ON DELETE SET NULL, expires_at timestamptz NOT NULL, revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS invitations (id uuid PRIMARY KEY, token_hash text NOT NULL UNIQUE, email text, role text NOT NULL CHECK (role IN ('owner','admin','editor','viewer')), space_id uuid, created_by uuid NOT NULL REFERENCES users(id), expires_at timestamptz NOT NULL, used_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS spaces (id uuid PRIMARY KEY, name text NOT NULL, icon text NOT NULL DEFAULT '◈', color text NOT NULL DEFAULT '#7466e8', description text NOT NULL DEFAULT '', version integer NOT NULL DEFAULT 1, archived_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS space_members (space_id uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, role text NOT NULL CHECK (role IN ('owner','admin','editor','viewer')), created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(space_id,user_id));
CREATE TABLE IF NOT EXISTS statuses (id uuid PRIMARY KEY, space_id uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE, name text NOT NULL, semantic text NOT NULL CHECK (semantic IN ('todo','in_progress','in_review','done','cancelled')), position integer NOT NULL, color text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(space_id,position));
CREATE TABLE IF NOT EXISTS tasks (id uuid PRIMARY KEY, space_id uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE, number integer NOT NULL, title text NOT NULL, description text NOT NULL DEFAULT '', status_id uuid NOT NULL REFERENCES statuses(id), priority smallint NOT NULL DEFAULT 2 CHECK(priority BETWEEN 0 AND 3), assignee_id uuid REFERENCES users(id), labels jsonb NOT NULL DEFAULT '[]', checklist jsonb NOT NULL DEFAULT '[]', repository text, blocked boolean NOT NULL DEFAULT false, blocked_reason text NOT NULL DEFAULT '', position double precision NOT NULL DEFAULT 1000, version integer NOT NULL DEFAULT 1, archived_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(space_id,number));
CREATE INDEX IF NOT EXISTS tasks_space_status_position_idx ON tasks(space_id,status_id,position) WHERE archived_at IS NULL;
CREATE TABLE IF NOT EXISTS comments (id uuid PRIMARY KEY, task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE, actor_id uuid NOT NULL REFERENCES users(id), body text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS activities (id uuid PRIMARY KEY, task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE, actor_id uuid NOT NULL REFERENCES users(id), kind text NOT NULL, body text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS executions (id uuid PRIMARY KEY, task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE, actor_id uuid NOT NULL REFERENCES users(id), device_id uuid NOT NULL REFERENCES devices(id), thread_id text, phase text NOT NULL CHECK (phase IN ('running','submitted','released')), summary text NOT NULL DEFAULT '', verification text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX IF NOT EXISTS one_running_execution_per_task ON executions(task_id) WHERE phase = 'running';
CREATE TABLE IF NOT EXISTS idempotency_keys (user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, key text NOT NULL, request_hash text NOT NULL, response jsonb NOT NULL, status_code integer NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,key));
CREATE TABLE IF NOT EXISTS recovery_links (id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, token_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL, used_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
`;

export async function migrate(db: Database): Promise<void> {
  await withTransaction(db, async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext('codex-taskboard:migrations'))");
    await client.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
    );
    const applied = await client.query("SELECT 1 FROM schema_migrations WHERE id='0001_initial'");
    if (!applied.rowCount) {
      await client.query(migration);
      await client.query("INSERT INTO schema_migrations (id) VALUES ('0001_initial')");
    }
    if (
      !(await client.query("SELECT 1 FROM schema_migrations WHERE id='0002_owner_integrity'"))
        .rowCount
    ) {
      await client.query(
        "CREATE UNIQUE INDEX one_owner_per_space ON space_members(space_id) WHERE role='owner'",
      );
      await client.query("INSERT INTO schema_migrations(id) VALUES ('0002_owner_integrity')");
    }
  });
}
