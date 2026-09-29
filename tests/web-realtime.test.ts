import { afterEach, describe, expect, it, vi } from 'vitest';
import { subscribeDesktopBoardEvents } from '../apps/web/src/realtime.ts';

describe('desktop realtime client', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

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

  it('fails a stalled stream after the heartbeat deadline and aborts its request', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('window', { __TAURI__: { core: { invoke: vi.fn().mockResolvedValue('bridge-key') } } });
    let signal: AbortSignal | undefined;
    vi.stubGlobal('fetch', vi.fn((_url: string, options: RequestInit) => {
      signal = options.signal as AbortSignal;
      return Promise.resolve(new Response(new ReadableStream()));
    }));
    const handlers = { ready: vi.fn(), board: vi.fn(), revoked: vi.fn(), error: vi.fn() };
    const stop = subscribeDesktopBoardEvents('space-id', handlers);
    await vi.advanceTimersByTimeAsync(24_999);
    expect(handlers.error).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(handlers.error).toHaveBeenCalledOnce();
    expect(signal?.aborted).toBe(true);
    stop();
  });

  it('extends the deadline when server heartbeat frames arrive', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('window', { __TAURI__: { core: { invoke: vi.fn().mockResolvedValue('bridge-key') } } });
    let stream!: ReadableStreamDefaultController<Uint8Array>;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new ReadableStream<Uint8Array>({
      start(controller) { stream = controller; },
    }))));
    const handlers = { ready: vi.fn(), board: vi.fn(), revoked: vi.fn(), error: vi.fn() };
    const stop = subscribeDesktopBoardEvents('space-id', handlers);
    await vi.advanceTimersByTimeAsync(0);
    stream.enqueue(new TextEncoder().encode('event: ready\ndata: {}\n\n'));
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(20_000);
    stream.enqueue(new TextEncoder().encode('event: board\ndata: {"type":"heartbeat"}\n\n'));
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(handlers.ready).toHaveBeenCalledOnce();
    expect(handlers.board).toHaveBeenCalledOnce();
    expect(handlers.error).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(handlers.error).toHaveBeenCalledOnce();
    stop();
  });
});
