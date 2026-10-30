/** Migrations own the SQL constraints and indexes. */
import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  boolean,
  primaryKey,
} from 'drizzle-orm/pg-core';
const time = (name: string) => timestamp(name, { withTimezone: true });
export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey(),
  userId: uuid('user_id').notNull(),
  spaceId: uuid('space_id').notNull(),
  taskId: uuid('task_id'),
  eventId: uuid('event_id').notNull(),
  kind: text('kind').notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  createdAt: time('created_at').notNull(),
  readAt: time('read_at'),
  handledAt: time('handled_at'),
  snoozedUntil: time('snoozed_until'),
  groupKey: text('group_key').notNull(),
  deliveryDeviceId: uuid('delivery_device_id'),
  deliveryClaimedAt: time('delivery_claimed_at'),
  deliveredAt: time('delivered_at'),
});
export const notificationPreferences = pgTable(
  'notification_preferences',
  {
    userId: uuid('user_id').notNull(),
    spaceId: uuid('space_id').notNull(),
    mutedUntil: time('muted_until'),
    desktopEnabled: boolean('desktop_enabled').notNull(),
    mergeWindowSeconds: integer('merge_window_seconds').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.spaceId] })],
);
export const savedFilters = pgTable('saved_filters', {
  id: uuid('id').primaryKey(),
  userId: uuid('user_id').notNull(),
  spaceId: uuid('space_id'),
  name: text('name').notNull(),
  query: jsonb('query').notNull(),
  version: integer('version').notNull(),
  createdAt: time('created_at').notNull(),
});
export const automationRules = pgTable('automation_rules', {
  id: uuid('id').primaryKey(),
  spaceId: uuid('space_id').notNull(),
  type: text('type').notNull(),
  enabled: boolean('enabled').notNull(),
  config: jsonb('config').notNull(),
  timezone: text('timezone').notNull(),
  nextRunAt: time('next_run_at').notNull(),
  version: integer('version').notNull(),
  lastError: text('last_error').notNull(),
  createdBy: uuid('created_by').notNull(),
  createdAt: time('created_at').notNull(),
});
export const automationOccurrences = pgTable('automation_occurrences', {
  id: uuid('id').primaryKey(),
  ruleId: uuid('rule_id').notNull(),
  occurrenceKey: text('occurrence_key').notNull(),
  taskId: uuid('task_id'),
  createdAt: time('created_at').notNull(),
});
