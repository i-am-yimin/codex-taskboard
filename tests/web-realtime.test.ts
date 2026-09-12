import { afterEach, describe, expect, it, vi } from 'vitest';
import { subscribeDesktopBoardEvents } from '../apps/web/src/realtime.ts';

describe('desktop realtime client', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('parses fragmented SSE frames and preserves multi-byte payload boundaries', async () => {
    vi.stubGlobal('window', { __TAURI__: { core: { invoke: vi.fn().mockResolvedValue('bridge-key') } } });
    const bytes = new TextEncoder().encode('event: ready\ndata: {"label":"中文"}\n\nevent: board\ndata: {}\n\n');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(bytes.slice(0, 29));
              controller.enqueue(bytes.slice(29, 31));
              controller.enqueue(bytes.slice(31));
              controller.close();
            },
          }),
          { headers: { 'content-type': 'text/event-stream' } },
        ),
      ),
    );
    const handlers = { ready: vi.fn(), board: vi.fn(), revoked: vi.fn(), error: vi.fn() };
    subscribeDesktopBoardEvents('space-id', handlers);
    await vi.waitFor(() => expect(handlers.board).toHaveBeenCalledOnce());
    expect(handlers.ready).toHaveBeenCalledOnce();
    expect(handlers.revoked).not.toHaveBeenCalled();
  });

  it('does not open a stream after cleanup while capability retrieval is pending', async () => {
    let resolveKey!: (key: string) => void;
    vi.stubGlobal('window', {
      __TAURI__: { core: { invoke: vi.fn().mockReturnValue(new Promise<string>((resolve) => (resolveKey = resolve))) } },
    });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const stop = subscribeDesktopBoardEvents('space-id', {
      ready: vi.fn(), board: vi.fn(), revoked: vi.fn(), error: vi.fn(),
    });
    stop();
    resolveKey('bridge-key');
    await new Promise((resolve) => setImmediate(resolve));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports companion authentication denial as revocation instead of retryable transport failure', async () => {
    vi.stubGlobal('window', { __TAURI__: { core: { invoke: vi.fn().mockResolvedValue('bridge-key') } } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 401 })));
    const handlers = { ready: vi.fn(), board: vi.fn(), revoked: vi.fn(), error: vi.fn() };
    subscribeDesktopBoardEvents('space-id', handlers);
    await vi.waitFor(() => expect(handlers.revoked).toHaveBeenCalledOnce());
    expect(handlers.error).not.toHaveBeenCalled();
  });
});
