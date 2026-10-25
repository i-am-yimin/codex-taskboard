/** Public remote API contract; local runner paths/credentials are intentionally absent. */
import { z } from 'zod';
import {
  taskSchema,
  taskPatchSchema,
  participantSchema,
  artifactSchema,
  proposalSchema,
  taskFilterSchema,
  savedFilterSchema,
  notificationPreferencesSchema,
  automationConfigSchema,
  runStartSchema,
  runEventSchema,
} from '@taskboard/core';
type Schema = Record<string, unknown>;
const uuid: Schema = { type: 'string', format: 'uuid' };
const nullableId: Schema = { type: ['string', 'null'], format: 'uuid' };
const date: Schema = { type: 'string', format: 'date-time' };
const nullableDate: Schema = { type: ['string', 'null'], format: 'date-time' };
const string: Schema = { type: 'string' };
const integer: Schema = { type: 'integer', minimum: 1 };
const ref = (name: string): Schema => ({ $ref: `#/components/schemas/${name}` });
const array = (schema: Schema): Schema => ({ type: 'array', items: schema });
const object = (
  properties: Record<string, Schema>,
  required = Object.keys(properties),
): Schema => ({ type: 'object', properties, required });
const nullable = (schema: Schema): Schema => ({ anyOf: [schema, { type: 'null' }] });
const input = (schema: z.ZodType): Schema =>
  z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' });
const taskInput = taskSchema
  .omit({ repository: true })
  .extend({ repository: z.string().max(2000).nullable().default(null) });
const taskPatch = taskPatchSchema
  .omit({ repository: true })
  .extend({ repository: z.string().max(2000).nullable().optional() });
const stamp = { createdAt: date };
const taskProperties = {
  id: uuid,
  spaceId: uuid,
  number: integer,
  title: string,
  description: string,
  statusId: uuid,
  priority: { type: 'integer', minimum: 0, maximum: 3 },
  assigneeId: nullableId,
  reviewerId: nullableId,
  parentTaskId: nullableId,
  requiredForParent: { type: 'boolean' },
  requirementsVersion: integer,
  acceptanceCriteria: string,
  dueAt: nullableDate,
  labels: array(string),
  checklist: array(object({ id: uuid, text: string, checked: { type: 'boolean' } })),
  repository: { type: ['string', 'null'] },
  blocked: { type: 'boolean' },
  blockedReason: string,
  position: { type: 'number' },
  version: integer,
  archived: { type: 'boolean' },
  updatedAt: date,
  ...stamp,
};
const task = object(taskProperties);
const execution = object({
  id: uuid,
  taskId: uuid,
  actorId: uuid,
  deviceId: uuid,
  threadId: { type: ['string', 'null'] },
  phase: {
    enum: ['running', 'claimed', 'submitted', 'released'],
    description: 'claimed是业务领取；running仅兼容旧记录，不证明OS进程运行',
  },
  claimId: nullableId,
  agentKind: string,
  summary: string,
  verification: string,
  branch: string,
  prUrl: {
    type: ['string', 'null'],
    description: '新提交非空时仅允许 HTTPS；历史值未迁移，客户端展示链接仍须校验协议',
  },
  commitSha: string,
  handoffSummary: string,
  blockers: string,
  nextStep: string,
  limitations: string,
  requirementsVersion: integer,
  ...stamp,
});
const artifact = object({
  id: uuid,
  taskId: uuid,
  executionId: nullableId,
  kind: { enum: ['pr', 'commit', 'screenshot', 'document', 'test', 'other'] },
  title: string,
  url: { type: ['string', 'null'], description: '非空时仅允许HTTPS' },
  text: string,
  verificationScope: string,
  limitations: string,
  createdBy: uuid,
  ...stamp,
  deletedAt: nullableDate,
});
const proposal = object({
  id: uuid,
  taskId: uuid,
  kind: { enum: ['split', 'requirements', 'decision'] },
  payload: { type: 'object' },
  source: { enum: ['human', 'agent'], description: '由服务端认证上下文产生，客户端不得指定' },
  confirmedPayload: { type: ['object', 'null'] },
  baseTaskVersion: integer,
  baseRequirementsVersion: integer,
  state: { enum: ['proposed', 'confirmed', 'rejected'] },
  proposedBy: uuid,
  confirmedBy: nullableId,
  confirmedAt: nullableDate,
  ...stamp,
});
const run = object({
  id: uuid,
  taskId: uuid,
  claimId: uuid,
  actorId: uuid,
  deviceId: uuid,
  runner: { enum: ['codex-cli', 'claude-code', 'manual'] },
  permissionMode: { enum: ['read-only', 'workspace-write'] },
  phase: {
    enum: [
      'starting',
      'running',
      'cancel_requested',
      'cancelled',
      'succeeded',
      'failed',
      'unknown',
    ],
  },
  externalSessionId: { type: ['string', 'null'] },
  startedAt: nullableDate,
  finishedAt: nullableDate,
  lastHeartbeatAt: nullableDate,
  failureReason: string,
  resolvedBy: nullableId,
  resolvedAt: nullableDate,
  resolutionReason: string,
});
const notification = object(
  {
    id: uuid,
    userId: uuid,
    spaceId: uuid,
    taskId: nullableId,
    eventId: uuid,
    kind: string,
    title: string,
    body: string,
    ...stamp,
    readAt: nullableDate,
    handledAt: nullableDate,
    snoozedUntil: nullableDate,
    groupKey: string,
    deliveryDeviceId: nullableId,
    deliveryClaimedAt: nullableDate,
    deliveredAt: nullableDate,
  },
  [
    'id',
    'userId',
    'spaceId',
    'kind',
    'title',
    'createdAt',
    'readAt',
    'handledAt',
    'snoozedUntil',
    'groupKey',
  ],
);
const submit = z
  .object({
    summary: z.string().trim().min(1).max(20000),
    verification: z.string().trim().min(1).max(20000),
    requirementsVersion: z.number().int().positive(),
    handoffSummary: z.string().max(20000).default(''),
    blockers: z.string().max(10000).default(''),
    nextStep: z.string().max(10000).default(''),
    limitations: z.string().max(10000).default(''),
    branch: z.string().max(500).default(''),
    prUrl: artifactSchema.shape.url.describe(
      '非空时 URL 协议必须为 HTTPS，与成果 url 使用相同校验',
    ),
    commitSha: z.string().max(100).default(''),
    artifactIds: z.array(z.uuid()).max(100).default([]),
  })
  .strict();
