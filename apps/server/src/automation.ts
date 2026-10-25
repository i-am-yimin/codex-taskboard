import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  BoardError,
  requireRole,
  automationConfigSchema,
  type WorkflowEvent,
} from '@taskboard/core';
import type { CollaborationContext } from './collaboration.ts';
import { camelRow } from './collaboration.ts';
import { withTransaction } from './db.ts';
interface RuleRow {
  id: string;
  space_id: string;
  type: string;
  enabled: boolean;
  config: unknown;
  timezone: string;
  next_run_at: Date;
  version: number;
  created_by: string;
}
interface AutomationTask {
  id: string;
  space_id: string;
  title: string;
  assignee_id: string | null;
  reviewer_id: string | null;
  due_at: Date | null;
  updated_at: Date;
  interval_id?: string;
  upstream_id?: string;
  upstream_version?: number;
}
interface AutomationServices {
  notify(
    userId: string,
    task: AutomationTask,
    eventId: string,
    kind: string,
    body?: string,
  ): Promise<void>;
  event(event: WorkflowEvent): Promise<void>;
}
export interface AutomationOptions {
  clock?: () => Date;
  intervalMs?: number;
  enabled?: boolean;
}
export function createAutomation(
  context: CollaborationContext,
  services: AutomationServices,
  options: AutomationOptions = {},
) {
  const { db } = context;
  const now = options.clock ?? (() => new Date());
  let active: Promise<void> | null = null;
  async function occurrence(rule: RuleRow, key: string, taskId: string | null) {
    return Boolean(
      (
        await db.query(
          'INSERT INTO automation_occurrences(id,rule_id,occurrence_key,task_id) VALUES($1,$2,$3,$4) ON CONFLICT(rule_id,occurrence_key) DO NOTHING RETURNING id',
          [randomUUID(), rule.id, key, taskId],
        )
      ).rowCount,
    );
  }
  async function alert(rule: RuleRow, task: AutomationTask, key: string, kind: string) {
    if (!(await occurrence(rule, key, task.id))) return;
    const recipients = new Set<string>();
    if (task.assignee_id) recipients.add(task.assignee_id);
    if (task.reviewer_id) recipients.add(task.reviewer_id);
    const admins = await db.query<{ user_id: string }>(
      "SELECT user_id FROM space_members WHERE space_id=$1 AND role IN ('admin','owner')",
      [rule.space_id],
    );
    admins.rows.forEach((row) => recipients.add(row.user_id));
    const eventId = randomUUID();
    for (const userId of recipients)
      await services.notify(userId, task, eventId, kind, '自动提醒来自已启用的空间规则');
  }
  async function process(rule: RuleRow, date: Date) {
    const parsed = automationConfigSchema.safeParse({ type: rule.type, config: rule.config });
    if (!parsed.success) {
      await db.query('UPDATE automation_rules SET enabled=false,version=version+1 WHERE id=$1', [
        rule.id,
      ]);
      return;
    }
    const input = parsed.data;
    if (input.type === 'recurring') {
      const interval = input.config.intervalHours * 3600000;
      const occurrenceKey = rule.next_run_at.toISOString();
      if (await occurrence(rule, occurrenceKey, null)) {
        for (const user of [input.config.assigneeId, input.config.reviewerId])
          if (
            user &&
            !(
              await db.query(
                'SELECT 1 FROM space_members WHERE space_id=$1 AND user_id=$2 AND role<>$3',
                [rule.space_id, user, 'viewer'],
              )
            ).rowCount
          )
            throw new BoardError('INVALID_ASSIGNEE', '周期模板职责成员已失效', 409);
        const todo = (
          await db.query(
            "SELECT id FROM statuses WHERE space_id=$1 AND semantic='todo' ORDER BY position LIMIT 1",
            [rule.space_id],
          )
        ).rows[0];
        if (!todo) throw new BoardError('MISSING_STATUS', '缺少待办状态', 422);
        const seq = (
          await db.query('SELECT COALESCE(MAX(number),0)+1 n FROM tasks WHERE space_id=$1', [
            rule.space_id,
          ])
        ).rows[0].n;
        const taskId = randomUUID();
        const assignee = input.config.assigneeId ?? rule.created_by;
        await db.query(
          'INSERT INTO tasks(id,space_id,number,title,description,status_id,assignee_id,reviewer_id,acceptance_criteria) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
          [
            taskId,
            rule.space_id,
            seq,
            input.config.title,
            input.config.description,
            todo.id,
            assignee,
            input.config.reviewerId,
            input.config.acceptanceCriteria,
          ],
        );
        await db.query(
          'INSERT INTO task_participants(task_id,user_id,responsibility) VALUES($1,$2,$3)',
          [taskId, assignee, '周期任务负责人'],
        );
        await db.query(
          'UPDATE automation_occurrences SET task_id=$3 WHERE rule_id=$1 AND occurrence_key=$2',
          [rule.id, occurrenceKey, taskId],
        );
        await context.activity(
          taskId,
          rule.created_by,
          'task.recurring_created',
          `固定每 ${input.config.intervalHours} 小时`,
        );
        await services.event({
          eventId: randomUUID(),
          spaceId: rule.space_id,
          taskId,
          actorId: rule.created_by,
          kind: 'task.created',
          occurredAt: date.toISOString(),
          requirementsVersion: 1,
          affectedTaskIds: [taskId],
        });
        context.emit(rule.space_id, { type: 'task.created', taskId });
      }
      const periods = Math.floor((date.getTime() - rule.next_run_at.getTime()) / interval) + 1;
      await db.query('UPDATE automation_rules SET next_run_at=$2 WHERE id=$1', [
        rule.id,
        new Date(rule.next_run_at.getTime() + Math.max(1, periods) * interval),
      ]);
      return;
    }
    if (input.type === 'overdue') {
      const tasks = await db.query<AutomationTask>(
        "SELECT t.* FROM tasks t JOIN statuses s ON s.id=t.status_id WHERE t.space_id=$1 AND t.archived_at IS NULL AND s.semantic NOT IN ('done','cancelled') AND t.due_at IS NOT NULL AND t.due_at<=$2 AND NOT EXISTS(SELECT 1 FROM automation_occurrences o WHERE o.rule_id=$3 AND o.task_id=t.id AND substring(o.occurrence_key from 38)::timestamptz=t.due_at) ORDER BY t.due_at LIMIT 100",
        [rule.space_id, new Date(date.getTime() - input.config.thresholdMinutes * 60000), rule.id],
      );
      for (const task of tasks.rows)
        await alert(rule, task, `${task.id}:${task.due_at?.toISOString()}`, 'automation.overdue');
    } else if (input.type === 'review_wait') {
      const tasks = await db.query<AutomationTask>(
        "SELECT t.*,i.id interval_id FROM tasks t JOIN task_state_intervals i ON i.task_id=t.id WHERE t.space_id=$1 AND t.archived_at IS NULL AND i.kind='review_wait' AND i.ended_at IS NULL AND i.precision='exact' AND i.started_at<=$2 AND NOT EXISTS(SELECT 1 FROM automation_occurrences o WHERE o.rule_id=$3 AND o.occurrence_key=t.id::text||':'||i.id::text) ORDER BY i.started_at LIMIT 100",
        [rule.space_id, new Date(date.getTime() - input.config.thresholdMinutes * 60000), rule.id],
      );
      for (const task of tasks.rows)
        await alert(rule, task, `${task.id}:${String(task.interval_id)}`, 'automation.review_wait');
    } else {
      const tasks = await db.query<AutomationTask>(
        "SELECT t.*,upstream.id upstream_id,upstream.version upstream_version FROM task_dependencies d JOIN tasks t ON t.id=d.task_id JOIN statuses s ON s.id=t.status_id JOIN tasks upstream ON upstream.id=d.depends_on_task_id JOIN statuses us ON us.id=upstream.status_id WHERE t.space_id=$1 AND t.archived_at IS NULL AND s.semantic NOT IN ('done','cancelled') AND us.semantic='done' AND NOT EXISTS(SELECT 1 FROM automation_occurrences o WHERE o.rule_id=$2 AND o.occurrence_key=t.id::text||':'||upstream.id::text||':'||upstream.version::text) ORDER BY upstream.updated_at LIMIT 100",
        [rule.space_id, rule.id],
      );
      for (const task of tasks.rows)
        await alert(
          rule,
          task,
          `${task.id}:${String(task.upstream_id)}:${String(task.upstream_version)}`,
          'automation.dependency_ready',
        );
    }
    await db.query('UPDATE automation_rules SET next_run_at=$2 WHERE id=$1', [
      rule.id,
      new Date(date.getTime() + 60000),
    ]);
  }
  async function execute() {
    const date = now();
    const due = await db.query<RuleRow>(
      'SELECT * FROM automation_rules WHERE enabled AND next_run_at<=$1 ORDER BY next_run_at,id LIMIT 50',
      [date],
    );
    for (const candidate of due.rows) {
      try {
        await withTransaction(db, async () => {
          // Match API lock order: space before rule. Competing workers recheck due time after acquiring it.
          const space = await db.query('SELECT archived_at FROM spaces WHERE id=$1 FOR UPDATE', [
            candidate.space_id,
          ]);
          if (!space.rowCount || space.rows[0].archived_at) return;
          const current = await db.query<RuleRow>(
            'SELECT * FROM automation_rules WHERE id=$1 AND enabled AND next_run_at<=$2 FOR UPDATE SKIP LOCKED',
            [candidate.id, date],
          );
          if (!current.rowCount) return;
          const rule = current.rows[0];
          const member = await db.query<{ role: string }>(
            'SELECT role FROM space_members WHERE space_id=$1 AND user_id=$2',
            [rule.space_id, rule.created_by],
          );
          if (!member.rowCount || !['admin', 'owner'].includes(member.rows[0].role)) {
            await db.query(
              'UPDATE automation_rules SET enabled=false,version=version+1 WHERE id=$1',
              [rule.id],
            );
            return;
          }
          await process(rule, date);
          await db.query('UPDATE automation_rules SET last_error=$2 WHERE id=$1', [rule.id, '']);
        });
      } catch {
        await db
          .query('UPDATE automation_rules SET last_error=$2 WHERE id=$1', [
            candidate.id,
            '规则执行失败，请检查成员、模板和空间状态',
          ])
          .catch(() => undefined);
      }
    }
  }
  function runOnce() {
    if (active) return active;
    active = execute().finally(() => {
      active = null;
    });
    return active;
  }
  function register(app: FastifyInstance) {
    app.get('/api/v1/spaces/:spaceId/automation-rules', async (request) => {
      const spaceId = z.uuid().parse((request.params as { spaceId: string }).spaceId);
      await context.member(spaceId, request.auth!.id);
      return {
        data: (
          await db.query('SELECT * FROM automation_rules WHERE space_id=$1 ORDER BY created_at', [
            spaceId,
          ])
        ).rows.map(camelRow),
      };
    });
    for (const method of ['post', 'patch'] as const)
      app[method](
        `/api/v1/spaces/:spaceId/automation-rules${method === 'post' ? '' : '/:ruleId'}`,
        async (request) => {
          const params = request.params as { spaceId: string; ruleId?: string };
          requireRole(await context.member(params.spaceId, request.auth!.id), 'admin');
          if (request.auth!.agent)
            throw new BoardError('AGENT_CANNOT_CONFIRM', '自动规则需人类管理员配置', 403);
          const memo = await context.stored(request);
          if (memo.cached) return { data: memo.cached.response };
          const id = params.ruleId ? z.uuid().parse(params.ruleId) : randomUUID();
          const previous = params.ruleId
            ? (
                await db.query<RuleRow>(
                  'SELECT * FROM automation_rules WHERE id=$1 AND space_id=$2',
                  [id, params.spaceId],
                )
              ).rows[0]
            : null;
          if (params.ruleId && !previous) throw new BoardError('NOT_FOUND', '规则不存在', 404);
          if (previous && Number(request.headers['if-match']) !== previous.version)
            throw new BoardError('VERSION_CONFLICT', '规则已变化', 409);
          const raw = z
            .object({
              type: z
                .enum(['dependency_reminder', 'overdue', 'review_wait', 'recurring'])
                .optional(),
              config: z.unknown().optional(),
              enabled: z.boolean().optional(),
              timezone: z.string().max(80).optional(),
              nextRunAt: z.iso.datetime({ offset: true }).optional(),
            })
            .strict()
            .parse(request.body);
          const input = automationConfigSchema.parse({
            type: raw.type ?? previous?.type,
            config: raw.config ?? previous?.config,
          });
          const timezone = raw.timezone ?? previous?.timezone ?? 'UTC';
          try {
            new Intl.DateTimeFormat('en', { timeZone: timezone }).format();
          } catch {
            throw new BoardError('VALIDATION_ERROR', '时区无效', 422);
          }
          if (input.type === 'recurring')
            for (const user of [input.config.assigneeId, input.config.reviewerId])
              if (user) requireRole(await context.member(params.spaceId, user), 'editor');
          const date = raw.nextRunAt ? new Date(raw.nextRunAt) : (previous?.next_run_at ?? now());
          const enabled = raw.enabled ?? previous?.enabled ?? true;
          const result = previous
            ? await db.query(
                'UPDATE automation_rules SET type=$2,config=$3::jsonb,enabled=$4,timezone=$5,next_run_at=$6,version=version+1 WHERE id=$1 RETURNING *',
                [id, input.type, JSON.stringify(input.config), enabled, timezone, date],
              )
            : await db.query(
                'INSERT INTO automation_rules(id,space_id,type,config,enabled,timezone,next_run_at,created_by) VALUES($1,$2,$3,$4::jsonb,$5,$6,$7,$8) RETURNING *',
                [
                  id,
                  params.spaceId,
                  input.type,
                  JSON.stringify(input.config),
                  enabled,
                  timezone,
                  date,
                  request.auth!.id,
                ],
              );
          const data = camelRow(result.rows[0]);
          await context.saveIdempotency(request, memo.key, data);
          return { data };
        },
      );
    app.get('/api/v1/spaces/:spaceId/workflow-metrics', async (request) => {
      const spaceId = z.uuid().parse((request.params as { spaceId: string }).spaceId);
      await context.member(spaceId, request.auth!.id);
      const input = z
        .object({
          from: z.iso.datetime({ offset: true }).optional(),
          to: z.iso.datetime({ offset: true }).optional(),
        })
        .strict()
        .parse(request.query);
      const end = input.to ? new Date(input.to) : now();
      const start = input.from ? new Date(input.from) : new Date(end.getTime() - 30 * 86400000);
      if (start >= end || end.getTime() - start.getTime() > 366 * 86400000)
        throw new BoardError('VALIDATION_ERROR', '统计范围须为1年以内有效区间', 422);
      const result = await db.query(
        "SELECT i.kind,count(*)::int sample_count,COALESCE(sum(EXTRACT(EPOCH FROM LEAST(COALESCE(i.ended_at,$3),$3)-GREATEST(i.started_at,$2))),0)::float8 total_seconds,count(*) FILTER(WHERE i.ended_at IS NULL)::int current_count FROM task_state_intervals i JOIN tasks t ON t.id=i.task_id WHERE t.space_id=$1 AND i.precision='exact' AND i.started_at<$3 AND COALESCE(i.ended_at,$3)>$2 GROUP BY i.kind",
        [spaceId, start, end],
      );
      const legacy = await db.query(
        "SELECT count(*)::int count FROM task_state_intervals i JOIN tasks t ON t.id=i.task_id WHERE t.space_id=$1 AND i.precision='legacy_unknown'",
        [spaceId],
      );
      return {
        data: {
          from: start.toISOString(),
          to: end.toISOString(),
          timezone: 'UTC',
          items: result.rows.map(camelRow),
          legacyUnknownCount: legacy.rows[0].count,
        },
      };
    });
    let timer: ReturnType<typeof setInterval> | undefined;
    app.addHook('onReady', async () => {
      if (options.enabled === false) return;
      const interval = Math.max(1000, Math.min(60000, options.intervalMs ?? 15000));
      timer = setInterval(() => {
        void runOnce().catch(() => undefined);
      }, interval);
      timer.unref();
      void runOnce().catch(() => undefined);
    });
    app.addHook('onClose', async () => {
      if (timer) clearInterval(timer);
      if (active) await active;
    });
  }
  return { register, runOnce };
}
