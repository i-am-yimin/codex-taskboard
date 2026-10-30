/** SQL migrations own constraints; these definitions mirror their persisted columns. */
import { pgTable, uuid, text, integer, timestamp, jsonb, primaryKey } from 'drizzle-orm/pg-core';
const time = (name: string) => timestamp(name, { withTimezone: true });
export const taskParticipants = pgTable(
  'task_participants',
  {
    taskId: uuid('task_id').notNull(),
    userId: uuid('user_id').notNull(),
    responsibility: text('responsibility').notNull(),
    progress: integer('progress').notNull(),
    summary: text('summary').notNull(),
    blockedReason: text('blocked_reason').notNull(),
    updatedAt: time('updated_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.taskId, t.userId] })],
);
export const taskDependencies = pgTable(
  'task_dependencies',
  { taskId: uuid('task_id').notNull(), dependsOnTaskId: uuid('depends_on_task_id').notNull() },
  (t) => [primaryKey({ columns: [t.taskId, t.dependsOnTaskId] })],
);
export const taskClaims = pgTable('task_claims', {
  id: uuid('id').primaryKey(),
  taskId: uuid('task_id').notNull(),
  actorId: uuid('actor_id').notNull(),
  deviceId: uuid('device_id').notNull(),
  claimedAt: time('claimed_at').notNull(),
  releasedAt: time('released_at'),
  releaseReason: text('release_reason').notNull(),
});
export const taskRuns = pgTable('task_runs', {
  permissionMode: text('permission_mode').notNull(),
  id: uuid('id').primaryKey(),
  taskId: uuid('task_id').notNull(),
  claimId: uuid('claim_id').notNull(),
  actorId: uuid('actor_id').notNull(),
  deviceId: uuid('device_id').notNull(),
  runner: text('runner').notNull(),
  phase: text('phase').notNull(),
  externalSessionId: text('external_session_id'),
  startedAt: time('started_at'),
  finishedAt: time('finished_at'),
  lastHeartbeatAt: time('last_heartbeat_at'),
  failureReason: text('failure_reason').notNull(),
  resolvedBy: uuid('resolved_by'),
  resolvedAt: time('resolved_at'),
  resolutionReason: text('resolution_reason').notNull(),
});
export const taskArtifacts = pgTable('task_artifacts', {
  id: uuid('id').primaryKey(),
  taskId: uuid('task_id').notNull(),
  executionId: uuid('execution_id'),
  kind: text('kind').notNull(),
  title: text('title').notNull(),
  url: text('url'),
  text: text('text').notNull(),
  verificationScope: text('verification_scope').notNull(),
  limitations: text('limitations').notNull(),
  createdBy: uuid('created_by').notNull(),
  createdAt: time('created_at').notNull(),
  deletedAt: time('deleted_at'),
});
export const taskProposals = pgTable('task_proposals', {
  id: uuid('id').primaryKey(),
  taskId: uuid('task_id').notNull(),
  kind: text('kind').notNull(),
  payload: jsonb('payload').notNull(),
  source: text('source').notNull(),
  confirmedPayload: jsonb('confirmed_payload'),
  baseTaskVersion: integer('base_task_version').notNull(),
  baseRequirementsVersion: integer('base_requirements_version').notNull(),
  state: text('state').notNull(),
  proposedBy: uuid('proposed_by').notNull(),
  confirmedBy: uuid('confirmed_by'),
  confirmedAt: time('confirmed_at'),
  createdAt: time('created_at').notNull(),
});
export const taskDecisions = pgTable('task_decisions', {
  id: uuid('id').primaryKey(),
  taskId: uuid('task_id').notNull(),
  proposalId: uuid('proposal_id'),
  body: text('body').notNull(),
  requirementsVersion: integer('requirements_version').notNull(),
  confirmedBy: uuid('confirmed_by').notNull(),
  createdAt: time('created_at').notNull(),
});
export const taskReviews = pgTable('task_reviews', {
  id: uuid('id').primaryKey(),
  taskId: uuid('task_id').notNull(),
  reviewerId: uuid('reviewer_id').notNull(),
  outcome: text('outcome').notNull(),
  reason: text('reason').notNull(),
  requirementsVersion: integer('requirements_version').notNull(),
  taskVersion: integer('task_version').notNull(),
  createdAt: time('created_at').notNull(),
});
export const taskStateIntervals = pgTable('task_state_intervals', {
  id: uuid('id').primaryKey(),
  taskId: uuid('task_id').notNull(),
  kind: text('kind').notNull(),
  startedAt: time('started_at').notNull(),
  endedAt: time('ended_at'),
  precision: text('precision').notNull(),
});