const progress = z
  .object({
    progress: z.number().int().min(0).max(100),
    summary: z.string().max(10000),
    blocked: z.boolean().optional(),
    blockedReason: z.string().max(2000).optional(),
  })
  .strict();
const decision = object({
  id: uuid,
  taskId: uuid,
  proposalId: nullableId,
  body: string,
  requirementsVersion: integer,
  confirmedBy: uuid,
  ...stamp,
});
const review = object({
  id: uuid,
  taskId: uuid,
  reviewerId: uuid,
  outcome: { enum: ['accepted', 'returned'] },
  reason: string,
  requirementsVersion: integer,
  taskVersion: integer,
  ...stamp,
});
const participant = object({
  taskId: uuid,
  userId: uuid,
  responsibility: string,
  progress: { type: 'integer', minimum: 0, maximum: 100 },
  summary: string,
  blockedReason: string,
  updatedAt: date,
});
const claim = object({
  id: uuid,
  taskId: uuid,
  actorId: uuid,
  deviceId: uuid,
  claimedAt: date,
  releasedAt: nullableDate,
  releaseReason: string,
});
const metrics = object({
  from: date,
  to: date,
  timezone: { const: 'UTC' },
  legacyUnknownCount: { type: 'integer', minimum: 0 },
  items: array(
    object({
      kind: { enum: ['blocked', 'review_wait'] },
      sampleCount: { type: 'integer', minimum: 0 },
      totalSeconds: { type: 'number', minimum: 0 },
      currentCount: { type: 'integer', minimum: 0 },
    }),
  ),
});
const ruleInput = object(
  {
    type: { enum: ['dependency_reminder', 'overdue', 'review_wait', 'recurring'] },
    config: { type: 'object', description: '严格字段取决于type，见AutomationConfig' },
    enabled: { type: 'boolean' },
    timezone: { type: 'string', description: '有效IANA时区，仅显示；周期按绝对intervalHours推进' },
    nextRunAt: date,
  },
  ['type', 'config'],
);
const errorCodes = [
  'FORBIDDEN',
  'NOT_FOUND',
  'AGENT_SCOPE_FORBIDDEN',
  'AGENT_CANNOT_CONFIRM',
  'RESPONSIBLE_ONLY',
  'REVIEWER_ONLY',
  'INVALID_REVIEWER',
  'VERSION_REQUIRED',
  'VERSION_CONFLICT',
  'IDEMPOTENCY_REQUIRED',
  'IDEMPOTENCY_MISMATCH',
  'TRANSITION_REQUIRED',
  'INVALID_TRANSITION',
  'TASK_NOT_ACTIVE',
  'TASK_ARCHIVED',
  'TASK_BLOCKED',
  'TASK_ALREADY_CLAIMED',
  'NO_ACTIVE_CLAIM',
  'LEAF_REQUIRED',
  'DEPENDENCIES_NOT_DONE',
  'REQUIRED_CHILDREN_NOT_DONE',
  'DEPENDENCY_CYCLE',
  'CROSS_SPACE_RELATION',
  'PARENT_NOT_ACTIVE',
  'REVIEWER_REQUIRED',
  'REQUIREMENTS_CHANGED',
  'REQUIREMENTS_PROPOSAL_REQUIRED',
  'PROPOSAL_STALE',
  'RUN_STATE_UNCONFIRMED',
  'CLAIM_OWNER_REQUIRED',
  'INVALID_RUN_TRANSITION',
  'RUN_SESSION_CONFLICT',
  'RUNNER_UNSUPPORTED',
  'NOTIFICATION_MUTED',
  'NOTIFICATION_HANDLED',
  'DELIVERY_CLAIMED',
  'DELIVERY_LEASE_EXPIRED',
  'VALIDATION_ERROR',
];
export const collaborationSchemas: Record<string, Schema> = {
  TaskInput: input(taskInput),
  TaskPatch: input(taskPatch),
  Task: task,
  Execution: execution,
  TaskParticipant: participant,
  ParticipantInput: input(participantSchema),
  TaskDependency: object({ taskId: uuid, dependsOnTaskId: uuid }),
  TaskClaim: claim,
  TaskArtifact: artifact,
  ArtifactInput: input(artifactSchema),
  ArtifactPatchInput: input(
    z
      .object({
        kind: artifactSchema.shape.kind.optional(),
        title: artifactSchema.shape.title.optional(),
        url: artifactSchema.shape.url.unwrap().optional(),
        text: artifactSchema.shape.text.unwrap().optional(),
        verificationScope: artifactSchema.shape.verificationScope.unwrap().optional(),
        limitations: artifactSchema.shape.limitations.unwrap().optional(),
      })
      .strict(),
  ),
  TaskProposal: proposal,
  ProposalInput: input(proposalSchema),
  TaskDecision: decision,
  TaskReview: review,
  TaskRun: run,
  RunStartInput: input(runStartSchema),
  RunEventInput: input(runEventSchema),
  SubmitInput: input(submit),
  ProgressInput: input(progress),
  TaskFilter: input(taskFilterSchema),
  SavedFilterInput: input(savedFilterSchema),
  SavedFilter: object({
    id: uuid,
    userId: uuid,
    spaceId: nullableId,
    name: string,
    query: ref('TaskFilter'),
    version: integer,
    ...stamp,
  }),
  Notification: notification,
  NotificationPreferencesInput: input(notificationPreferencesSchema),
  NotificationPreferences: object({
    userId: uuid,
    spaceId: uuid,
    mutedUntil: nullableDate,
    desktopEnabled: { type: 'boolean' },
    mergeWindowSeconds: { type: 'integer', minimum: 0, maximum: 3600 },
  }),
  AutomationConfig: input(automationConfigSchema),
  AutomationRuleInput: ruleInput,
  AutomationRule: object({
    id: uuid,
    spaceId: uuid,
    type: { enum: ['dependency_reminder', 'overdue', 'review_wait', 'recurring'] },
    config: { type: 'object' },
    enabled: { type: 'boolean' },
    timezone: string,
    nextRunAt: date,
    version: integer,
    lastError: string,
    createdBy: uuid,
    ...stamp,
  }),
  WorkflowMetrics: metrics,
  TaskDetail: object({
    task: ref('Task'),
    activities: array(
      object({
        id: uuid,
        taskId: uuid,
        actorId: uuid,
        actorName: string,
        kind: string,
        body: string,
        ...stamp,
      }),
    ),
    executions: array(ref('Execution')),
    participants: array(ref('TaskParticipant')),
    parent: nullable(ref('Task')),
    children: array(ref('Task')),
    dependencies: array(ref('TaskDependency')),
    claims: array(ref('TaskClaim')),
    runs: array(ref('TaskRun')),
    artifacts: array(ref('TaskArtifact')),
    proposals: array(ref('TaskProposal')),
    decisions: array(ref('TaskDecision')),
    reviews: array(ref('TaskReview')),
  }),
  WorkflowError: object({
    error: object(
      { code: { type: 'string', examples: errorCodes }, message: string, details: {} },
      ['code', 'message'],
    ),
  }),
};
const session = [{ session: [] }];
const agents = [{ session: [] }, { deviceToken: [] }];
const response = (schema: Schema, description = '成功') => ({
  description,
  content: { 'application/json': { schema } },
});
const envelope = (schema: Schema) => object({ data: schema });
const pathParams = (path: string) =>
  [...path.matchAll(/\{([^}]+)\}/g)].map((match) => ({
    in: 'path',
    name: match[1],
    required: true,
    schema: uuid,
  }));
