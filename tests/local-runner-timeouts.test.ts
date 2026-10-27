import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requestLocalRunner } from '../apps/web/src/AgentRunPanel.tsx';
import { resetServerCompatibility } from '../apps/web/src/api.ts';
import { CompanionClient } from '../packages/cli/src/main.ts';
import { compatibleServerHealth } from './server-compatibility-fixture.ts';

const envelope = (data: unknown) =>
  new Response(JSON.stringify({ data }), { headers: { 'content-type': 'application/json' } });

beforeEach(() => {
  resetServerCompatibility();
  vi.useFakeTimers();
  // Node's native AbortSignal clock is independent of fake timers; emulate its public contract.
  vi.spyOn(AbortSignal, 'timeout').mockImplementation((milliseconds) => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(new DOMException('Timed out', 'TimeoutError')), milliseconds);
    return controller.signal;
  });
  vi.stubGlobal('window', { __TAURI__: { core: { invoke: async () => 'synthetic-local-key' } } });
});
afterEach(() => {
  resetServerCompatibility();
  vi.clearAllTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function fixture(delay: number | null) {
  const calls: { path: string; body: string | undefined }[] = [];
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input)).pathname;
    if (path.endsWith('/health')) return envelope(compatibleServerHealth);
    calls.push({ path, body: init?.body as string | undefined });
    return new Promise<Response>((resolve, reject) => {
      const signal = init?.signal;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const clean = () => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
      };
      const abort = () => {
        clean();
        reject(signal?.reason);
      };
      signal?.addEventListener('abort', abort, { once: true });
      if (signal?.aborted) return abort();
      if (delay !== null)
        timer = setTimeout(() => {
          clean();
          resolve(envelope({ observed: true }));
        }, delay);
    });
  }) as typeof fetch;
  vi.stubGlobal('fetch', fetcher);
  const cli = new CompanionClient({ key: 'synthetic-local-key', fetcher });
  const body = { taskId: 'synthetic-task', version: 7, idempotencyKey: 'original-request-key' };
  const invoke = (entry: 'cli' | 'renderer', operation: string) => {
    const write = operation === '/start' || operation.endsWith('/cancel');
    return entry === 'cli'
      ? cli.request(`/v1/runners${operation}`, write ? 'POST' : 'GET', write ? body : undefined)
      : requestLocalRunner(operation, write ? body : undefined);
  };
  return { calls, body, invoke };
}

for (const entry of ['cli', 'renderer'] as const) {
  describe(`${entry} local runner observation`, () => {
    for (const operation of ['/start', '/probe']) {
      it(`waits for a valid 20-second ${operation} without reissuing it`, async () => {
        const server = fixture(20_000);
        let settled = false;
        const pending = server.invoke(entry, operation).then(
          (value) => {
            settled = true;
            return { value };
          },
          (error) => {
            settled = true;
            return { error };
          },
        );
        await vi.advanceTimersByTimeAsync(15_000);
        expect(settled).toBe(false);
        await vi.advanceTimersByTimeAsync(5_000);
        expect(await pending).toEqual({ value: { observed: true } });
        expect(server.calls).toHaveLength(1);
        if (operation === '/start') expect(JSON.parse(server.calls[0].body!)).toEqual(server.body);
      });
      it(`keeps a stalled ${operation} bounded without an automatic retry`, async () => {
        const server = fixture(null);
        const pending = server.invoke(entry, operation).then(
          () => 'unexpected success',
          () => 'timeout',
        );
        await vi.advanceTimersByTimeAsync(60_000);
        expect(await pending).toBe('timeout');
        expect(server.calls).toHaveLength(1);
      });
    }
    for (const operation of ['/task/run', '/task/run/cancel']) {
      it(`keeps ${operation} on the ordinary shorter deadline`, async () => {
        const server = fixture(20_000);
        const pending = server.invoke(entry, operation).then(
          () => 'unexpected success',
          () => 'timeout',
        );
        await vi.advanceTimersByTimeAsync(15_000);
        expect(await pending).toBe('timeout');
        expect(server.calls).toHaveLength(1);
      });
    }
  });
}
