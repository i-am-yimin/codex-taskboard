/** Drizzle schema mirrors migration ownership; SQL transactions remain explicit in handlers. */
import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
const created = () => timestamp('created_at', { withTimezone: true }).notNull();
export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  instanceAdmin: boolean('instance_admin').notNull(),
  createdAt: created(),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
});
export const devices = pgTable('devices', {
  id: uuid('id').primaryKey(),
  userId: uuid('user_id').notNull(),
  name: text('name').notNull(),
  tokenHash: text('token_hash'),
  createdAt: created(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
});
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey(),
  userId: uuid('user_id').notNull(),
  deviceId: uuid('device_id'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: created(),
});
export const spaces = pgTable('spaces', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),
  icon: text('icon').notNull(),
  color: text('color').notNull(),
  description: text('description').notNull(),
  version: integer('version').notNull(),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  createdAt: created(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
});
export const spaceMembers = pgTable('space_members', {
  spaceId: uuid('space_id').notNull(),
  userId: uuid('user_id').notNull(),
  role: text('role').notNull(),
  createdAt: created(),
});
export const statuses = pgTable('statuses', {
  id: uuid('id').primaryKey(),
  spaceId: uuid('space_id').notNull(),
  name: text('name').notNull(),
  semantic: text('semantic').notNull(),
  position: integer('position').notNull(),
  color: text('color').notNull(),
  createdAt: created(),
});
export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey(),
  spaceId: uuid('space_id').notNull(),
  number: integer('number').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  statusId: uuid('status_id').notNull(),
  priority: smallint('priority').notNull(),
  assigneeId: uuid('assignee_id'),
  labels: jsonb('labels').notNull(),
  checklist: jsonb('checklist').notNull(),
  repository: text('repository'),
  blocked: boolean('blocked').notNull(),
  blockedReason: text('blocked_reason').notNull(),
  position: doublePrecision('position').notNull(),
  version: integer('version').notNull(),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  createdAt: created(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
});
export const comments = pgTable('comments', {
  id: uuid('id').primaryKey(),
  taskId: uuid('task_id').notNull(),
  actorId: uuid('actor_id').notNull(),
  body: text('body').notNull(),
  createdAt: created(),
});
export const activities = pgTable('activities', {
  id: uuid('id').primaryKey(),
  taskId: uuid('task_id').notNull(),
  actorId: uuid('actor_id').notNull(),
  kind: text('kind').notNull(),
  body: text('body').notNull(),
  createdAt: created(),
});
export const executions = pgTable('executions', {
  id: uuid('id').primaryKey(),
  taskId: uuid('task_id').notNull(),
  actorId: uuid('actor_id').notNull(),
  deviceId: uuid('device_id').notNull(),
  threadId: text('thread_id'),
  phase: text('phase').notNull(),
  summary: text('summary').notNull(),
  verification: text('verification').notNull(),
  createdAt: created(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
});
export const idempotencyKeys = pgTable('idempotency_keys', {
  userId: uuid('user_id').notNull(),
  key: text('key').notNull(),
  requestHash: text('request_hash').notNull(),
  response: jsonb('response').notNull(),
  statusCode: integer('status_code').notNull(),
  createdAt: created(),
});
export const invitations = pgTable('invitations', {
  id: uuid('id').primaryKey(),
  tokenHash: text('token_hash').notNull(),
  email: text('email'),
  role: text('role').notNull(),
  spaceId: uuid('space_id'),
  createdBy: uuid('created_by').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: created(),
});
export const recoveryLinks = pgTable('recovery_links', {
  id: uuid('id').primaryKey(),
  userId: uuid('user_id').notNull(),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: created(),
});
