import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CodexDesktopAdapter } from '../packages/adapter-codex/src/index.ts';
import { createCompanion } from '../apps/companion/src/main.ts';
import { LauncherControl, type LauncherSession } from '../apps/companion/src/launcher-control.ts';

const original: LauncherSession = {
  id: 'S'.repeat(48), version: '26.1007.9446.0', pid: 4242,
  createdTicks: '123456789', codexHome: 'C:\\isolated-original',
  endpoint: 'http://127.0.0.1:9223', targetId: 'A'.repeat(32),
  exactPageUrl: 'app://-/index.html',
  pageWebSocketUrl: 'ws://127.0.0.1:9223/devtools/page/' + 'A'.repeat(32),
};
const replacement: LauncherSession = {
  ...original, id: 'N'.repeat(48), pid: 4343, createdTicks: '223456789',
  codexHome: 'C:\\isolated-replacement', endpoint: 'http://127.0.0.1:9224',
  targetId: 'B'.repeat(32), pageWebSocketUrl: 'ws://127.0.0.1:9224/devtools/page/' + 'B'.repeat(32),
};
const capabilities = { embedded: false, projects: false, draft: false, thread: false, reason: 'test host' };

describe('launcher-owned adapter retirement', () => {
  afterEach(() => vi.restoreAllMocks());

  async function fixture() {
    const control = new LauncherControl(9, 'K'.repeat(48));
    const session = vi.spyOn(control, 'session').mockResolvedValue(original);
    const exited = vi.spyOn(control, 'hasExited').mockResolvedValue(false);
    const probe = vi.spyOn(CodexDesktopAdapter.prototype, 'probe').mockResolvedValue(capabilities);
    const dispose = vi.spyOn(CodexDesktopAdapter.prototype, 'dispose').mockRejectedValue(new Error('Closed original CDP target'));
    const runtime = await createCompanion({
      dataDirectory: await mkdtemp(join(tmpdir(), 'taskboard-retirement-')),
      port: 0, launcherControl: control,
    });
    const headers = { 'x-taskboard-companion-key': runtime.clientKey };
    const request = (install = false) => runtime.app.inject({ method: install ? 'POST' : 'GET', url: install ? '/v1/codex/install' : '/v1/codex/probe', headers });
    const stop = async () => { dispose.mockResolvedValue(); await runtime.stop(); };
    expect((await request()).json().data).toEqual(capabilities);
    return { session, exited, probe, dispose, request, stop };
  }

  it('keeps failed cleanup blocked for unknown or changed live sessions, then recovers only with an original-process exit receipt', async () => {
    const f = await fixture();
    try {
      f.session.mockResolvedValue(undefined);
      expect((await f.request(true)).json().error.code).toBe('RESTORATION_UNCONFIRMED');
      f.session.mockResolvedValue(replacement);
      expect((await f.request(true)).json().error.code).toBe('RESTORATION_UNCONFIRMED');
      expect(f.probe).toHaveBeenCalledTimes(1);
      expect(f.dispose).toHaveBeenCalledTimes(1);
      f.exited.mockResolvedValue(true);
      expect((await f.request()).json().data).toEqual(capabilities);
      expect(f.exited).toHaveBeenLastCalledWith(original);
      expect(f.probe).toHaveBeenCalledTimes(2);
      expect(f.dispose).toHaveBeenCalledTimes(1);
    } finally { await f.stop(); }
  });

  it('retires an already exited original before the next launch and binds the later replacement', async () => {
    const f = await fixture();
    try {
      f.session.mockResolvedValue(undefined);
      f.exited.mockResolvedValue(true);
      expect((await f.request(true)).json().error.code).toBe('ADAPTER_UNAVAILABLE');
      f.session.mockResolvedValue(replacement);
      expect((await f.request()).json().data).toEqual(capabilities);
      expect(f.exited).toHaveBeenCalledWith(original);
      expect(f.dispose).toHaveBeenCalledTimes(1);
    } finally { await f.stop(); }
  });

  it('shares one retirement when requests arrive during a process replacement', async () => {
    const f = await fixture();
    let finishDispose: (() => void) | undefined;
    try {
      f.session.mockResolvedValue(replacement);
      f.exited.mockResolvedValue(true);
      f.dispose.mockImplementationOnce(() => new Promise<void>(resolve => { finishDispose = resolve; }));
      const first = f.request();
      const second = f.request();
      await vi.waitFor(() => expect(finishDispose).toBeTypeOf('function'));
      finishDispose!();
      const replies = await Promise.all([first, second]);
      expect(replies.map(reply => reply.json().data)).toEqual([capabilities, capabilities]);
      expect(f.dispose).toHaveBeenCalledTimes(1);
      expect(f.exited).not.toHaveBeenCalled();
    } finally { finishDispose?.(); await f.stop(); }
  });
});