const key = {
  in: 'header',
  name: 'Idempotency-Key',
  required: true,
  schema: { type: 'string', minLength: 1, maxLength: 200 },
};
const version = { in: 'header', name: 'If-Match', required: true, schema: integer };
const query = (name: string, schema: Schema) => ({ in: 'query', name, required: false, schema });
const errors = {
  400: response(ref('WorkflowError'), '无效请求'),
  401: response(ref('WorkflowError'), '未登录/设备撤销'),
  403: response(ref('WorkflowError'), '当前空间权限或任务责任不足；Agent不可代替人类确认'),
  404: response(ref('WorkflowError'), '对象不存在或不可见'),
  409: response(ref('WorkflowError'), '版本/领取/依赖/提案/运行/投递轮次冲突'),
  422: response(ref('WorkflowError'), '输入或状态语义无效'),
  428: response(ref('WorkflowError'), '缺少幂等键或任务版本'),
};
function operation(
  path: string,
  summary: string,
  result: Schema,
  options: {
    body?: Schema;
    write?: boolean;
    version?: boolean;
    human?: boolean;
    status?: number;
    query?: Schema[];
    description?: string;
  } = {},
) {
  return {
    summary,
    description: options.description,
    security: options.human ? session : agents,
    parameters: [
      ...pathParams(path),
      ...(options.write ? [key] : []),
      ...(options.version ? [version] : []),
      ...(options.query ?? []),
    ],
    ...(options.body
      ? {
          requestBody: {
            required: true,
            content: { 'application/json': { schema: options.body } },
          },
        }
      : {}),
    responses: { [options.status ?? 200]: response(envelope(result)), ...errors },
  };
}
const paths: Record<string, Record<string, unknown>> = {};
const add = (
  path: string,
  method: string,
  summary: string,
  result: Schema,
  options: Parameters<typeof operation>[3] = {},
) => {
  paths[path] ??= {};
  paths[path][method] = operation(path, summary, result, options);
};
const empty: Schema = { type: 'object', additionalProperties: false };
const taskResult = ref('Task');
const commandResult = object({ task: taskResult, execution: ref('Execution') });
add('/spaces/{spaceId}/tasks', 'get', '按当前空间权限读取任务', array(taskResult), {
  query: [
    query('statusId', uuid),
    query('assigneeId', uuid),
    query('priority', { type: 'integer', minimum: 0, maximum: 3 }),
    query('query', string),
  ],
});
add('/spaces/{spaceId}/tasks', 'post', '创建待办任务，未指定总负责人时默认创建者', taskResult, {
  body: ref('TaskInput'),
  write: true,
  status: 201,
  description:
    '新任务必须使用todo语义的状态。指定验收人/父任务需人类；空间角色始终是任务角色的权限上限。',
});
add('/tasks/{taskId}', 'get', '读取有权限的当前任务', taskResult);
add('/tasks/{taskId}', 'patch', '更新任务字段或同语义列位置；语义变化必须使用命令', taskResult, {
  body: ref('TaskPatch'),
  write: true,
  version: true,
  description:
    'done不可PATCH跳转；确认后的需求用提案修改。终态不可修改阻塞；归档仅可PATCH {archived:false}恢复。',
});
add(
  '/tasks/{taskId}/detail',
  'get',
  '任务关系、责任、成果、提案、验收与执行完整详情',
  ref('TaskDetail'),
);
add('/tasks/{taskId}/children', 'post', '人类总负责人创建独立子任务', taskResult, {
  body: ref('TaskInput'),
  write: true,
  version: true,
  human: true,
});
add(
  '/tasks/{taskId}/participants/{userId}',
  'put',
  '分配职责或更新本人进度',
  ref('TaskParticipant'),
  {
    body: ref('ParticipantInput'),
    write: true,
    version: true,
    human: true,
    description:
      '职责分配需总负责人/admin；本人editor可报已有职责进度；viewer不会因任务角色获得写权限。',
  },
);
add(
  '/tasks/{taskId}/participants/{userId}',
  'delete',
  '总负责人移除参与职责',
  object({ deleted: { const: true } }),
  { write: true, version: true, human: true },
);
for (const method of ['put', 'delete'])
  add(
    '/tasks/{taskId}/dependencies/{dependencyId}',
    method,
    method === 'put' ? '添加同空间依赖并拒绝混合等待环' : '移除依赖',
    method === 'put' ? ref('TaskDependency') : object({ deleted: { const: true } }),
    { write: true, version: true, human: true },
  );
