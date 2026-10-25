import type { FastifyInstance, FastifyRequest } from 'fastify';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  BoardError,
  requireRole,
  participantSchema,
  artifactSchema,
  proposalSchema,
  taskSchema,
  type Task,
  type Execution,
  type Role,
  type WorkflowEvent,
} from '@taskboard/core';
import type { Database } from './db.ts';

export interface TaskRecord {
  id: string;
  space_id: string;
  role: Role;
  assignee_id: string | null;
  reviewer_id: string | null;
  parent_task_id: string | null;
  required_for_parent: boolean;
  requirements_version: number;
  blocked: boolean;
  blocked_reason: string;
  status_id: string;
  archived_at: Date | null;
  version: number;
  [key: string]: unknown;
}
export interface CollaborationContext {
  db: Database;
  taskAndRole(taskId: string, userId: string): Promise<TaskRecord>;
  member(spaceId: string, userId: string): Promise<Role>;
  stored(
    request: FastifyRequest,
  ): Promise<{ key: string; cached: { response: unknown; status_code: number } | null }>;
  saveIdempotency(
    request: FastifyRequest,
    key: string,
    result: unknown,
    status?: number,
  ): Promise<void>;
  rowTask(row: Record<string, unknown>): Task;
  rowExecution(row: Record<string, unknown>): Execution;
  activity(taskId: string, actorId: string, kind: string, body?: string): Promise<void>;
  emit(spaceId: string, event: unknown): void;
  event?(event: WorkflowEvent & { body?: string; mentionIds?: string[] }): Promise<void>;
}
const stamp = (value: string | Date | null | undefined) =>
  value ? new Date(value).toISOString() : null;
