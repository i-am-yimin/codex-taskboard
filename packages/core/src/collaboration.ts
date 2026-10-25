import { z } from 'zod';

export const collaborationTaskFields = {
  reviewerId: z.uuid().nullable().default(null),
  parentTaskId: z.uuid().nullable().default(null),
  requiredForParent: z.boolean().default(true),
  acceptanceCriteria: z.string().max(20000).default(''),
  dueAt: z.iso.datetime({ offset: true }).nullable().default(null),
};
export const participantSchema = z
  .object({
    responsibility: z.string().trim().max(2000).default(''),
    progress: z.number().int().min(0).max(100).default(0),
    summary: z.string().max(10000).default(''),
    blockedReason: z.string().max(2000).default(''),
  })
  .strict();
export type TaskParticipant = z.infer<typeof participantSchema> & {
  taskId: string;
  userId: string;
  updatedAt: string;
};
export interface TaskClaim {
  id: string;
  taskId: string;
  actorId: string;
  deviceId: string;
  claimedAt: string;
  releasedAt: string | null;
  releaseReason: string;
}
export interface TaskDependency {
  taskId: string;
  dependsOnTaskId: string;
}
export const artifactSchema = z
  .object({
    kind: z.enum(['pr', 'commit', 'screenshot', 'document', 'test', 'other']),
    title: z.string().trim().min(1).max(240),
    url: z
      .url()
      .refine((value) => new URL(value).protocol === 'https:', '仅支持 HTTPS')
      .nullable()
      .default(null),
    text: z.string().max(20000).default(''),
    verificationScope: z.string().max(10000).default(''),
    limitations: z.string().max(10000).default(''),
    executionId: z.uuid().nullable().default(null),
  })
  .strict();
export type TaskArtifact = z.infer<typeof artifactSchema> & {
  id: string;
  taskId: string;
  createdBy: string;
  createdAt: string;
  deletedAt: string | null;
};
const splitChildSchema = z
  .object({
    title: z.string().trim().min(1).max(240),
    description: z.string().max(100000).default(''),
    assigneeId: z.uuid().nullable().default(null),
    reviewerId: z.uuid().nullable().default(null),
    acceptanceCriteria: z.string().max(20000).default(''),
    requiredForParent: z.boolean().default(true),
  })
  .strict();
export const proposalSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('split'),
      payload: z.object({ children: z.array(splitChildSchema).min(1).max(30) }).strict(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('requirements'),
      payload: z
        .object({
          description: z.string().max(100000),
          acceptanceCriteria: z.string().max(20000),
          impact: z.string().min(1).max(10000),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('decision'),
      payload: z.object({ body: z.string().trim().min(1).max(20000) }).strict(),
    })
    .strict(),
]);
export type TaskProposal = z.infer<typeof proposalSchema> & {
  id: string;
  taskId: string;
  baseTaskVersion: number;
  baseRequirementsVersion: number;
  source: 'human' | 'agent';
  confirmedPayload?: unknown;
  state: 'proposed' | 'confirmed' | 'rejected';
  proposedBy: string;
  confirmedBy: string | null;
  confirmedAt: string | null;
  createdAt: string;
};
export interface TaskDecision {
  id: string;
  taskId: string;
  proposalId: string | null;
  body: string;
  requirementsVersion: number;
  confirmedBy: string;
  createdAt: string;
}
export interface TaskReview {
  id: string;
  taskId: string;
  reviewerId: string;
  outcome: 'accepted' | 'returned';
  reason: string;
  requirementsVersion: number;
  taskVersion: number;
  createdAt: string;
}
export interface TaskRun {
  id: string;
  taskId: string;
  claimId: string;
  actorId: string;
  deviceId: string;
  runner: 'codex-cli' | 'claude-code' | 'manual';
  permissionMode?: 'read-only' | 'workspace-write';
  phase:
    'starting' | 'running' | 'cancel_requested' | 'cancelled' | 'succeeded' | 'failed' | 'unknown';
  externalSessionId: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  lastHeartbeatAt: string | null;
  failureReason: string;
  resolvedBy?: string | null;
  resolvedAt?: string | null;
  resolutionReason?: string;
}
export interface WorkflowEvent {
  eventId: string;
  spaceId: string;
  taskId: string;
  actorId: string;
  kind: string;
  occurredAt: string;
  requirementsVersion: number;
  affectedTaskIds: string[];
}