add('/tasks/{taskId}/progress', 'post', '报告当前实施进度与阻塞', taskResult, {
  body: ref('ProgressInput'),
  write: true,
  version: true,
  description: '终态/归档拒绝。阻塞必须给原因；精确区间仅累计活跃且未归档的时间。',
});
add(
  '/tasks/{taskId}/claim',
  'post',
  '原子领取叶子任务；不启动进程',
  object({
    task: taskResult,
    claim: ref('TaskClaim'),
    execution: ref('Execution'),
    run: { type: 'null' },
  }),
  {
    body: input(
      z
        .object({
          threadId: z.string().max(200).nullable().default(null),
          agentKind: z.enum(['codex-cli', 'claude-code', 'manual']).default('manual'),
        })
        .strict(),
    ),
    write: true,
    version: true,
    status: 201,
  },
);
add('/tasks/{taskId}/submit', 'post', '提交成果供明确验收人验收', commandResult, {
  body: ref('SubmitInput'),
  write: true,
  version: true,
  description:
    '必须提交当前requirementsVersion；不隐式把旧工作解释为已适配新需求。父负责人可在必要子任务全部done后提交独立integration execution，不伪造claim/run。',
});
add('/tasks/{taskId}/release', 'post', '释放业务领取；不声称终止进程', commandResult, {
  body: input(z.object({ reason: z.string().trim().min(1).max(2000) }).strict()),
  write: true,
  version: true,
});
for (const name of ['accept', 'return', 'cancel', 'reopen'])
  add(
    `/tasks/{taskId}/${name}`,
    'post',
    {
      accept: '人类指定验收人验收并完成',
      return: '人类验收人退回并保留材料',
      cancel: '人类负责人取消任务',
      reopen: '人类重开并重新验收',
    }[name] ?? name,
    taskResult,
    {
      body: input(
        z
          .object({
            reason:
              name === 'accept'
                ? z.string().max(10000).default('')
                : z.string().trim().min(1).max(10000),
            requirementsVersion: z.number().int().positive().optional(),
          })
          .strict(),
      ),
      write: true,
      version: true,
      human: true,
      description:
        '管理员代验收必须说明原因。必要子任务/依赖未完成、活动领取、未确认运行均阻止验收；取消不级联子任务，未确认进程先由运行面板核查。',
    },
  );
