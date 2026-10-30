import { describe, expect, it, vi } from 'vitest';
import {
  runStartSchema,
  planRunSynchronization,
  runFactsMatch,
  runTransitions,
  type TaskRun,
} from '../packages/core/src/index.ts';
import { CompanionClient, createProgram } from '../packages/cli/src/main.ts';
const record = {
  id: 'run',
  phase: 'running',
  externalSessionId: 'session',
  failureReason: '',
  startedAt: '2026-10-25T00:00:00.000Z',
} as TaskRun;
describe('run reconciliation and taskctl contract', () => {
  it('takes only legal observed transitions when cancellation reports conflicted', () => {
    for (const phase of ['starting', 'running'] as const) {
      const server = { ...record, phase };
      const local = { ...record, phase: 'cancelled' as const };
      const plan = planRunSynchronization(server, local);
      expect(plan.phases).toEqual(['cancel_requested', 'cancelled']);
      let cursor: TaskRun['phase'] = phase;
      for (const next of plan.phases) {
        expect(runTransitions[cursor]).toContain(next);
        cursor = next;
      }
    }
    expect(
      planRunSynchronization({ ...record, phase: 'unknown' }, { ...record, phase: 'succeeded' })
        .conflict,
    ).toBeTruthy();
  });
  it('does not lose a late official session ID or pretend terminal fact differences synced', () => {
    const server = { ...record, externalSessionId: null };
    expect(runFactsMatch(server, record)).toBe(false);
    expect(planRunSynchronization(server, record).phases).toEqual(['running']);
    expect(
      planRunSynchronization({ ...server, phase: 'succeeded' }, { ...record, phase: 'succeeded' })
        .conflict,
    ).toBeTruthy();
  });
  it('defaults to explicit read-only permissions and rejects renderer command fields', () => {
    expect(
      runStartSchema.parse({ claimId: '00000000-0000-4000-8000-000000000001', runner: 'codex-cli' })
        .permissionMode,
    ).toBe('read-only');
    expect(
      runStartSchema.safeParse({
        claimId: '00000000-0000-4000-8000-000000000001',
        runner: 'codex-cli',
        command: 'anything',
      }).success,
    ).toBe(false);
  });
  it('claims without a Codex thread and submits an explicit requirements snapshot', async () => {
    const mutations: unknown[][] = [];
    const client = {
      mutation: async (...args: unknown[]) => {
        mutations.push(args);
        return {};
      },
      get: async () => ({ task: { requirementsVersion: 7 } }),
    } as unknown as CompanionClient;
    const output = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
      await createProgram(client).parseAsync([
        'node',
        'taskctl',
        'claim',
        'task',
        '--agent-kind',
        'claude-code',
        '--version',
        '3',
      ]);
      await createProgram(client).parseAsync([
        'node',
        'taskctl',
        'submit',
        'task',
        'summary',
        'verification',
        '--version',
        '4',
      ]);
    } finally {
      output.mockRestore();
    }
    expect(mutations[0][2]).toMatchObject({ agentKind: 'claude-code' });
    expect(mutations[1][2]).toMatchObject({ requirementsVersion: 7 });
    expect(mutations[1][3]).toBe(4);
  });
});
