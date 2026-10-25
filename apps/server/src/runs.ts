import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  BoardError,
  requireRole,
  runStartSchema,
  runEventSchema,
  runTransitions,
  type TaskRun,
} from '@taskboard/core';
import { camelRow, type CollaborationContext, type TaskRecord } from './collaboration.ts';

export function registerRuns(app: FastifyInstance, context: CollaborationContext): void {
  const { db } = context;
  async function ownClaim(task: TaskRecord, request: FastifyRequest, claimId: string) {
    requireRole(task.role, 'editor');
    const result = await db.query(
      'SELECT * FROM task_claims WHERE id=$1 AND task_id=$2 AND actor_id=$3 AND device_id=$4 AND released_at IS NULL',
      [claimId, task.id, request.auth!.id, request.auth!.deviceId],
    );
    if (!result.rowCount)
      throw new BoardError('CLAIM_OWNER_REQUIRED', '需要当前领取人和原设备', 403);
    const status = await db.query('SELECT semantic FROM statuses WHERE id=$1', [task.status_id]);
    if (task.archived_at || status.rows[0]?.semantic !== 'in_progress')
      throw new BoardError('INVALID_TRANSITION', '只能运行实施中的任务', 409);
  }
  app.get('/api/v1/tasks/:taskId/runs', async (request) => {
    const { taskId } = z.object({ taskId: z.uuid() }).parse(request.params);
    await context.taskAndRole(taskId, request.auth!.id);
    return {
      data: (
        await db.query(
          'SELECT * FROM task_runs WHERE task_id=$1 ORDER BY started_at DESC NULLS FIRST,id',
          [taskId],
        )
      ).rows.map(camelRow),
    };
  });
  const write = (
    suffix: string,
    action: (request: FastifyRequest, task: TaskRecord) => Promise<unknown>,
  ) => {
    app.post(`/api/v1/tasks/:taskId/${suffix}`, async (request, reply) => {
      const { taskId } = z.object({ taskId: z.uuid() }).passthrough().parse(request.params);
      const task = await context.taskAndRole(taskId, request.auth!.id);
      requireRole(task.role, 'editor');
      const memo = await context.stored(request);
      if (memo.cached)
        return reply.code(memo.cached.status_code).send({ data: memo.cached.response });
      const data = await action(request, task);
      await context.saveIdempotency(request, memo.key, data);
      return { data };
    });
  };
  async function bump(task: TaskRecord, request: FastifyRequest) {
    const expected = Number(String(request.headers['if-match'] ?? '').replaceAll('"', ''));
    if (!Number.isInteger(expected) || expected < 1)
      throw new BoardError('VERSION_REQUIRED', '需要 If-Match', 428);
    const changed = await db.query(
      'UPDATE tasks SET version=version+1,updated_at=now() WHERE id=$1 AND version=$2 RETURNING *',
      [task.id, expected],
    );
    if (!changed.rowCount) throw new BoardError('VERSION_CONFLICT', '任务已变化，请重新读取', 409);
    return context.rowTask(changed.rows[0]);
  }
  write('runs', async (request, task) => {
    const input = runStartSchema.parse(request.body);
    await ownClaim(task, request, input.claimId);
    const active = await db.query(
      "SELECT 1 FROM task_runs WHERE claim_id=$1 AND (phase IN ('starting','running','cancel_requested') OR (phase='unknown' AND resolved_at IS NULL))",
      [input.claimId],
    );
    if (active.rowCount)
      throw new BoardError('RUN_STATE_UNCONFIRMED', '已有运行，请先查询原运行', 409);
    let sessionId: string | null = null;
    if (input.resumeFrom) {
      const previous = await db.query(
        "SELECT external_session_id FROM task_runs WHERE id=$1 AND task_id=$2 AND actor_id=$3 AND device_id=$4 AND runner=$5 AND phase IN ('succeeded','failed','cancelled') AND external_session_id IS NOT NULL",
        [input.resumeFrom, task.id, request.auth!.id, request.auth!.deviceId, input.runner],
      );
      if (!previous.rowCount)
        throw new BoardError('RUNNER_UNSUPPORTED', '缺少同设备已结束运行的官方会话，无法恢复', 409);
      sessionId = previous.rows[0].external_session_id;
    }
    const updated = await bump(task, request);
    const result = await db.query(
      "INSERT INTO task_runs(id,task_id,claim_id,actor_id,device_id,runner,phase,last_heartbeat_at,external_session_id,permission_mode) VALUES($1,$2,$3,$4,$5,$6,'starting',now(),$7,$8) RETURNING *",
      [
        randomUUID(),
        task.id,
        input.claimId,
        request.auth!.id,
        request.auth!.deviceId,
        input.runner,
        sessionId,
        input.permissionMode,
      ],
    );
    await context.activity(
      task.id,
      request.auth!.id,
      'run_starting',
      '已登记启动；尚未确认进程运行',
    );
    context.emit(task.space_id, { type: 'task.updated', taskId: task.id });
    return { task: updated, run: camelRow(result.rows[0]) };
  });
  write('runs/:runId/resolve', async (request, task) => {
    if (request.auth!.agent)
      throw new BoardError('AGENT_CANNOT_CONFIRM', '解除未知运行阻塞需要人类确认', 403);
    const { runId } = z.object({ runId: z.uuid() }).passthrough().parse(request.params);
    const input = z
      .object({
        reason: z.string().trim().min(1).max(2000),
        confirmedProcessStopped: z.literal(true),
      })
      .strict()
      .parse(request.body);
    const found = await db.query(
      "SELECT * FROM task_runs WHERE id=$1 AND task_id=$2 AND phase='unknown' AND resolved_at IS NULL FOR UPDATE",
      [runId, task.id],
    );
    if (!found.rowCount)
      throw new BoardError('INVALID_RUN_TRANSITION', '仅可解除尚未确认的未知运行', 409);
    if (found.rows[0].actor_id !== request.auth!.id && !['admin', 'owner'].includes(task.role))
      throw new BoardError('FORBIDDEN', '需要原领取人或管理员', 403);
    const updated = await bump(task, request);
    const result = await db.query(
      'UPDATE task_runs SET resolved_by=$1,resolved_at=now(),resolution_reason=$2 WHERE id=$3 RETURNING *',
      [request.auth!.id, input.reason, runId],
    );
    await context.activity(
      task.id,
      request.auth!.id,
      'run_unknown_resolved',
      `人类确认已核查旧进程停止，仅解除阻塞，不确认运行成功或取消：${input.reason}`,
    );
    context.emit(task.space_id, { type: 'task.updated', taskId: task.id });
    return { task: updated, run: camelRow(result.rows[0]) };
  });
  write('runs/:runId/events', async (request, task) => {
    const { runId } = z.object({ runId: z.uuid() }).passthrough().parse(request.params);
    const input = runEventSchema.parse(request.body);
    const found = await db.query('SELECT * FROM task_runs WHERE id=$1 AND task_id=$2 FOR UPDATE', [
      runId,
      task.id,
    ]);
    if (!found.rowCount) throw new BoardError('NOT_FOUND', '运行不存在', 404);
    const run = camelRow(found.rows[0]) as unknown as TaskRun;
    await ownClaim(task, request, run.claimId);
    if (!runTransitions[run.phase].includes(input.phase))
      throw new BoardError(
        'INVALID_RUN_TRANSITION',
        '运行状态转换不允许；未知状态需要人工核查',
        409,
      );
    if (
      run.externalSessionId &&
      input.externalSessionId &&
      run.externalSessionId !== input.externalSessionId
    )
      throw new BoardError('RUN_SESSION_MISMATCH', '运行会话不能替换', 409);
    const updated = await bump(task, request);
    const terminal = ['cancelled', 'succeeded', 'failed'].includes(input.phase);
    const result = await db.query(
      "UPDATE task_runs SET phase=$1,external_session_id=COALESCE(external_session_id,$2),failure_reason=$3,last_heartbeat_at=now(),started_at=CASE WHEN $1='running' THEN COALESCE(started_at,now()) ELSE started_at END,finished_at=CASE WHEN $4 THEN now() ELSE finished_at END WHERE id=$5 RETURNING *",
      [input.phase, input.externalSessionId ?? null, input.failureReason, terminal, runId],
    );
    await context.activity(task.id, request.auth!.id, `run_${input.phase}`, input.failureReason);
    context.emit(task.space_id, { type: 'task.updated', taskId: task.id });
    return { task: updated, run: camelRow(result.rows[0]) };
  });
}
