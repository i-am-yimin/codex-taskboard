import { z } from 'zod';
import type { TaskRun } from './collaboration.ts';

export const runnerKindSchema = z.enum(['codex-cli', 'claude-code']);
export type RunnerKind = z.infer<typeof runnerKindSchema>;
/** Cold setup combines CLI version/auth probes and Windows process-ownership observation. */
export const LOCAL_RUNNER_SETUP_TIMEOUT_MS = 45_000;
export interface RunnerCapability {
  supported: boolean;
  reason: string;
}
export interface RunnerProbe {
  runner: RunnerKind;
  state: 'ready' | 'unconfigured' | 'missing_binary' | 'unsupported' | 'auth_required' | 'error';
  version: string | null;
  start: RunnerCapability;
  cancel: RunnerCapability;
  resume: RunnerCapability;
}
export const runStartSchema = z
  .object({
    claimId: z.uuid(),
    runner: runnerKindSchema,
    resumeFrom: z.uuid().optional(),
    permissionMode: z.enum(['read-only', 'workspace-write']).default('read-only'),
  })
  .strict();
export const runEventSchema = z
  .object({
    phase: z.enum(['running', 'cancel_requested', 'cancelled', 'succeeded', 'failed', 'unknown']),
    externalSessionId: z
      .string()
      .min(1)
      .max(240)
      .regex(/^[a-zA-Z0-9_-]+$/)
      .optional(),
    failureReason: z.string().max(2000).default(''),
  })
  .strict();
export const runTransitions: Record<TaskRun['phase'], readonly TaskRun['phase'][]> = {
  starting: ['running', 'cancel_requested', 'failed', 'unknown'],
  running: ['running', 'cancel_requested', 'succeeded', 'failed', 'unknown'],
  cancel_requested: ['cancel_requested', 'cancelled', 'failed', 'unknown'],
  cancelled: [],
  succeeded: [],
  failed: [],
  unknown: [],
};
/** Runtime interface deliberately carries no desktop, DOM, PID or credential contract. */
export function runFactsMatch(server: TaskRun, local: TaskRun): boolean {
  return (
    server.phase === local.phase &&
    server.externalSessionId === local.externalSessionId &&
    server.failureReason === local.failureReason
  );
}
/** Unknown never infers an exit; every intermediate transition reflects observed local facts. */
export function planRunSynchronization(
  server: TaskRun,
  local: TaskRun,
): { phases: TaskRun['phase'][]; conflict?: string } {
  if (runFactsMatch(server, local)) return { phases: [] };
  if (server.phase === 'unknown' || ['succeeded', 'failed', 'cancelled'].includes(server.phase))
    return {
      phases: [],
      conflict: '服务器未知或终态与本机事实不同；不能重写终态，请人工核查并保留交接报告',
    };
  if (server.phase === local.phase)
    return runTransitions[server.phase].includes(local.phase)
      ? { phases: [local.phase] }
      : { phases: [], conflict: '同状态持久事实不同，当前状态不允许覆盖' };
  if (local.phase === 'cancelled' && ['starting', 'running'].includes(server.phase))
    return { phases: ['cancel_requested', 'cancelled'] };
  if (server.phase === 'starting' && local.phase === 'succeeded' && local.startedAt)
    return { phases: ['running', 'succeeded'] };
  if (runTransitions[server.phase].includes(local.phase)) return { phases: [local.phase] };
  return { phases: [], conflict: '本机与服务器运行状态不能安全合并，请人工核查' };
}
export interface AgentRunner {
  probe(): Promise<RunnerProbe[]>;
  start(run: TaskRun, prompt: string, repository: string): Promise<TaskRun>;
  status(runId: string): Promise<TaskRun>;
  cancel(runId: string): Promise<TaskRun>;
  resume(run: TaskRun, prompt: string, repository: string): Promise<TaskRun>;
}
