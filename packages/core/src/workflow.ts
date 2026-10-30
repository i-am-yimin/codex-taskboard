import { z } from 'zod';
export const taskFilterSchema = z
  .object({
    relation: z.enum(['responsible', 'participating', 'reviewing', 'blocked']).optional(),
    spaceId: z.uuid().optional(),
    search: z.string().max(240).optional(),
    priority: z.coerce.number().int().min(0).max(3).optional(),
    assigneeId: z.uuid().optional(),
    label: z.string().max(40).optional(),
    statusId: z.uuid().optional(),
  })
  .strict();
export type TaskFilter = z.infer<typeof taskFilterSchema>;
export const savedFilterSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    spaceId: z.uuid().nullable().default(null),
    query: taskFilterSchema,
  })
  .strict();
export const notificationPreferencesSchema = z
  .object({
    mutedUntil: z.iso.datetime({ offset: true }).nullable().default(null),
    desktopEnabled: z.boolean().default(false),
    mergeWindowSeconds: z.number().int().min(0).max(3600).default(60),
  })
  .strict();
export interface TaskNotification {
  id: string;
  userId: string;
  spaceId: string;
  taskId: string | null;
  eventId: string;
  kind: string;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  handledAt: string | null;
  snoozedUntil: string | null;
  groupKey: string;
  deliveryDeviceId?: string | null;
  deliveryClaimedAt?: string | null;
  deliveredAt?: string | null;
}
export interface SavedTaskFilter {
  id: string;
  name: string;
  spaceId: string | null;
  query: TaskFilter;
  version: number;
}
export const automationConfigSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('dependency_reminder'), config: z.object({}).strict() }).strict(),
  z
    .object({
      type: z.literal('overdue'),
      config: z
        .object({ thresholdMinutes: z.number().int().min(0).max(525600).default(0) })
        .strict(),
    })
    .strict(),
  z
    .object({
      type: z.literal('review_wait'),
      config: z.object({ thresholdMinutes: z.number().int().min(1).max(525600) }).strict(),
    })
    .strict(),
  z
    .object({
      type: z.literal('recurring'),
      config: z
        .object({
          title: z.string().trim().min(1).max(240),
          description: z.string().max(100000).default(''),
          assigneeId: z.uuid().nullable().default(null),
          reviewerId: z.uuid().nullable().default(null),
          acceptanceCriteria: z.string().max(20000).default(''),
          intervalHours: z.number().int().min(1).max(8760),
        })
        .strict(),
    })
    .strict(),
]);

export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema> & {
  userId: string;
  spaceId: string;
};
export type AutomationRule = z.infer<typeof automationConfigSchema> & {
  id: string;
  spaceId: string;
  enabled: boolean;
  timezone: string;
  nextRunAt: string;
  version: number;
  createdBy: string;
  createdAt: string;
  lastError: string;
};
export interface WorkflowMetrics {
  from: string;
  to: string;
  timezone: 'UTC';
  legacyUnknownCount: number;
  items: {
    kind: 'blocked' | 'review_wait';
    sampleCount: number;
    totalSeconds: number;
    currentCount: number;
  }[];
}
