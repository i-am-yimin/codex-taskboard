import type pg from 'pg';

export async function migrateCollaboration(client: pg.PoolClient): Promise<void> {
  if (
    (await client.query("SELECT 1 FROM schema_migrations WHERE id='0005_collaborative_workflows'"))
      .rowCount
  )
    return;
  await client.query(`
ALTER TABLE tasks ADD COLUMN reviewer_id uuid REFERENCES users(id), ADD COLUMN parent_task_id uuid REFERENCES tasks(id), ADD COLUMN required_for_parent boolean NOT NULL DEFAULT true, ADD COLUMN requirements_version integer NOT NULL DEFAULT 1, ADD COLUMN acceptance_criteria text NOT NULL DEFAULT '', ADD COLUMN due_at timestamptz;
CREATE INDEX tasks_parent_idx ON tasks(parent_task_id);
CREATE TABLE task_participants(task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,user_id uuid NOT NULL REFERENCES users(id),responsibility text NOT NULL DEFAULT '',progress integer NOT NULL DEFAULT 0 CHECK(progress BETWEEN 0 AND 100),summary text NOT NULL DEFAULT '',blocked_reason text NOT NULL DEFAULT '',updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(task_id,user_id));
INSERT INTO task_participants(task_id,user_id,responsibility) SELECT id,assignee_id,'负责实施' FROM tasks WHERE assignee_id IS NOT NULL;
CREATE TABLE task_dependencies(task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,depends_on_task_id uuid NOT NULL REFERENCES tasks(id),PRIMARY KEY(task_id,depends_on_task_id),CHECK(task_id<>depends_on_task_id));
CREATE TABLE task_claims(id uuid PRIMARY KEY,task_id uuid NOT NULL REFERENCES tasks(id),actor_id uuid NOT NULL REFERENCES users(id),device_id uuid NOT NULL REFERENCES devices(id),claimed_at timestamptz NOT NULL DEFAULT now(),released_at timestamptz,release_reason text NOT NULL DEFAULT '');
CREATE UNIQUE INDEX one_active_claim_per_task ON task_claims(task_id) WHERE released_at IS NULL;
INSERT INTO task_claims(id,task_id,actor_id,device_id,claimed_at) SELECT id,task_id,actor_id,device_id,created_at FROM executions WHERE phase='running';
ALTER TABLE executions ADD COLUMN claim_id uuid REFERENCES task_claims(id),ADD COLUMN agent_kind text NOT NULL DEFAULT 'legacy',ADD COLUMN branch text NOT NULL DEFAULT '',ADD COLUMN pr_url text,ADD COLUMN commit_sha text NOT NULL DEFAULT '',ADD COLUMN handoff_summary text NOT NULL DEFAULT '',ADD COLUMN blockers text NOT NULL DEFAULT '',ADD COLUMN next_step text NOT NULL DEFAULT '',ADD COLUMN limitations text NOT NULL DEFAULT '',ADD COLUMN requirements_version integer NOT NULL DEFAULT 1;
UPDATE executions SET claim_id=id WHERE phase='running';
ALTER TABLE executions DROP CONSTRAINT executions_phase_check;
ALTER TABLE executions ADD CONSTRAINT executions_phase_check CHECK(phase IN ('running','claimed','submitted','released'));
UPDATE executions SET phase='claimed' WHERE phase='running';
CREATE TABLE task_runs(id uuid PRIMARY KEY,task_id uuid NOT NULL REFERENCES tasks(id),claim_id uuid NOT NULL REFERENCES task_claims(id),actor_id uuid NOT NULL REFERENCES users(id),device_id uuid NOT NULL REFERENCES devices(id),runner text NOT NULL CHECK(runner IN ('codex-cli','claude-code','manual')),phase text NOT NULL CHECK(phase IN ('starting','running','cancel_requested','cancelled','succeeded','failed','unknown')),external_session_id text,started_at timestamptz,finished_at timestamptz,last_heartbeat_at timestamptz,failure_reason text NOT NULL DEFAULT '');
CREATE UNIQUE INDEX one_active_run_per_claim ON task_runs(claim_id) WHERE phase IN ('starting','running','cancel_requested');
CREATE TABLE task_artifacts(id uuid PRIMARY KEY,task_id uuid NOT NULL REFERENCES tasks(id),execution_id uuid REFERENCES executions(id),kind text NOT NULL CHECK(kind IN ('pr','commit','screenshot','document','test','other')),title text NOT NULL,url text,text text NOT NULL DEFAULT '',verification_scope text NOT NULL DEFAULT '',limitations text NOT NULL DEFAULT '',created_by uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),deleted_at timestamptz);
CREATE TABLE task_proposals(id uuid PRIMARY KEY,task_id uuid NOT NULL REFERENCES tasks(id),kind text NOT NULL CHECK(kind IN ('split','requirements','decision')),payload jsonb NOT NULL,base_task_version integer NOT NULL,base_requirements_version integer NOT NULL,source text NOT NULL CHECK(source IN ('human','agent')),confirmed_payload jsonb,state text NOT NULL DEFAULT 'proposed' CHECK(state IN ('proposed','confirmed','rejected')),proposed_by uuid NOT NULL REFERENCES users(id),confirmed_by uuid REFERENCES users(id),confirmed_at timestamptz,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE task_decisions(id uuid PRIMARY KEY,task_id uuid NOT NULL REFERENCES tasks(id),proposal_id uuid REFERENCES task_proposals(id),body text NOT NULL,requirements_version integer NOT NULL,confirmed_by uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE task_reviews(id uuid PRIMARY KEY,task_id uuid NOT NULL REFERENCES tasks(id),reviewer_id uuid NOT NULL REFERENCES users(id),outcome text NOT NULL CHECK(outcome IN ('accepted','returned')),reason text NOT NULL,requirements_version integer NOT NULL,task_version integer NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE task_state_intervals(id uuid PRIMARY KEY,task_id uuid NOT NULL REFERENCES tasks(id),kind text NOT NULL CHECK(kind IN ('blocked','review_wait')),started_at timestamptz NOT NULL DEFAULT now(),ended_at timestamptz,precision text NOT NULL DEFAULT 'exact' CHECK(precision IN ('exact','legacy_unknown')));
CREATE UNIQUE INDEX one_open_interval ON task_state_intervals(task_id,kind) WHERE ended_at IS NULL;
INSERT INTO task_state_intervals(id,task_id,kind,started_at,precision) SELECT gen_random_uuid(),id,'blocked',updated_at,'legacy_unknown' FROM tasks WHERE blocked;
INSERT INTO task_state_intervals(id,task_id,kind,started_at,precision) SELECT gen_random_uuid(),t.id,'review_wait',t.updated_at,'legacy_unknown' FROM tasks t JOIN statuses s ON s.id=t.status_id WHERE s.semantic='in_review';
INSERT INTO schema_migrations(id) VALUES('0005_collaborative_workflows');
`);
}
