import type { PoolClient } from 'pg';

export async function migrateAccounts(client: PoolClient): Promise<void> {
  if (
    (await client.query("SELECT 1 FROM schema_migrations WHERE id='0010_account_center'")).rowCount
  )
    return;
  await client.query(`
    ALTER TABLE users ADD COLUMN profile_version integer NOT NULL DEFAULT 1,
      ADD COLUMN contacts jsonb NOT NULL DEFAULT '{"phone":{"value":"","visibility":"private"},"wechat":{"value":"","visibility":"private"},"qq":{"value":"","visibility":"private"}}',
      ADD COLUMN email_verified_at timestamptz,
      ADD COLUMN avatar_version integer NOT NULL DEFAULT 0;
    ALTER TABLE devices ADD COLUMN last_active_at timestamptz;
    ALTER TABLE invitations ADD COLUMN revoked_at timestamptz;
    CREATE TABLE user_avatars (
      user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      image bytea NOT NULL CHECK(octet_length(image)<=131072)
    );
    CREATE TABLE account_verifications (
      id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id),
      kind text NOT NULL CHECK(kind IN ('verify_email','change_email')),
      email text NOT NULL, token_hash text NOT NULL UNIQUE, session_id uuid REFERENCES sessions(id),
      expires_at timestamptz NOT NULL, used_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE smtp_settings (id integer PRIMARY KEY CHECK(id=1), config jsonb NOT NULL, password_encrypted text);
    CREATE TABLE mail_outbox (
      id uuid PRIMARY KEY, payload_encrypted text,
      kind text NOT NULL, user_id uuid REFERENCES users(id),
      status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','failed')),
      attempts integer NOT NULL DEFAULT 0, next_attempt_at timestamptz NOT NULL DEFAULT now(),
      created_at timestamptz NOT NULL DEFAULT now(), accepted_at timestamptz,
      last_error text
    );
    CREATE INDEX mail_outbox_pending ON mail_outbox(next_attempt_at) WHERE status='pending';
    CREATE TABLE space_takeovers (
      id uuid PRIMARY KEY, space_id uuid NOT NULL REFERENCES spaces(id),
      user_id uuid NOT NULL REFERENCES users(id), session_id uuid NOT NULL REFERENCES sessions(id),
      reason text NOT NULL, expires_at timestamptz NOT NULL,
      revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX space_takeovers_session ON space_takeovers(session_id,space_id);
    CREATE TABLE account_audit (
      id uuid PRIMARY KEY, actor_id uuid REFERENCES users(id), target_id text,
      action text NOT NULL, outcome text NOT NULL DEFAULT 'success',
      reason text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX account_audit_created ON account_audit(created_at DESC,id);
    INSERT INTO schema_migrations(id) VALUES ('0010_account_center');
  `);
}