add(
  '/tasks/{taskId}/comments',
  'post',
  '评论与显式同空间成员提及',
  object({ id: uuid, taskId: uuid, actorId: uuid, body: string, ...stamp }),
  {
    body: input(
      z
        .object({
          body: z.string().trim().min(1).max(10000),
          mentionIds: z.array(z.uuid()).max(30).default([]),
        })
        .strict(),
    ),
    write: true,
    status: 201,
  },
);
add('/tasks/{taskId}/executions', 'post', '关联已有线程；不领取或启动', ref('Execution'), {
  body: input(
    z
      .object({ threadId: z.string().min(1).max(200), phase: z.literal('released').optional() })
      .strict(),
  ),
  write: true,
  status: 201,
});
add('/tasks/{taskId}/artifacts', 'post', '新增成果与验证范围', ref('TaskArtifact'), {
  body: ref('ArtifactInput'),
  write: true,
  version: true,
});
add(
  '/tasks/{taskId}/artifacts/{artifactId}',
  'patch',
  '作者/负责人维护成果，保留活动',
  ref('TaskArtifact'),
  { body: ref('ArtifactPatchInput'), write: true, version: true },
);
add(
  '/tasks/{taskId}/artifacts/{artifactId}',
  'delete',
  '成果软删除，保留历史',
  ref('TaskArtifact'),
  { write: true, version: true },
);
add(
  '/tasks/{taskId}/proposals',
  'post',
  '提出拆分/需求/决策提案，不即时生效',
  ref('TaskProposal'),
  { body: ref('ProposalInput'), write: true, version: true },
);
for (const action of ['confirm', 'reject'])
  add(
    `/tasks/{taskId}/proposals/{proposalId}/${action}`,
    'post',
    action === 'confirm' ? '人类调整并确认提案' : '人类拒绝提案',
    ref('TaskProposal'),
    {
      body:
        action === 'confirm'
          ? object(
              {
                payload: {
                  type: 'object',
                  description: '可选，按原提案kind严格校验；原payload和确认payload分别保留',
                },
              },
              [],
            )
          : empty,
      write: true,
      version: true,
      human: true,
    },
  );
