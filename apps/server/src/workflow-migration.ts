import type pg from 'pg';
export async function migrateWorkflowServices(client: pg.PoolClient): Promise<void> {
  if (
    (await client.query("SELECT 1 FROM schema_migrations WHERE id='0006_workflow_services'"))
      .rowCount
  )
    return;
  await client.query(`
CREATE TABLE notifications(id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES users(id),space_id uuid NOT NULL REFERENCES spaces(id),task_id uuid REFERENCES tasks(id),event_id uuid NOT NULL,kind text NOT NULL,title text NOT NULL,body text NOT NULL DEFAULT '',created_at timestamptz NOT NULL DEFAULT now(),read_at timestamptz,handled_at timestamptz,snoozed_until timestamptz,group_key text NOT NULL,delivery_device_id uuid REFERENCES devices(id),delivery_claimed_at timestamptz,delivered_at timestamptz,UNIQUE(user_id,event_id,kind));
CREATE INDEX notifications_user_created_idx ON notifications(user_id,created_at DESC,id);
CREATE TABLE notification_preferences(user_id uuid NOT NULL REFERENCES users(id),space_id uuid NOT NULL REFERENCES spaces(id),muted_until timestamptz,desktop_enabled boolean NOT NULL DEFAULT false,merge_window_seconds integer NOT NULL DEFAULT 60 CHECK(merge_window_seconds BETWEEN 0 AND 3600),PRIMARY KEY(user_id,space_id));
CREATE TABLE saved_filters(id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES users(id),space_id uuid REFERENCES spaces(id),name text NOT NULL,query jsonb NOT NULL,version integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE automation_rules(id uuid PRIMARY KEY,space_id uuid NOT NULL REFERENCES spaces(id),type text NOT NULL CHECK(type IN ('dependency_reminder','overdue','review_wait','recurring')),enabled boolean NOT NULL DEFAULT true,config jsonb NOT NULL,timezone text NOT NULL DEFAULT 'UTC',next_run_at timestamptz NOT NULL,version integer NOT NULL DEFAULT 1,last_error text NOT NULL DEFAULT '',created_by uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX automation_due_idx ON automation_rules(next_run_at) WHERE enabled;
CREATE TABLE automation_occurrences(id uuid PRIMARY KEY,rule_id uuid NOT NULL REFERENCES automation_rules(id),occurrence_key text NOT NULL,task_id uuid REFERENCES tasks(id),created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(rule_id,occurrence_key));
INSERT INTO schema_migrations(id) VALUES('0006_workflow_services');
`);
}
