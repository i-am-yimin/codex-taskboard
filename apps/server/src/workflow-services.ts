import type { FastifyInstance, FastifyRequest } from 'fastify';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  BoardError,
  taskFilterSchema,
  savedFilterSchema,
  notificationPreferencesSchema,
  type WorkflowEvent,
} from '@taskboard/core';
import type { CollaborationContext } from './collaboration.ts';
import { camelRow } from './collaboration.ts';
import { afterCommit } from './db.ts';

interface TaskRecipients {
  id: string;
  space_id: string;
  title: string;
  assignee_id: string | null;
  reviewer_id: string | null;
}
export function createWorkflowServices(context: CollaborationContext) {
  const { db } = context;
  const listeners = new Map<string, Set<() => void>>();
  const closers = new Set<() => void>();
  async function notify(
    userId: string,
    task: TaskRecipients,
    eventId: string,
    kind: string,
    body = '',
  ) {
    if (
      !(
        await db.query(
          'SELECT 1 FROM space_members m JOIN users u ON u.id=m.user_id WHERE m.space_id=$1 AND m.user_id=$2 AND u.archived_at IS NULL',
          [task.space_id, userId],
        )
      ).rowCount
    )
      return;
    await db.query(
      'INSERT INTO notifications(id,user_id,space_id,task_id,event_id,kind,title,body,group_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(user_id,event_id,kind) DO NOTHING',
      [
        randomUUID(),
        userId,
        task.space_id,
        task.id,
        eventId,
        kind,
        task.title,
        body.slice(0, 2000),
        `${task.id}:${kind}`,
      ],
    );
    afterCommit(() => listeners.get(userId)?.forEach((send) => send()));
  }
  async function event(event: WorkflowEvent & { body?: string; mentionIds?: string[] }) {
    const task = (
      await db.query<TaskRecipients>(
        'SELECT id,space_id,title,assignee_id,reviewer_id FROM tasks WHERE id=$1 AND space_id=$2',
        [event.taskId, event.spaceId],
      )
    ).rows[0];
    if (!task) return;
    const affected = new Set(event.affectedTaskIds);
    if (['task.accepted', 'task.reopened', 'task.cancelled'].includes(event.kind)) {
      const downstream = await db.query<{ id: string }>(
        'SELECT task_id id FROM task_dependencies WHERE depends_on_task_id=$1',
        [task.id],
      );
      downstream.rows.forEach((row) => affected.add(row.id));
    }
    if (event.kind === 'proposal.confirmed') {
      const children = await db.query<{ id: string }>(
        'WITH RECURSIVE tree AS (SELECT id FROM tasks WHERE id=$1 UNION SELECT t.id FROM tasks t JOIN tree p ON t.parent_task_id=p.id) SELECT id FROM tree',
        [task.id],
      );
      children.rows.forEach((row) => affected.add(row.id));
    }
    for (const id of affected) {
      const target = (
        await db.query<TaskRecipients>(
          'SELECT id,space_id,title,assignee_id,reviewer_id FROM tasks WHERE id=$1 AND space_id=$2',
          [id, event.spaceId],
        )
      ).rows[0];
      if (!target) continue;
      const recipients = new Set<string>();
      if (event.kind === 'execution.submitted' && id === task.id) {
        if (target.reviewer_id) recipients.add(target.reviewer_id);
      } else if (event.kind === 'comment.added' || event.kind === 'participant.updated') {
        // Explicit mention/assignment targets are generated and checked by the server.
      } else if (event.kind === 'task.returned') {
        if (target.assignee_id) recipients.add(target.assignee_id);
        const submitted = await db.query<{ actor_id: string }>(
          "SELECT actor_id FROM executions WHERE task_id=$1 AND phase='submitted' ORDER BY updated_at DESC LIMIT 1",
          [id],
        );
        submitted.rows.forEach((row) => recipients.add(row.actor_id));
      } else if (
        id !== task.id ||
        event.kind.startsWith('dependency.') ||
        event.kind === 'execution.claimed' ||
        event.kind === 'execution.released'
      ) {
        if (target.assignee_id) recipients.add(target.assignee_id);
        const claims = await db.query<{ actor_id: string }>(
          'SELECT actor_id FROM task_claims WHERE task_id=$1 AND released_at IS NULL',
          [id],
        );
        claims.rows.forEach((row) => recipients.add(row.actor_id));
      } else if (event.kind === 'proposal.created') {
        if (target.assignee_id) recipients.add(target.assignee_id);
      } else {
        if (target.assignee_id) recipients.add(target.assignee_id);
        if (target.reviewer_id) recipients.add(target.reviewer_id);
        const participants = await db.query<{ user_id: string }>(
          'SELECT user_id FROM task_participants WHERE task_id=$1',
          [id],
        );
        participants.rows.forEach((row) => recipients.add(row.user_id));
      }
      if (!target.assignee_id || !target.reviewer_id) {
        const admins = await db.query<{ user_id: string }>(
          "SELECT user_id FROM space_members WHERE space_id=$1 AND role IN ('admin','owner')",
          [target.space_id],
        );
        admins.rows.forEach((row) => recipients.add(row.user_id));
      }
      for (const match of event.body?.matchAll(/@\{([0-9a-f-]{36})\}/gi) ?? []) {
        if (z.uuid().safeParse(match[1]).success) recipients.add(match[1]);
      }
      event.mentionIds?.forEach((userId) => recipients.add(userId));
      recipients.delete(event.actorId);
      for (const userId of recipients)
        await notify(
          userId,
          target,
          event.eventId,
          id !== task.id ? 'dependency.changed' : event.kind,
          event.body ?? '',
        );
    }
  }
  async function accessibleNotification(request: FastifyRequest) {
    const id = z.uuid().parse((request.params as { notificationId: string }).notificationId);
    const result = await db.query(
      'SELECT n.* FROM notifications n JOIN space_members m ON m.space_id=n.space_id AND m.user_id=n.user_id WHERE n.id=$1 AND n.user_id=$2',
      [id, request.auth!.id],
    );
    if (!result.rowCount) throw new BoardError('NOT_FOUND', '通知不存在或无权访问', 404);
    return result.rows[0];
  }
  function register(app: FastifyInstance) {
    app.addHook('preClose', async () => {
      for (const close of closers) close();
      closers.clear();
    });
    app.get('/api/v1/me/tasks', async (request) => {
      const query = z
        .object({
          ...taskFilterSchema.shape,
          cursor: z.uuid().optional(),
          limit: z.coerce.number().int().min(1).max(100).default(50),
        })
        .strict()
        .parse(request.query);
      const values: unknown[] = [request.auth!.id];
      const where = ['m.user_id=$1', 't.archived_at IS NULL', 'sp.archived_at IS NULL'];
      const add = (sql: string, value: unknown) => {
        values.push(value);
        where.push(sql.replace('?', `$${values.length}`));
      };
      if (query.relation === 'responsible') where.push('t.assignee_id=$1');
      if (query.relation === 'participating')
        where.push(
          'EXISTS(SELECT 1 FROM task_participants p WHERE p.task_id=t.id AND p.user_id=$1)',
        );
      if (query.relation === 'reviewing') where.push("t.reviewer_id=$1 AND s.semantic='in_review'");
      if (query.relation === 'blocked')
        where.push(
          "(t.blocked OR EXISTS(SELECT 1 FROM task_dependencies d JOIN tasks upstream ON upstream.id=d.depends_on_task_id JOIN statuses us ON us.id=upstream.status_id WHERE d.task_id=t.id AND us.semantic<>'done')) AND (t.assignee_id=$1 OR t.reviewer_id=$1 OR EXISTS(SELECT 1 FROM task_participants p WHERE p.task_id=t.id AND p.user_id=$1))",
        );
      if (query.spaceId) add('t.space_id=?', query.spaceId);
      if (query.assigneeId) add('t.assignee_id=?', query.assigneeId);
      if (query.statusId) add('t.status_id=?', query.statusId);
      if (query.priority !== undefined) add('t.priority=?', query.priority);
      if (query.search) add("(t.title||' '||t.description) ILIKE ?", `%${query.search}%`);
      if (query.label) add('t.labels @> ?::jsonb', JSON.stringify([query.label]));
      if (query.cursor) {
        const cursor = await db.query<{ updated_at: Date; id: string }>(
          'SELECT t.updated_at,t.id FROM tasks t JOIN space_members m ON m.space_id=t.space_id AND m.user_id=$2 WHERE t.id=$1',
          [query.cursor, request.auth!.id],
        );
        if (!cursor.rowCount) throw new BoardError('INVALID_CURSOR', '游标不可用，请重新查询', 422);
        values.push(cursor.rows[0].updated_at, cursor.rows[0].id);
        where.push(`(t.updated_at,t.id)<($${values.length - 1},$${values.length})`);
      }
      values.push(query.limit + 1);
      const result = await db.query(
        `SELECT t.* FROM tasks t JOIN space_members m ON m.space_id=t.space_id JOIN spaces sp ON sp.id=t.space_id JOIN statuses s ON s.id=t.status_id WHERE ${where.join(' AND ')} ORDER BY t.updated_at DESC,t.id DESC LIMIT $${values.length}`,
        values,
      );
      const items = result.rows.slice(0, query.limit);
      return {
        data: {
          items: items.map(context.rowTask),
          nextCursor: result.rows.length > query.limit ? (items.at(-1)?.id ?? null) : null,
        },
      };
    });
    app.get('/api/v1/me/saved-filters', async (request) => ({
      data: (
        await db.query(
          "SELECT f.* FROM saved_filters f WHERE f.user_id=$1 AND (f.space_id IS NULL OR EXISTS(SELECT 1 FROM space_members m WHERE m.space_id=f.space_id AND m.user_id=$1)) AND (f.query->>'spaceId' IS NULL OR EXISTS(SELECT 1 FROM space_members m WHERE m.space_id::text=f.query->>'spaceId' AND m.user_id=$1)) ORDER BY f.created_at",
          [request.auth!.id],
        )
      ).rows.map(camelRow),
    }));
    for (const method of ['post', 'patch', 'delete'] as const)
      app[method](
        `/api/v1/me/saved-filters${method === 'post' ? '' : '/:filterId'}`,
        async (request) => {
          if (request.auth!.agent)
            throw new BoardError('AGENT_SCOPE_FORBIDDEN', 'Agent不能修改个人筛选', 403);
          const memo = await context.stored(request);
          if (memo.cached) return { data: memo.cached.response };
          const id =
            method === 'post'
              ? randomUUID()
              : z.uuid().parse((request.params as { filterId: string }).filterId);
          const previous =
            method === 'post'
              ? null
              : (
                  await db.query('SELECT * FROM saved_filters WHERE id=$1 AND user_id=$2', [
                    id,
                    request.auth!.id,
                  ])
                ).rows[0];
          if (method !== 'post' && !previous) throw new BoardError('NOT_FOUND', '筛选不存在', 404);
          if (method !== 'post' && Number(request.headers['if-match']) !== previous.version)
            throw new BoardError('VERSION_CONFLICT', '筛选已变化', 409);
          let data: unknown;
          if (method === 'delete') {
            await db.query('DELETE FROM saved_filters WHERE id=$1', [id]);
            data = { deleted: true };
          } else {
            const input = savedFilterSchema.parse(request.body);
            if (input.spaceId) await context.member(input.spaceId, request.auth!.id);
            if (input.query.spaceId) await context.member(input.query.spaceId, request.auth!.id);
            const result =
              method === 'post'
                ? await db.query(
                    'INSERT INTO saved_filters(id,user_id,space_id,name,query) VALUES($1,$2,$3,$4,$5::jsonb) RETURNING *',
                    [id, request.auth!.id, input.spaceId, input.name, JSON.stringify(input.query)],
                  )
                : await db.query(
                    'UPDATE saved_filters SET space_id=$2,name=$3,query=$4::jsonb,version=version+1 WHERE id=$1 RETURNING *',
                    [id, input.spaceId, input.name, JSON.stringify(input.query)],
                  );
            data = camelRow(result.rows[0]);
          }
          await context.saveIdempotency(request, memo.key, data);
          return { data };
        },
      );
    app.get('/api/v1/me/notifications', async (request) => {
      const query = z
        .object({
          spaceId: z.uuid().optional(),
          unread: z.enum(['true', 'false']).optional(),
          handled: z.enum(['true', 'false']).optional(),
          deliverable: z.enum(['true', 'false']).optional(),
          cursor: z.uuid().optional(),
          limit: z.coerce.number().int().min(1).max(100).default(50),
        })
        .strict()
        .parse(request.query);
      const deliveryCandidates = query.deliverable === 'true';
      if (deliveryCandidates && query.cursor)
        throw new BoardError('VALIDATION_ERROR', '提醒候选使用独立有界轮询，不接受收件箱游标', 422);
      const values: unknown[] = [request.auth!.id];
      const where = ['n.user_id=$1'];
      if (query.spaceId) {
        values.push(query.spaceId);
        where.push(`n.space_id=$${values.length}`);
      }
      if (query.unread) where.push(`n.read_at IS ${query.unread === 'true' ? '' : 'NOT '}NULL`);
      if (query.handled)
        where.push(`n.handled_at IS ${query.handled === 'false' ? '' : 'NOT '}NULL`);
      if (deliveryCandidates)
        where.push(
          'n.delivered_at IS NULL',
          'n.handled_at IS NULL',
          '(n.read_at IS NULL OR n.snoozed_until IS NOT NULL)',
          '(n.snoozed_until IS NULL OR n.snoozed_until<=clock_timestamp())',
          "(n.delivery_claimed_at IS NULL OR n.delivery_claimed_at<clock_timestamp()-interval '1 minute')",
          'EXISTS(SELECT 1 FROM notification_preferences p WHERE p.user_id=$1 AND p.space_id=n.space_id AND p.desktop_enabled AND (p.muted_until IS NULL OR p.muted_until<=clock_timestamp()))',
        );
      if (query.cursor) {
        values.push(query.cursor);
        where.push(
          `(n.created_at,n.id)<(SELECT created_at,id FROM notifications WHERE id=$${values.length} AND user_id=$1)`,
        );
      }
      values.push(query.limit + 1);
      const ordering = deliveryCandidates
        ? '(n.snoozed_until IS NOT NULL) DESC,COALESCE(n.snoozed_until,n.created_at),n.id'
        : 'n.created_at DESC,n.id DESC';
      const result = await db.query(
        `SELECT n.* FROM notifications n JOIN space_members m ON m.space_id=n.space_id AND m.user_id=n.user_id WHERE ${where.join(' AND ')} ORDER BY ${ordering} LIMIT $${values.length}`,
        values,
      );
      const items = result.rows.slice(0, query.limit);
      return {
        data: {
          items: items.map(camelRow),
          nextCursor:
            !deliveryCandidates && result.rows.length > query.limit
              ? (items.at(-1)?.id ?? null)
              : null,
        },
      };
    });
    for (const action of ['read', 'handle', 'snooze', 'delivery', 'delivered'] as const)
      app.post(`/api/v1/me/notifications/:notificationId/${action}`, async (request) => {
        const row = await accessibleNotification(request);
        const memo = await context.stored(request);
        if (memo.cached) {
          if (action === 'delivery' || action === 'delivered') {
            const cached = memo.cached.response as Record<string, unknown>;
            const token =
              action === 'delivery'
                ? cached.deliveryToken
                : (request.body as Record<string, unknown> | undefined)?.deliveryToken;
            const live =
              typeof token === 'string' &&
              (
                await db.query(
                  'SELECT 1 FROM notifications WHERE id=$1 AND delivery_device_id=$2 AND user_id=$3 AND EXTRACT(EPOCH FROM delivery_claimed_at)::text=$4',
                  [row.id, request.auth!.deviceId, request.auth!.id, token],
                )
              ).rowCount;
            if (!live)
              throw new BoardError(
                'DELIVERY_LEASE_EXPIRED',
                '提醒轮次已变化或领取已失效，请重新读取',
                409,
              );
          }
          return { data: memo.cached.response };
        }
        let result;
        if (action === 'snooze') {
          const input = z
            .object({ until: z.iso.datetime({ offset: true }) })
            .strict()
            .parse(request.body);
          if (new Date(input.until).getTime() <= Date.now())
            throw new BoardError('VALIDATION_ERROR', '稍后时间必须在未来', 422);
          result = await db.query(
            'UPDATE notifications SET snoozed_until=$2,delivery_device_id=NULL,delivery_claimed_at=NULL,delivered_at=NULL WHERE id=$1 AND user_id=$3 AND handled_at IS NULL AND EXISTS(SELECT 1 FROM space_members m WHERE m.user_id=$3 AND m.space_id=notifications.space_id) RETURNING *',
            [row.id, input.until, request.auth!.id],
          );
          if (!result.rowCount)
            throw new BoardError('NOTIFICATION_HANDLED', '已处理的通知不能再次设置稍后提醒', 409);
        } else if (action === 'delivery') {
          const preferences = (
            await db.query(
              'SELECT * FROM notification_preferences WHERE user_id=$1 AND space_id=$2',
              [request.auth!.id, row.space_id],
            )
          ).rows[0];
          if (
            !preferences?.desktop_enabled ||
            (preferences.muted_until && new Date(preferences.muted_until) > new Date()) ||
            (row.snoozed_until && new Date(row.snoozed_until) > new Date()) ||
            (row.read_at && !row.snoozed_until) ||
            row.handled_at
          )
            throw new BoardError('NOTIFICATION_MUTED', '通知当前无需桌面提醒', 409);
          result = await db.query(
            "UPDATE notifications SET delivery_device_id=$2,delivery_claimed_at=clock_timestamp() WHERE id=$1 AND user_id=$3 AND delivered_at IS NULL AND (read_at IS NULL OR snoozed_until IS NOT NULL) AND handled_at IS NULL AND (snoozed_until IS NULL OR snoozed_until<=clock_timestamp()) AND (delivery_claimed_at IS NULL OR delivery_claimed_at<clock_timestamp()-interval '1 minute') AND EXISTS(SELECT 1 FROM notification_preferences p WHERE p.user_id=$3 AND p.space_id=notifications.space_id AND p.desktop_enabled AND (p.muted_until IS NULL OR p.muted_until<=clock_timestamp())) AND EXISTS(SELECT 1 FROM space_members m WHERE m.user_id=$3 AND m.space_id=notifications.space_id) RETURNING *,EXTRACT(EPOCH FROM delivery_claimed_at)::text delivery_token",
            [row.id, request.auth!.deviceId, request.auth!.id],
          );
          if (!result.rowCount)
            throw new BoardError('DELIVERY_CLAIMED', '提醒已由设备领取或投递', 409);
        } else if (action === 'delivered') {
          const input = z
            .object({ deliveryToken: z.string().regex(/^\d{1,12}\.\d{1,6}$/) })
            .strict()
            .parse(request.body);
          result = await db.query(
            'UPDATE notifications SET delivered_at=clock_timestamp() WHERE id=$1 AND delivery_device_id=$2 AND user_id=$3 AND EXTRACT(EPOCH FROM delivery_claimed_at)::text=$4 AND EXISTS(SELECT 1 FROM space_members m WHERE m.user_id=$3 AND m.space_id=notifications.space_id) RETURNING *',
            [row.id, request.auth!.deviceId, request.auth!.id, input.deliveryToken],
          );
          if (!result.rowCount)
            throw new BoardError(
              'DELIVERY_LEASE_EXPIRED',
              '提醒轮次已变化或领取已失效，请重新读取',
              409,
            );
        } else
          result = await db.query(
            `UPDATE notifications SET ${action === 'read' ? 'read_at=COALESCE(read_at,now())' : 'handled_at=COALESCE(handled_at,now())'} WHERE id=$1 RETURNING *`,
            [row.id],
          );
        const data = camelRow(result.rows[0]);
        await context.saveIdempotency(request, memo.key, data);
        return { data };
      });
    app.get('/api/v1/me/notification-preferences', async (request) => ({
      data: (
        await db.query(
          'SELECT p.* FROM notification_preferences p JOIN space_members m ON m.space_id=p.space_id AND m.user_id=p.user_id WHERE p.user_id=$1',
          [request.auth!.id],
        )
      ).rows.map(camelRow),
    }));
    app.put('/api/v1/me/notification-preferences/:spaceId', async (request) => {
      const spaceId = z.uuid().parse((request.params as { spaceId: string }).spaceId);
      await context.member(spaceId, request.auth!.id);
      const memo = await context.stored(request);
      if (memo.cached) return { data: memo.cached.response };
      const input = notificationPreferencesSchema.parse(request.body);
      const result = await db.query(
        'INSERT INTO notification_preferences(user_id,space_id,muted_until,desktop_enabled,merge_window_seconds) VALUES($1,$2,$3,$4,$5) ON CONFLICT(user_id,space_id) DO UPDATE SET muted_until=$3,desktop_enabled=$4,merge_window_seconds=$5 RETURNING *',
        [
          request.auth!.id,
          spaceId,
          input.mutedUntil,
          input.desktopEnabled,
          input.mergeWindowSeconds,
        ],
      );
      const data = camelRow(result.rows[0]);
      await context.saveIdempotency(request, memo.key, data);
      return { data };
    });
    app.get('/api/v1/me/notification-events', async (request, reply) => {
      reply.hijack();
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      reply.raw.write('event: ready\ndata: {}\n\n');
      const userId = request.auth!.id;
      let closed = false;
      const send = () => {
        if (!closed)
          reply.raw.write('event: notification\ndata: {"type":"notification.changed"}\n\n');
      };
      const list = listeners.get(userId) ?? new Set();
      list.add(send);
      listeners.set(userId, list);
      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(timer);
        list.delete(send);
        if (!list.size) listeners.delete(userId);
        reply.raw.end();
      };
      const timer = setInterval(() => {
        void db
          .query('SELECT 1 FROM devices WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL', [
            request.auth!.deviceId,
            userId,
          ])
          .then((result) => {
            if (!result.rowCount) close();
            else send();
          })
          .catch(close);
      }, 10000);
      closers.add(close);
      reply.raw.on('close', () => {
        close();
        closers.delete(close);
      });
    });
  }
  return { register, event, notify };
}