const taskQuerySchema = input(taskFilterSchema);
const filterProperties = (taskQuerySchema.properties ?? {}) as Record<string, Schema>;
add(
  '/me/tasks',
  'get',
  '我的负责/参与/待验收/阻塞任务',
  object({ items: array(taskResult), nextCursor: nullableId }),
  {
    query: [
      ...Object.entries(filterProperties).map(([name, schema]) => query(name, schema)),
      query('cursor', uuid),
      query('limit', { type: 'integer', minimum: 1, maximum: 100, default: 50 }),
    ],
  },
);
add('/me/saved-filters', 'get', '列出本人的可见空间保存筛选', array(ref('SavedFilter')), {
  human: true,
});
add('/me/saved-filters', 'post', '保存本人筛选，不授予空间访问权', ref('SavedFilter'), {
  body: ref('SavedFilterInput'),
  write: true,
  human: true,
});
add('/me/saved-filters/{filterId}', 'patch', '按筛选版本更新', ref('SavedFilter'), {
  body: ref('SavedFilterInput'),
  write: true,
  version: true,
  human: true,
});
add(
  '/me/saved-filters/{filterId}',
  'delete',
  '按筛选版本删除',
  object({ deleted: { const: true } }),
  { write: true, version: true, human: true },
);
add(
  '/me/notifications',
  'get',
  '读取持久收件箱或独立桌面提醒候选',
  object({ items: array(ref('Notification')), nextCursor: nullableId }),
  {
    human: true,
    query: [
      query('spaceId', uuid),
      query('unread', { enum: ['true', 'false'] }),
      query('handled', { enum: ['true', 'false'] }),
      query('deliverable', { enum: ['true', 'false'] }),
      query('cursor', uuid),
      query('limit', { type: 'integer', minimum: 1, maximum: 100, default: 50 }),
    ],
    description:
      'deliverable=true为当前到期、未处理、未投递、静音已结束、投递lease可领取的有界候选，按到期顺序，不接收cursor。收件箱默认按最新时间分页。每次复验成员。',
  },
);
for (const action of ['read', 'handle', 'snooze', 'delivery', 'delivered'])
  add(
    `/me/notifications/{notificationId}/${action}`,
    'post',
    {
      read: '标记本人通知已读',
      handle: '标记已处理（独立于已读）',
      snooze: '设置稍后并开启新提醒轮次',
      delivery: '领取本设备桌面投递lease',
      delivered: '凭精确轮次token确认已投递',
    }[action] ?? action,
    action === 'delivery'
      ? {
          allOf: [
            ref('Notification'),
            object({ deliveryToken: { type: 'string', pattern: '^\\d{1,12}\\.\\d{1,6}$' } }),
          ],
        }
      : ref('Notification'),
    {
      body:
        action === 'snooze'
          ? object({ until: date })
          : action === 'delivered'
            ? object({ deliveryToken: { type: 'string', pattern: '^\\d{1,12}\\.\\d{1,6}$' } })
            : empty,
      write: true,
      human: true,
      description:
        '领取/ACK不会自动已读；deliveryToken不是设备凭据，仅匹配当前通知轮次。snooze清除旧投递状态，旧token失效；同幂等键不能恢复过期lease。系统提醒是尽力投递，持久记录仍为事实源。',
    },
  );
