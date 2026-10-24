import { afterEach, describe, expect, it, vi } from 'vitest';
import { CodexDesktopAdapter, type CdpConnection } from '../packages/adapter-codex/src/index.ts';

async function installedFixture() {
  const page = {
    id: 'target',
    type: 'page',
    url: 'app://codex',
    webSocketDebuggerUrl: 'ws://127.0.0.1:1/devtools/page/target',
  };
  let versionFailures = 0;
  const fetcher = vi.fn(async (input: RequestInfo | URL) => {
    if (String(input).endsWith('/json/version')) {
      if (versionFailures-- > 0) throw new Error('Temporary CDP probe failure');
      return new Response(JSON.stringify({ webSocketDebuggerUrl: page.webSocketDebuggerUrl }));
    }
    return new Response(JSON.stringify([page]));
  });
  vi.stubGlobal('fetch', fetcher);
  let validOwner = true;
  let onLoad: (() => void) | undefined;
  let injections = 0;
  let holdRecovery = false;
  let releaseRecovery: (() => void) | undefined;
  const send = vi.fn(async (method: string, params?: Record<string, unknown>) => {
    if (method === 'Target.getTargetInfo')
      return { targetInfo: { targetId: page.id, type: page.type, url: page.url } };
    if (method === 'Runtime.evaluate') {
      if (String(params?.expression).includes('const selectOne =')) {
        injections++;
        if (holdRecovery)
          await new Promise<void>((resolve) => {
            releaseRecovery = resolve;
          });
        return { result: { value: { installed: true } } };
      }
      return { result: { value: true } };
    }
    return {};
  });
  const connector = vi.fn(async () => ({
    send: send as CdpConnection['send'],
    close: vi.fn(),
    onEvent: (_method: string, listener: () => void) => {
      onLoad = listener;
      return () => {
        onLoad = undefined;
      };
    },
  }));
  const adapter = new CodexDesktopAdapter(
    {
      owner: { verify: async () => validOwner },
      appVersion: '26.1016.8622.0',
      endpoint: 'http://127.0.0.1:1',
      targetBinding: {
        targetId: page.id,
        exactPageUrl: page.url,
        pageWebSocketUrl: page.webSocketDebuggerUrl,
      },
      shellMarker: '[shell]',
      boardUrl: 'http://127.0.0.1:4173',
    },
    connector,
  );
  await adapter.install();
  return {
    adapter,
    send,
    connector,
    fetcher,
    failNextProbe: () => {
      versionFailures = 1;
    },
    revokeOwner: () => {
      validOwner = false;
    },
    restoreOwner: () => {
      validOwner = true;
    },
    startRecovery: () => {
      holdRecovery = true;
      onLoad!();
    },
    recoveryStarted: () => Boolean(releaseRecovery),
    finishRecovery: () => {
      holdRecovery = false;
      releaseRecovery!();
    },
    injectionCount: () => injections,
  };
}

describe('reusing an installed Codex sidebar', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('shares a transient-probe retry without injecting or reloading an active session', async () => {
    const f = await installedFixture();
    try {
      const before = f.send.mock.calls.length;
      f.failNextProbe();
      const replies = await Promise.all([
        f.adapter.ensureInstalled(),
        f.adapter.ensureInstalled(),
        f.adapter.ensureInstalled(),
      ]);
      expect(replies.every((reply) => reply.embedded)).toBe(true);
      expect(f.connector).toHaveBeenCalledOnce();
      expect(f.injectionCount()).toBe(1);
      expect(f.send).toHaveBeenCalledTimes(before);
    } finally {
      await f.adapter.dispose();
    }
  });

  it('waits for the existing page recovery instead of installing again', async () => {
    const f = await installedFixture();
    try {
      f.startRecovery();
      await vi.waitFor(() => expect(f.recoveryStarted()).toBe(true));
      let finished = false;
      const repeated = f.adapter.ensureInstalled().then((reply) => {
        finished = true;
        return reply;
      });
      await Promise.resolve();
      expect(finished).toBe(false);
      f.finishRecovery();
      expect((await repeated).embedded).toBe(true);
      expect(f.connector).toHaveBeenCalledOnce();
      expect(f.injectionCount()).toBe(2);
      expect(f.send.mock.calls.some(([method]) => method === 'Page.reload')).toBe(false);
    } finally {
      await f.adapter.dispose();
    }
  });

  it('never reports an embedded sidebar or reinstalls after ownership stays invalid', async () => {
    const f = await installedFixture();
    try {
      vi.useFakeTimers();
      const before = f.send.mock.calls.length;
      f.revokeOwner();
      const repeated = f.adapter.ensureInstalled();
      await vi.advanceTimersByTimeAsync(10_100);
      expect(await repeated).toMatchObject({
        embedded: false,
        reason: 'Codex 启动器进程归属已失效',
      });
      expect(f.connector).toHaveBeenCalledOnce();
      expect(f.injectionCount()).toBe(1);
      expect(f.send).toHaveBeenCalledTimes(before);
    } finally {
      vi.useRealTimers();
      f.restoreOwner();
      await f.adapter.dispose();
    }
  });
});