export function camelRow(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()),
      value instanceof Date ? value.toISOString() : value,
    ]),
  );
}
function parse<T>(request: FastifyRequest, schema: z.ZodType<T>): T {
  return schema.parse(request.body ?? {});
}
function human(request: FastifyRequest) {
  if (request.auth!.agent) throw new BoardError('AGENT_CANNOT_CONFIRM', '此操作需要人类确认', 403);
}
function responsible(task: TaskRecord, request: FastifyRequest) {
  requireRole(task.role, 'editor');
  if (task.assignee_id !== request.auth!.id && !['admin', 'owner'].includes(task.role))
    throw new BoardError('RESPONSIBLE_ONLY', '需要总负责人或管理员操作', 403);
}
function reviewer(task: TaskRecord, request: FastifyRequest) {
  human(request);
  requireRole(task.role, 'editor');
  if (task.reviewer_id !== request.auth!.id && !['admin', 'owner'].includes(task.role))
    throw new BoardError('REVIEWER_ONLY', '需要指定验收人操作', 403);
}
export function createCollaboration(context: CollaborationContext) {
  const { db } = context;
  async function semantic(task: TaskRecord) {
    return (await db.query('SELECT semantic FROM statuses WHERE id=$1', [task.status_id])).rows[0]
      ?.semantic;
  }
  async function requireMember(spaceId: string, userId: unknown, review = false) {
    if (!userId) return;
    const found = await db.query(
      'SELECT role FROM space_members WHERE space_id=$1 AND user_id=$2',
      [spaceId, userId],
    );
    if (!found.rowCount || (review && found.rows[0].role === 'viewer'))
      throw new BoardError(
        review ? 'INVALID_REVIEWER' : 'INVALID_ASSIGNEE',
        '职责必须分配给有相应权限的当前空间成员',
        422,
      );
  }
  async function relation(taskId: string, targetId: string, spaceId: string, parent = false) {
    const target = await db.query(
      'SELECT id FROM tasks WHERE id=$1 AND space_id=$2 AND archived_at IS NULL',
      [targetId, spaceId],
    );
    if (!target.rowCount)
      throw new BoardError('CROSS_SPACE_RELATION', '关联任务必须在当前空间', 422);
    if (parent) {
      const parentStatus = await db.query(
        'SELECT s.semantic FROM tasks t JOIN statuses s ON s.id=t.status_id WHERE t.id=$1',
        [targetId],
      );
      if (['done', 'cancelled'].includes(parentStatus.rows[0]?.semantic))
        throw new BoardError('PARENT_NOT_ACTIVE', '请先重开父任务再增加子任务', 409);
    }
    const combined = await db.query(
      'WITH RECURSIVE edges AS (SELECT task_id a,depends_on_task_id b FROM task_dependencies UNION SELECT parent_task_id a,id b FROM tasks WHERE parent_task_id IS NOT NULL), reachable AS (SELECT $1::uuid id UNION SELECT e.b FROM edges e JOIN reachable r ON e.a=r.id) SELECT 1 FROM reachable WHERE id=$2',
      parent ? [taskId, targetId] : [targetId, taskId],
    );
    if (combined.rowCount)
      throw new BoardError('DEPENDENCY_CYCLE', '父子和依赖不能形成等待循环', 422);
    const loop = parent
      ? await db.query(
          'WITH RECURSIVE ancestors AS (SELECT id,parent_task_id FROM tasks WHERE id=$1 UNION SELECT t.id,t.parent_task_id FROM tasks t JOIN ancestors a ON t.id=a.parent_task_id) SELECT 1 FROM ancestors WHERE id=$2',
          [targetId, taskId],
        )
      : await db.query(
          'WITH RECURSIVE upstream AS (SELECT $1::uuid AS id UNION SELECT d.depends_on_task_id FROM task_dependencies d JOIN upstream u ON d.task_id=u.id) SELECT 1 FROM upstream WHERE id=$2',
          [targetId, taskId],
        );
    if (loop.rowCount) throw new BoardError('DEPENDENCY_CYCLE', '任务关系不能形成循环', 422);
  }
  async function validateTask(
    taskId: string,
    spaceId: string,
    input: Partial<z.infer<typeof taskSchema>>,
    request: FastifyRequest,
    existing?: TaskRecord,
  ) {
    if (
      existing &&
      ['assigneeId', 'reviewerId', 'parentTaskId', 'requiredForParent'].some((key) => key in input)
    ) {
      human(request);
      responsible(existing, request);
    }
    if (request.auth!.agent && (input.reviewerId || input.parentTaskId))
      throw new BoardError('AGENT_CANNOT_CONFIRM', 'Agent 不能分配验收与父子关系', 403);
    if (
      existing?.archived_at &&
      !(input.archived === false && Object.keys(input).every((key) => key === 'archived'))
    )
      throw new BoardError('TASK_ARCHIVED', '归档任务只可读取或恢复', 409);
    if (existing && ('blocked' in input || 'blockedReason' in input)) {
      if (['done', 'cancelled'].includes(await semantic(existing)))
        throw new BoardError('TASK_NOT_ACTIVE', '请先重开终态任务再修改阻塞', 409);
      const ownClaim = await db.query(
        'SELECT 1 FROM task_claims WHERE task_id=$1 AND actor_id=$2 AND released_at IS NULL',
        [taskId, request.auth!.id],
      );
      if (!ownClaim.rowCount) responsible(existing, request);
      if (
        (input.blocked ?? existing.blocked) &&
        !(input.blockedReason ?? existing.blocked_reason)?.trim()
      )
        throw new BoardError('BLOCK_REASON_REQUIRED', '阻塞须填写原因', 422);
    }
    if (!existing && input.blocked && !input.blockedReason?.trim())
      throw new BoardError('BLOCK_REASON_REQUIRED', '阻塞须填写原因', 422);
    if (!existing && input.statusId) {
      const status = await db.query('SELECT semantic FROM statuses WHERE id=$1 AND space_id=$2', [
        input.statusId,
        spaceId,
      ]);
      if (status.rows[0]?.semantic !== 'todo')
        throw new BoardError('TRANSITION_REQUIRED', '新任务必须从待办开始', 422);
    }
    await requireMember(spaceId, input.assigneeId);
    await requireMember(spaceId, input.reviewerId, true);
    if (input.parentTaskId) await relation(taskId, input.parentTaskId, spaceId, true);
    if (
      existing &&
      ('acceptanceCriteria' in input || 'description' in input) &&
      (await db.query('SELECT 1 FROM task_decisions WHERE task_id=$1 LIMIT 1', [taskId])).rowCount
    )
      throw new BoardError('REQUIREMENTS_PROPOSAL_REQUIRED', '已确认需求需通过变更提案修改', 409);
    if (existing && input.statusId) {
      const target = await db.query('SELECT semantic FROM statuses WHERE id=$1 AND space_id=$2', [
        input.statusId,
        spaceId,
      ]);
      if (!target.rowCount) throw new BoardError('INVALID_STATUS', '状态不属于当前空间', 422);
      if (target.rows[0].semantic !== (await semantic(existing)))
        throw new BoardError('TRANSITION_REQUIRED', '请使用领取、提交、验收、取消或重开操作', 422);
    }
  }
  async function gates(task: TaskRecord, dependencies = false) {
    const children = await db.query(
      "SELECT t.id FROM tasks t JOIN statuses s ON s.id=t.status_id WHERE t.parent_task_id=$1 AND t.required_for_parent AND (t.archived_at IS NOT NULL OR s.semantic<>'done')",
      [task.id],
    );
    if (children.rowCount)
      throw new BoardError('REQUIRED_CHILDREN_NOT_DONE', '必要子任务尚未全部完成', 409, {
        taskIds: children.rows.map((row) => row.id),
      });
    if (dependencies) {
      const unmet = await db.query(
        "SELECT t.id FROM task_dependencies d JOIN tasks t ON t.id=d.depends_on_task_id JOIN statuses s ON s.id=t.status_id WHERE d.task_id=$1 AND (t.archived_at IS NOT NULL OR s.semantic<>'done')",
        [task.id],
      );
      if (unmet.rowCount)
        throw new BoardError('DEPENDENCIES_NOT_DONE', '依赖任务尚未完成', 409, {
          taskIds: unmet.rows.map((row) => row.id),
        });
    }
  }
  async function noRun(taskId: string) {
    if (
      (
        await db.query(
          "SELECT 1 FROM task_runs WHERE task_id=$1 AND (phase IN ('starting','running','cancel_requested') OR (phase='unknown' AND resolved_at IS NULL)) LIMIT 1",
          [taskId],
        )
      ).rowCount
    )
      throw new BoardError('RUN_STATE_UNCONFIRMED', '运行尚未确认结束，请先查询或取消运行', 409);
  }
  async function detail(taskId: string) {
    const [
      participants,
      children,
      parent,
      dependencies,
      claims,
      runs,
      artifacts,
      proposals,
      decisions,
      reviews,
    ] = await Promise.all([
      db.query('SELECT * FROM task_participants WHERE task_id=$1 ORDER BY user_id', [taskId]),
      db.query('SELECT * FROM tasks WHERE parent_task_id=$1 ORDER BY number', [taskId]),
      db.query('SELECT p.* FROM tasks t JOIN tasks p ON p.id=t.parent_task_id WHERE t.id=$1', [
        taskId,
      ]),
      db.query('SELECT * FROM task_dependencies WHERE task_id=$1', [taskId]),
      db.query('SELECT * FROM task_claims WHERE task_id=$1 ORDER BY claimed_at DESC', [taskId]),
      db.query('SELECT * FROM task_runs WHERE task_id=$1 ORDER BY started_at DESC NULLS FIRST', [
        taskId,
      ]),
      db.query('SELECT * FROM task_artifacts WHERE task_id=$1 ORDER BY created_at DESC', [taskId]),
      db.query('SELECT * FROM task_proposals WHERE task_id=$1 ORDER BY created_at DESC', [taskId]),
      db.query('SELECT * FROM task_decisions WHERE task_id=$1 ORDER BY created_at DESC', [taskId]),
      db.query('SELECT * FROM task_reviews WHERE task_id=$1 ORDER BY created_at DESC', [taskId]),
    ]);
    return {
      participants: participants.rows.map(camelRow),
      children: children.rows.map(context.rowTask),
      parent: parent.rowCount ? context.rowTask(parent.rows[0]) : null,
      dependencies: dependencies.rows.map(camelRow),
      claims: claims.rows.map(camelRow),
      runs: runs.rows.map(camelRow),
      artifacts: artifacts.rows.map(camelRow),
      proposals: proposals.rows.map(camelRow),
      decisions: decisions.rows.map(camelRow),
      reviews: reviews.rows.map(camelRow),
    };
  }
  async function changed(
    task: TaskRecord,
    request: FastifyRequest,
    kind: string,
    text = '',
    mentionIds: string[] = [],
  ) {
    await syncIntervals(task);
    await context.activity(task.id, request.auth!.id, kind, text);
    const event = {
      eventId: randomUUID(),
      spaceId: task.space_id,
      taskId: task.id,
      actorId: request.auth!.id,
      kind,
      occurredAt: new Date().toISOString(),
      requirementsVersion: task.requirements_version,
      affectedTaskIds: [task.id],
      body: text,
      mentionIds,
    };
    await context.event?.(event);
    context.emit(task.space_id, { type: kind, taskId: task.id });
  }
  async function bump(
    task: TaskRecord,
    request: FastifyRequest,
    extra = '',
    values: unknown[] = [],
  ) {
    const version = Number(String(request.headers['if-match'] ?? '').replaceAll('"', ''));
    if (!Number.isInteger(version) || version < 1)
      throw new BoardError('VERSION_REQUIRED', '写操作必须携带 If-Match', 428);
    const result = await db.query(
      `UPDATE tasks SET version=version+1,updated_at=now()${extra} WHERE id=$${values.length + 1} AND version=$${values.length + 2} RETURNING *`,
      [...values, task.id, version],
    );
    if (!result.rowCount) throw new BoardError('VERSION_CONFLICT', '任务已变化，请刷新后重试', 409);
    return result.rows[0];
  }
  async function move(task: TaskRecord, request: FastifyRequest, target: string) {
    const status = await db.query(
      'SELECT id FROM statuses WHERE space_id=$1 AND semantic=$2 ORDER BY position LIMIT 1',
      [task.space_id, target],
    );
    if (!status.rowCount) throw new BoardError('MISSING_STATUS', '空间缺少所需状态', 422);
    return bump(task, request, ',status_id=$1', [status.rows[0].id]);
  }
  function register(app: FastifyInstance) {
    const write = (
      method: 'post' | 'put' | 'patch' | 'delete',
      suffix: string,
      run: (r: FastifyRequest, task: TaskRecord) => Promise<unknown>,
    ) => {
      app[method](`/api/v1/tasks/:taskId/${suffix}`, async (request, reply) => {
        const taskId = (request.params as Record<string, string>).taskId;
        const task = await context.taskAndRole(taskId, request.auth!.id);
        requireRole(task.role, 'editor');
        const memo = await context.stored(request);
        if (memo.cached)
          return reply.code(memo.cached.status_code).send({ data: memo.cached.response });
        const data = await run(request, task);
        const status = suffix === 'claim' ? 201 : 200;
        await context.saveIdempotency(request, memo.key, data, status);
        reply.code(status);
        return { data };
      });
    };
    write('post', 'children', async (r, task) => {
      human(r);
      responsible(task, r);
      if (['done', 'cancelled'].includes(await semantic(task)))
        throw new BoardError('INVALID_TRANSITION', '请先重开父任务', 422);
      const input = parse(r, taskSchema);
      input.parentTaskId = task.id;
      input.assigneeId ??= r.auth!.id;
      await validateTask(randomUUID(), task.space_id, input, r);
      const status = await db.query(
        "SELECT id FROM statuses WHERE id=$1 AND space_id=$2 AND semantic='todo'",
        [input.statusId, task.space_id],
      );
      if (!status.rowCount)
        throw new BoardError('TRANSITION_REQUIRED', '新子任务必须从待办开始', 422);
      await bump(task, r);
      const seq = (
        await db.query('SELECT COALESCE(MAX(number),0)+1 n FROM tasks WHERE space_id=$1', [
          task.space_id,
        ])
      ).rows[0].n;
      const child = await db.query(
        'INSERT INTO tasks(id,space_id,number,title,description,status_id,priority,assignee_id,reviewer_id,parent_task_id,required_for_parent,acceptance_criteria,due_at,labels,checklist,repository) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15::jsonb,$16) RETURNING *',
        [
          randomUUID(),
          task.space_id,
          seq,
          input.title,
          input.description,
          input.statusId,
          input.priority,
          input.assigneeId,
          input.reviewerId,
          task.id,
          input.requiredForParent,
          input.acceptanceCriteria,
          input.dueAt,
          JSON.stringify(input.labels),
          JSON.stringify(input.checklist),
          input.repository,
        ],
      );
      await db.query(
        'INSERT INTO task_participants(task_id,user_id,responsibility) VALUES($1,$2,$3)',
        [child.rows[0].id, input.assigneeId, '负责实施'],
      );
      await changed(task, r, 'task.child_created');
      return context.rowTask(child.rows[0]);
    });
    write('put', 'participants/:userId', async (r, task) => {
      const userId = (r.params as Record<string, string>).userId;
      const input = parse(r, participantSchema);
      await requireMember(task.space_id, userId);
      if (userId !== r.auth!.id) responsible(task, r);
      else if (task.assignee_id !== userId && !['admin', 'owner'].includes(task.role)) {
        const prior = await db.query(
          'SELECT responsibility FROM task_participants WHERE task_id=$1 AND user_id=$2',
          [task.id, userId],
        );
        if (!prior.rowCount || input.responsibility !== prior.rows[0].responsibility)
          throw new BoardError('RESPONSIBLE_ONLY', '职责分配需要总负责人', 403);
      }
      await bump(task, r);
      const found = await db.query(
        'INSERT INTO task_participants(task_id,user_id,responsibility,progress,summary,blocked_reason) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(task_id,user_id) DO UPDATE SET responsibility=$3,progress=$4,summary=$5,blocked_reason=$6,updated_at=now() RETURNING *',
        [task.id, userId, input.responsibility, input.progress, input.summary, input.blockedReason],
      );
      await changed(task, r, 'participant.updated', '', [userId]);
      return camelRow(found.rows[0]);
    });
    write('delete', 'participants/:userId', async (r, task) => {
      responsible(task, r);
      await bump(task, r);
      await db.query('DELETE FROM task_participants WHERE task_id=$1 AND user_id=$2', [
        task.id,
        (r.params as Record<string, string>).userId,
      ]);
      await changed(task, r, 'participant.removed');
      return { deleted: true };
    });
    write('put', 'dependencies/:dependencyId', async (r, task) => {
      human(r);
      responsible(task, r);
      const target = (r.params as Record<string, string>).dependencyId;
      await relation(task.id, target, task.space_id);
      await bump(task, r);
      await db.query(
        'INSERT INTO task_dependencies(task_id,depends_on_task_id) VALUES($1,$2) ON CONFLICT DO NOTHING',
        [task.id, target],
      );
      await changed(task, r, 'dependency.added');
      return { taskId: task.id, dependsOnTaskId: target };
    });
    write('delete', 'dependencies/:dependencyId', async (r, task) => {
      human(r);
      responsible(task, r);
      await bump(task, r);
      await db.query('DELETE FROM task_dependencies WHERE task_id=$1 AND depends_on_task_id=$2', [
        task.id,
        (r.params as Record<string, string>).dependencyId,
      ]);
      await changed(task, r, 'dependency.removed');
      return { deleted: true };
    });
    write('post', 'progress', async (r, task) => {
      if (task.archived_at || ['done', 'cancelled'].includes(await semantic(task)))
        throw new BoardError(
          'TASK_NOT_ACTIVE',
          '终态或归档任务不能报告实施进度，请先重开或恢复',
          409,
        );
      const input = parse(
        r,
        z
          .object({
            progress: z.number().int().min(0).max(100),
            summary: z.string().max(10000),
            blocked: z.boolean().optional(),
            blockedReason: z.string().max(2000).optional(),
          })
          .strict(),
      );
      const permission = await db.query(
        'SELECT 1 FROM task_claims WHERE task_id=$1 AND actor_id=$2 AND released_at IS NULL UNION SELECT 1 FROM task_participants WHERE task_id=$1 AND user_id=$2',
        [task.id, r.auth!.id],
      );
      if (!permission.rowCount) responsible(task, r);
      if (input.blocked && !input.blockedReason?.trim())
        throw new BoardError('BLOCK_REASON_REQUIRED', '阻塞须填写原因', 422);
      const updated = await bump(
        task,
        r,
        input.blocked === undefined ? '' : ',blocked=$1,blocked_reason=$2',
        input.blocked === undefined ? [] : [input.blocked, input.blockedReason ?? ''],
      );
      await db.query(
        'INSERT INTO task_participants(task_id,user_id,progress,summary,blocked_reason) VALUES($1,$2,$3,$4,$5) ON CONFLICT(task_id,user_id) DO UPDATE SET progress=$3,summary=$4,blocked_reason=$5,updated_at=now()',
        [task.id, r.auth!.id, input.progress, input.summary, input.blockedReason ?? ''],
      );
      await changed(updated, r, 'task.progress', input.summary);
      return context.rowTask(updated);
    });
    write('post', 'claim', async (r, task) => {
      const input = parse(
        r,
        z
          .object({
            threadId: z.string().max(200).nullable().default(null),
            agentKind: z.enum(['codex-cli', 'claude-code', 'manual']).default('manual'),
          })
          .strict(),
      );
      if (!r.auth!.deviceId) throw new BoardError('DEVICE_REQUIRED', '领取需要设备身份', 422);
      if (task.archived_at || !['todo', 'in_progress'].includes(await semantic(task)))
        throw new BoardError('TASK_NOT_CLAIMABLE', '当前状态不能领取', 422);
      if (task.blocked) throw new BoardError('TASK_BLOCKED', '任务正被阻塞', 409);
      if (
        (
          await db.query(
            'SELECT 1 FROM tasks WHERE parent_task_id=$1 AND archived_at IS NULL LIMIT 1',
            [task.id],
          )
        ).rowCount
      )
        throw new BoardError('LEAF_REQUIRED', '请领取独立叶子任务；父任务由负责人集成提交', 422);
      await gates(task, true);
      if (
        (
          await db.query('SELECT 1 FROM task_claims WHERE task_id=$1 AND released_at IS NULL', [
            task.id,
          ])
        ).rowCount
      )
        throw new BoardError('TASK_ALREADY_CLAIMED', '任务已被领取', 409);
      const updated = await move(task, r, 'in_progress');
      const claimId = randomUUID();
      const claim = await db.query(
        'INSERT INTO task_claims(id,task_id,actor_id,device_id) VALUES($1,$2,$3,$4) RETURNING *',
        [claimId, task.id, r.auth!.id, r.auth!.deviceId],
      );
      const execution = await db.query(
        "INSERT INTO executions(id,task_id,actor_id,device_id,thread_id,phase,claim_id,agent_kind,requirements_version) VALUES($1,$2,$3,$4,$5,'claimed',$6,$7,$8) RETURNING *",
        [
          randomUUID(),
          task.id,
          r.auth!.id,
          r.auth!.deviceId,
          input.threadId,
          claimId,
          input.agentKind,
          task.requirements_version,
        ],
      );
      await changed(updated, r, 'execution.claimed');
      return {
        task: context.rowTask(updated),
        claim: camelRow(claim.rows[0]),
        execution: context.rowExecution(execution.rows[0]),
        run: null,
      };
    });
    write('post', 'release', async (r, task) => {
      const input = parse(r, z.object({ reason: z.string().trim().min(1).max(2000) }).strict());
      const claim = await db.query(
        'SELECT * FROM task_claims WHERE task_id=$1 AND released_at IS NULL',
        [task.id],
      );
      if (!claim.rowCount) throw new BoardError('NO_ACTIVE_CLAIM', '没有活动领取', 409);
      if (claim.rows[0].actor_id !== r.auth!.id && !['admin', 'owner'].includes(task.role))
        throw new BoardError('FORBIDDEN', '只能释放本人的领取', 403);
      await noRun(task.id);
      const updated = await bump(task, r);
      await db.query('UPDATE task_claims SET released_at=now(),release_reason=$2 WHERE id=$1', [
        claim.rows[0].id,
        input.reason,
      ]);
      const execution = await db.query(
        "UPDATE executions SET phase='released',updated_at=now() WHERE claim_id=$1 AND phase='claimed' RETURNING *",
        [claim.rows[0].id],
      );
      await changed(updated, r, 'execution.released', input.reason);
      return {
        task: context.rowTask(updated),
        execution: execution.rowCount ? context.rowExecution(execution.rows[0]) : null,
      };
    });
    write('post', 'submit', async (r, task) => {
      const input = parse(
        r,
        z
          .object({
            summary: z.string().trim().min(1).max(20000),
            verification: z.string().trim().min(1).max(20000),
            handoffSummary: z.string().max(20000).default(''),
            blockers: z.string().max(10000).default(''),
            nextStep: z.string().max(10000).default(''),
            limitations: z.string().max(10000).default(''),
            branch: z.string().max(500).default(''),
            prUrl: artifactSchema.shape.url,
            commitSha: z.string().max(100).default(''),
            artifactIds: z.array(z.uuid()).max(100).default([]),
            requirementsVersion: z.number().int().positive(),
          })
          .strict(),
      );
      const state = await semantic(task);
      const children = await db.query('SELECT 1 FROM tasks WHERE parent_task_id=$1 LIMIT 1', [
        task.id,
      ]);
      if (!['todo', 'in_progress'].includes(state) || (state === 'todo' && !children.rowCount))
        throw new BoardError('TASK_NOT_READY_FOR_SUBMISSION', '任务尚未进行或已提交', 422);
      if (!task.reviewer_id) throw new BoardError('REVIEWER_REQUIRED', '请先指定验收人', 422);
      await requireMember(task.space_id, task.reviewer_id, true);
      await noRun(task.id);
      await gates(task, true);
      if (
        input.requirementsVersion !== undefined &&
        input.requirementsVersion !== task.requirements_version
      )
        throw new BoardError('REQUIREMENTS_CHANGED', '需求已变化', 409);
      const claim = await db.query(
        'SELECT * FROM task_claims WHERE task_id=$1 AND released_at IS NULL',
        [task.id],
      );
      let execution: { id: string };
      if (claim.rowCount) {
        if (claim.rows[0].actor_id !== r.auth!.id && !['admin', 'owner'].includes(task.role))
          throw new BoardError('FORBIDDEN', '只有领取人可以提交', 403);
        execution = (
          await db.query(
            "SELECT * FROM executions WHERE claim_id=$1 AND phase='claimed' ORDER BY created_at DESC LIMIT 1",
            [claim.rows[0].id],
          )
        ).rows[0];
      } else {
        if (!children.rowCount) throw new BoardError('NO_ACTIVE_CLAIM', '没有活动领取', 409);
        responsible(task, r);
        execution = (
          await db.query(
            "INSERT INTO executions(id,task_id,actor_id,device_id,phase,agent_kind) VALUES($1,$2,$3,$4,'released','integration') RETURNING *",
            [randomUUID(), task.id, r.auth!.id, r.auth!.deviceId],
          )
        ).rows[0];
      }
      for (const artifactId of input.artifactIds)
        if (
          !(
            await db.query(
              'SELECT 1 FROM task_artifacts WHERE id=$1 AND task_id=$2 AND deleted_at IS NULL',
              [artifactId, task.id],
            )
          ).rowCount
        )
          throw new BoardError('INVALID_ARTIFACT', '成果不属于当前任务', 422);
      const updated = await move(task, r, 'in_review');
      const result = await db.query(
        "UPDATE executions SET phase='submitted',summary=$2,verification=$3,handoff_summary=$4,blockers=$5,next_step=$6,limitations=$7,branch=$8,pr_url=$9,commit_sha=$10,requirements_version=$11,updated_at=now() WHERE id=$1 RETURNING *",
        [
          execution.id,
          input.summary,
          input.verification,
          input.handoffSummary,
          input.blockers,
          input.nextStep,
          input.limitations,
          input.branch,
          input.prUrl,
          input.commitSha,
          task.requirements_version,
        ],
      );
      await db.query(
        "UPDATE task_claims SET released_at=now(),release_reason='submitted' WHERE task_id=$1 AND released_at IS NULL",
        [task.id],
      );

      await changed(updated, r, 'execution.submitted', input.summary);
      return { task: context.rowTask(updated), execution: context.rowExecution(result.rows[0]) };
    });
    for (const command of ['accept', 'return', 'cancel', 'reopen'] as const)
      write('post', command, async (r, task) => {
        const input = parse(
          r,
          z
            .object({
              reason: z.string().max(10000).default(''),
              requirementsVersion: z.number().int().positive().optional(),
            })
            .strict(),
        );
        if (command === 'accept' || command === 'return') reviewer(task, r);
        else {
          human(r);
          if (command === 'reopen' && task.reviewer_id === r.auth!.id)
            requireRole(task.role, 'editor');
          else responsible(task, r);
        }
        if (command === 'accept' && task.reviewer_id !== r.auth!.id && !input.reason.trim())
          throw new BoardError('REASON_REQUIRED', '管理员代验收须说明原因', 422);
        if (command !== 'accept' && !input.reason.trim())
          throw new BoardError('REASON_REQUIRED', '请填写原因', 422);
        const current = await semantic(task);
        if (
          (['accept', 'return'].includes(command) && current !== 'in_review') ||
          (command === 'reopen' && !['done', 'cancelled'].includes(current)) ||
          (command === 'cancel' && ['done', 'cancelled'].includes(current))
        )
          throw new BoardError('INVALID_TRANSITION', '当前状态不支持此操作', 422);
        await noRun(task.id);
        if (command === 'accept') {
          await gates(task, true);
          if (
            (
              await db.query('SELECT 1 FROM task_claims WHERE task_id=$1 AND released_at IS NULL', [
                task.id,
              ])
            ).rowCount
          )
            throw new BoardError('TASK_STILL_RUNNING', '仍有活动领取', 409);
          const submission = await db.query(
            "SELECT requirements_version FROM executions WHERE task_id=$1 AND phase='submitted' ORDER BY updated_at DESC LIMIT 1",
            [task.id],
          );
          if (
            !submission.rowCount ||
            submission.rows[0].requirements_version !== task.requirements_version ||
            (input.requirementsVersion !== undefined &&
              input.requirementsVersion !== task.requirements_version)
          )
            throw new BoardError('REQUIREMENTS_CHANGED', '提交对应需求版本已过期', 409);
        }
        const target = {
          accept: 'done',
          return: 'in_progress',
          cancel: 'cancelled',
          reopen: 'todo',
        }[command];
        const updated = await move(task, r, target);
        if (command === 'accept' || command === 'return')
          await db.query(
            'INSERT INTO task_reviews(id,task_id,reviewer_id,outcome,reason,requirements_version,task_version) VALUES($1,$2,$3,$4,$5,$6,$7)',
            [
              randomUUID(),
              task.id,
              r.auth!.id,
              command === 'accept' ? 'accepted' : 'returned',
              input.reason,
              task.requirements_version,
              updated.version,
            ],
          );
        if (command === 'accept' || command === 'cancel')
          await db.query(
            "UPDATE executions SET phase='released',updated_at=now() WHERE task_id=$1 AND phase IN ('claimed','submitted')",
            [task.id],
          );
        if (command === 'cancel')
          await db.query(
            'UPDATE task_claims SET released_at=now(),release_reason=$2 WHERE task_id=$1 AND released_at IS NULL',
            [task.id, input.reason],
          );

        await changed(
          updated,
          r,
          `task.${command === 'accept' ? 'accepted' : command === 'return' ? 'returned' : command === 'cancel' ? 'cancelled' : 'reopened'}`,
          input.reason,
        );
        return context.rowTask(updated);
      });
    write('post', 'artifacts', async (r, task) => {
      const input = parse(r, artifactSchema);
      if (
        input.executionId &&
        !(
          await db.query('SELECT 1 FROM executions WHERE id=$1 AND task_id=$2', [
            input.executionId,
            task.id,
          ])
        ).rowCount
      )
        throw new BoardError('INVALID_EXECUTION', '执行记录不属于任务', 422);
      await bump(task, r);
      const result = await db.query(
        'INSERT INTO task_artifacts(id,task_id,execution_id,kind,title,url,text,verification_scope,limitations,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',
        [
          randomUUID(),
          task.id,
          input.executionId,
          input.kind,
          input.title,
          input.url,
          input.text,
          input.verificationScope,
          input.limitations,
          r.auth!.id,
        ],
      );
      await changed(task, r, 'artifact.added', input.title);
      return camelRow(result.rows[0]);
    });
    for (const method of ['patch', 'delete'] as const)
      write(method, 'artifacts/:artifactId', async (r, task) => {
        const artifact = await db.query(
          'SELECT * FROM task_artifacts WHERE id=$1 AND task_id=$2 AND deleted_at IS NULL',
          [(r.params as Record<string, string>).artifactId, task.id],
        );
        if (!artifact.rowCount) throw new BoardError('NOT_FOUND', '成果不存在', 404);
        if (artifact.rows[0].created_by !== r.auth!.id) responsible(task, r);
        await bump(task, r);
        let result;
        if (method === 'delete')
          result = await db.query(
            'UPDATE task_artifacts SET deleted_at=now() WHERE id=$1 RETURNING *',
            [artifact.rows[0].id],
          );
        else {
          const input = parse(
            r,
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
          );
          const columns: Record<string, string> = {
            kind: 'kind',
            title: 'title',
            url: 'url',
            text: 'text',
            verificationScope: 'verification_scope',
            limitations: 'limitations',
          };
          const entries = Object.entries(input).filter(([key]) => key in columns);
          if (!entries.length) throw new BoardError('VALIDATION_ERROR', '没有更新内容', 422);
          result = await db.query(
            `UPDATE task_artifacts SET ${entries.map(([key], i) => `${columns[key]}=$${i + 2}`).join(',')} WHERE id=$1 RETURNING *`,
            [artifact.rows[0].id, ...entries.map(([, value]) => value)],
          );
        }
        await changed(task, r, `artifact.${method === 'delete' ? 'deleted' : 'updated'}`);
        return camelRow(result.rows[0]);
      });
    write('post', 'proposals', async (r, task) => {
      const input = parse(r, proposalSchema);
      const updated = await bump(task, r);
      const result = await db.query(
        'INSERT INTO task_proposals(id,task_id,kind,payload,base_task_version,base_requirements_version,proposed_by,source) VALUES($1,$2,$3,$4::jsonb,$5,$6,$7,$8) RETURNING *',
        [
          randomUUID(),
          task.id,
          input.kind,
          JSON.stringify(input.payload),
          updated.version,
          task.requirements_version,
          r.auth!.id,
          r.auth!.agent ? 'agent' : 'human',
        ],
      );
      await changed(updated, r, 'proposal.created');
      return camelRow(result.rows[0]);
    });
    for (const action of ['confirm', 'reject'] as const)
      write('post', `proposals/:proposalId/${action}`, async (r, task) => {
        human(r);
        responsible(task, r);
        const proposal = (
          await db.query(
            "SELECT * FROM task_proposals WHERE id=$1 AND task_id=$2 AND state='proposed'",
            [(r.params as Record<string, string>).proposalId, task.id],
          )
        ).rows[0];
        if (!proposal) throw new BoardError('NOT_FOUND', '提案不存在或已处理', 404);
        if (
          action === 'confirm' &&
          (proposal.base_requirements_version !== task.requirements_version ||
            proposal.base_task_version !== task.version)
        )
          throw new BoardError('PROPOSAL_STALE', '提案基础任务已变化，请重新提案', 409);
        let updated = await bump(task, r);
        if (action === 'confirm') {
          const confirmation = z
            .object({ payload: z.unknown().optional() })
            .strict()
            .parse(r.body ?? {});
          const input = proposalSchema.parse({
            kind: proposal.kind,
            payload: confirmation.payload ?? proposal.payload,
          });
          await db.query('UPDATE task_proposals SET confirmed_payload=$2::jsonb WHERE id=$1', [
            proposal.id,
            JSON.stringify(input.payload),
          ]);
          if (input.kind === 'requirements') {
            updated = (
              await db.query(
                'UPDATE tasks SET description=$2,acceptance_criteria=$3,requirements_version=requirements_version+1 WHERE id=$1 RETURNING *',
                [task.id, input.payload.description, input.payload.acceptanceCriteria],
              )
            ).rows[0];
          }
          if (input.kind === 'split') {
            const todo = (
              await db.query(
                "SELECT id FROM statuses WHERE space_id=$1 AND semantic='todo' ORDER BY position LIMIT 1",
                [task.space_id],
              )
            ).rows[0];
            if (!todo) throw new BoardError('MISSING_STATUS', '缺少待办状态', 422);
            if (['done', 'cancelled'].includes(await semantic(task)))
              throw new BoardError('INVALID_TRANSITION', '请先重开任务', 422);
            for (const child of input.payload.children) {
              await requireMember(task.space_id, child.assigneeId);
              await requireMember(task.space_id, child.reviewerId, true);
              const seq = (
                await db.query('SELECT COALESCE(MAX(number),0)+1 n FROM tasks WHERE space_id=$1', [
                  task.space_id,
                ])
              ).rows[0].n;
              await db.query(
                'INSERT INTO tasks(id,space_id,number,title,description,status_id,assignee_id,reviewer_id,acceptance_criteria,parent_task_id,required_for_parent) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
                [
                  randomUUID(),
                  task.space_id,
                  seq,
                  child.title,
                  child.description,
                  todo.id,
                  child.assigneeId ?? task.assignee_id,
                  child.reviewerId ?? task.reviewer_id,
                  child.acceptanceCriteria,
                  task.id,
                  child.requiredForParent,
                ],
              );
            }
          }
          const decisionBody =
            input.kind === 'decision' ? input.payload.body : JSON.stringify(input.payload);
          await db.query(
            'INSERT INTO task_decisions(id,task_id,proposal_id,body,requirements_version,confirmed_by) VALUES($1,$2,$3,$4,$5,$6)',
            [
              randomUUID(),
              task.id,
              proposal.id,
              decisionBody,
              updated.requirements_version,
              r.auth!.id,
            ],
          );
        }
        const result = await db.query(
          'UPDATE task_proposals SET state=$2,confirmed_by=$3,confirmed_at=now() WHERE id=$1 RETURNING *',
          [proposal.id, action === 'confirm' ? 'confirmed' : 'rejected', r.auth!.id],
        );
        await changed(updated, r, `proposal.${action === 'confirm' ? 'confirmed' : 'rejected'}`);
        return camelRow(result.rows[0]);
      });
  }
  /** Only live task/space states accrue time; archived or terminal history never stays open. */
  async function syncIntervals(task: Pick<TaskRecord, 'id'>) {
    const current = (
      await db.query<{
        blocked: boolean;
        task_archived: Date | null;
        space_archived: Date | null;
        semantic: string;
      }>(
        'SELECT t.blocked,t.archived_at task_archived,sp.archived_at space_archived,s.semantic FROM tasks t JOIN statuses s ON s.id=t.status_id JOIN spaces sp ON sp.id=t.space_id WHERE t.id=$1',
        [task.id],
      )
    ).rows[0];
    if (!current) return;
    const active =
      !current.task_archived &&
      !current.space_archived &&
      !['done', 'cancelled'].includes(current.semantic);
    for (const [kind, shouldOpen] of [
      ['blocked', active && current.blocked],
      ['review_wait', active && current.semantic === 'in_review'],
    ] as const) {
      if (shouldOpen)
        await db.query(
          'INSERT INTO task_state_intervals(id,task_id,kind) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
          [randomUUID(), task.id, kind],
        );
      else
        await db.query(
          'UPDATE task_state_intervals SET ended_at=now() WHERE task_id=$1 AND kind=$2 AND ended_at IS NULL',
          [task.id, kind],
        );
    }
  }
  async function syncSpaceIntervals(spaceId: string) {
    await db.query(
      "UPDATE task_state_intervals i SET ended_at=now() FROM tasks t JOIN statuses s ON s.id=t.status_id JOIN spaces sp ON sp.id=t.space_id WHERE i.task_id=t.id AND t.space_id=$1 AND i.ended_at IS NULL AND (t.archived_at IS NOT NULL OR sp.archived_at IS NOT NULL OR s.semantic IN ('done','cancelled') OR (i.kind='blocked' AND NOT t.blocked) OR (i.kind='review_wait' AND s.semantic<>'in_review'))",
      [spaceId],
    );
    for (const kind of ['blocked', 'review_wait'] as const)
      await db.query(
        `INSERT INTO task_state_intervals(id,task_id,kind) SELECT gen_random_uuid(),t.id,$2 FROM tasks t JOIN statuses s ON s.id=t.status_id JOIN spaces sp ON sp.id=t.space_id WHERE t.space_id=$1 AND t.archived_at IS NULL AND sp.archived_at IS NULL AND s.semantic NOT IN ('done','cancelled') AND ${kind === 'blocked' ? 't.blocked' : "s.semantic='in_review'"} ON CONFLICT DO NOTHING`,
        [spaceId, kind],
      );
  }
  return {
    register,
    detail,
    validateTask,
    changed,
    requireMember,
    relation,
    stamp,
    syncIntervals,
    syncSpaceIntervals,
  };
}