add(
  '/me/notification-preferences',
  'get',
  '读取本人各空间通知偏好',
  array(ref('NotificationPreferences')),
  { human: true },
);
add(
  '/me/notification-preferences/{spaceId}',
  'put',
  '设置桌面开关、静音和合并窗口',
  ref('NotificationPreferences'),
  { body: ref('NotificationPreferencesInput'), write: true, human: true },
);
paths['/me/notification-events'] = {
  get: {
    summary: '本人通知变化SSE，仅提示重新取当前收件箱',
    security: session,
    responses: {
      200: {
        description: 'ready/notification事件，无私人正文；断线后重新取API',
        content: { 'text/event-stream': { schema: { type: 'string' } } },
      },
      ...errors,
    },
  },
};
add(
  '/spaces/{spaceId}/automation-rules',
  'get',
  '列出空间真实自动规则',
  array(ref('AutomationRule')),
);
add(
  '/spaces/{spaceId}/automation-rules',
  'post',
  '人类admin创建提醒或固定间隔周期任务',
  ref('AutomationRule'),
  {
    body: ref('AutomationRuleInput'),
    write: true,
    human: true,
    description:
      'type/config严格遵循AutomationConfig；周期从nextRunAt按intervalHours绝对时长推进，不是本地墙钟cron。服务启动有界worker，停服后只追当前一次，唯一occurrence去重。',
  },
);
add(
  '/spaces/{spaceId}/automation-rules/{ruleId}',
  'patch',
  '人类admin按规则版本修改/停启',
  ref('AutomationRule'),
  { body: { ...ruleInput, required: [] }, write: true, version: true, human: true },
);
add(
  '/spaces/{spaceId}/workflow-metrics',
  'get',
  '读取真实活跃阻塞/待验收区间统计',
  ref('WorkflowMetrics'),
  {
    query: [query('from', date), query('to', date)],
    description:
      '默认过去30天，最多366天。终态/任务或空间归档停止计时，恢复重新开区间；legacy_unknown单列而不计精确时长。无数据items为空。',
  },
);
add('/tasks/{taskId}/runs', 'get', '读取任务的脱敏运行事实', array(ref('TaskRun')));
add(
  '/tasks/{taskId}/runs',
  'post',
  '原领取设备登记启动意图，不代表进程已运行',
  object({ task: taskResult, run: ref('TaskRun') }),
  {
    body: ref('RunStartInput'),
    write: true,
    version: true,
    description:
      '必须匹配当前claim actor/device/editor权限；permissionMode默认read-only，workspace-write需显式选择。resumeFrom只能同设备、同runner、已结束且有官方会话的run。拒绝已有未确认运行。',
  },
);
add(
  '/tasks/{taskId}/runs/{runId}/events',
  'post',
  '原领取设备提交严格运行转换/心跳',
  object({ task: taskResult, run: ref('TaskRun') }),
  {
    body: ref('RunEventInput'),
    write: true,
    version: true,
    description:
      '严格runTransitions；unknown不可伪装成功或取消，终态不可覆盖，会话标识不可偷换。不接受PID、本机路径、命令或凭据。',
  },
);
add(
  '/tasks/{taskId}/runs/{runId}/resolve',
  'post',
  '人类核查旧进程停止后仅解除unknown阻塞',
  object({ task: taskResult, run: ref('TaskRun') }),
  {
    body: input(
      z
        .object({
          reason: z.string().trim().min(1).max(2000),
          confirmedProcessStopped: z.literal(true),
        })
        .strict(),
    ),
    write: true,
    version: true,
    human: true,
    description:
      '仅原领取人或当前空间admin/owner。保留unknown、记录resolvedBy/resolvedAt/resolutionReason与活动，不变造执行成功/取消事实。',
  },
);
export const collaborationPaths = paths;
