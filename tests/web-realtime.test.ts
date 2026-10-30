import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  connectBoardEvents,
  subscribeDesktopBoardEvents,
  type BoardEventHandlers,
} from '../apps/web/src/realtime.ts';

describe('desktop realtime client', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('parses fragmented SSE frames and preserves multi-byte payload boundaries', async () => {
    vi.stubGlobal('window', {
      __TAURI__: { core: { invoke: vi.fn().mockResolvedValue('bridge-key') } },
    });
    const bytes = new TextEncoder().encode(
      'event: ready\ndata: {"label":"中文"}\n\nevent: board\ndata: {}\n\n',
    );
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
      __TAURI__: {
        core: {
          invoke: vi.fn().mockReturnValue(new Promise<string>((resolve) => (resolveKey = resolve))),
        },
      },
    });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const stop = subscribeDesktopBoardEvents('space-id', {
      ready: vi.fn(),
      board: vi.fn(),
      revoked: vi.fn(),
      error: vi.fn(),
    });
    stop();
    resolveKey('bridge-key');
    await new Promise((resolve) => setImmediate(resolve));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports companion authentication denial as revocation instead of retryable transport failure', async () => {
    vi.stubGlobal('window', {
      __TAURI__: { core: { invoke: vi.fn().mockResolvedValue('bridge-key') } },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 401 })));
    const handlers = { ready: vi.fn(), board: vi.fn(), revoked: vi.fn(), error: vi.fn() };
    subscribeDesktopBoardEvents('space-id', handlers);
    await vi.waitFor(() => expect(handlers.revoked).toHaveBeenCalledOnce());
    expect(handlers.error).not.toHaveBeenCalled();
  });

  it('fails a stalled stream after the heartbeat deadline and aborts its request', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('window', {
      __TAURI__: { core: { invoke: vi.fn().mockResolvedValue('bridge-key') } },
    });
    let signal: AbortSignal | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, options: RequestInit) => {
        signal = options.signal as AbortSignal;
        return Promise.resolve(new Response(new ReadableStream()));
      }),
    );
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
    vi.stubGlobal('window', {
      __TAURI__: { core: { invoke: vi.fn().mockResolvedValue('bridge-key') } },
    });
    let stream!: ReadableStreamDefaultController<Uint8Array>;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              stream = controller;
            },
          }),
        ),
      ),
    );
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
  it('ignores every late frame from a read that resolves after subscription retirement', async () => {
    vi.stubGlobal('window', {
      __TAURI__: { core: { invoke: vi.fn().mockResolvedValue('bridge-key') } },
    });
    let stream!: ReadableStreamDefaultController<Uint8Array>;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              stream = controller;
            },
          }),
        ),
      ),
    );
    const handlers = { ready: vi.fn(), board: vi.fn(), revoked: vi.fn(), error: vi.fn() };
    const stop = subscribeDesktopBoardEvents('space-id', handlers);
    await new Promise((resolve) => setImmediate(resolve));
    stop();
    try {
      stream.enqueue(
        new TextEncoder().encode('event: ready\n\nevent: board\n\nevent: revoked\n\n'),
      );
    } catch {
      /* An actively cancelled reader may already be closed. */
    }
    await new Promise((resolve) => setImmediate(resolve));
    for (const handler of Object.values(handlers)) expect(handler).not.toHaveBeenCalled();
  });

  it('terminates at revoked inside a multi-frame chunk and cancels its reader', async () => {
    vi.stubGlobal('window', {
      __TAURI__: { core: { invoke: vi.fn().mockResolvedValue('bridge-key') } },
    });
    const cancel = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(
                new TextEncoder().encode('event: revoked\n\nevent: ready\n\nevent: board\n\n'),
              );
            },
            cancel,
          }),
        ),
      ),
    );
    const handlers = { ready: vi.fn(), board: vi.fn(), revoked: vi.fn(), error: vi.fn() };
    const stop = subscribeDesktopBoardEvents('space-id', handlers);
    await vi.waitFor(() => expect(handlers.revoked).toHaveBeenCalledOnce());
    expect(handlers.ready).not.toHaveBeenCalled();
    expect(handlers.board).not.toHaveBeenCalled();
    expect(handlers.error).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalledOnce();
    stop();
  });

  it('ignores a late authentication response after cleanup and cancels its body', async () => {
    vi.stubGlobal('window', {
      __TAURI__: { core: { invoke: vi.fn().mockResolvedValue('bridge-key') } },
    });
    let finish!: (response: Response) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockReturnValue(
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
      ),
    );
    const cancel = vi.fn();
    const handlers = { ready: vi.fn(), board: vi.fn(), revoked: vi.fn(), error: vi.fn() };
    const stop = subscribeDesktopBoardEvents('space-id', handlers);
    await new Promise((resolve) => setImmediate(resolve));
    stop();
    finish(new Response(new ReadableStream({ cancel }), { status: 401 }));
    await new Promise((resolve) => setImmediate(resolve));
    expect(handlers.revoked).not.toHaveBeenCalled();
    expect(handlers.error).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalledOnce();
  });
  it('retires desktop readers and watchdogs on network recovery and cancels a pending retry on dispose', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('window', {
      __TAURI__: { core: { invoke: vi.fn().mockResolvedValue('bridge-key') } },
    });
    const streams: {
      controller: ReadableStreamDefaultController<Uint8Array>;
      cancel: ReturnType<typeof vi.fn>;
      signal: AbortSignal;
    }[] = [];
    const fetchMock = vi.fn((_url: string, options: RequestInit) => {
      const cancel = vi.fn();
      return Promise.resolve(
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              streams.push({ controller, cancel, signal: options.signal as AbortSignal });
            },
            cancel,
          }),
        ),
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    const network = new EventTarget();
    let online = true;
    const handlers = {
      ready: vi.fn(),
      board: vi.fn(),
      revoked: vi.fn(),
      error: vi.fn(),
      connecting: vi.fn(),
      offline: vi.fn(),
    };
    const stop = connectBoardEvents({
      network,
      online: () => online,
      subscribe: (events) => subscribeDesktopBoardEvents('isolated-space', events),
      handlers,
    });
    await vi.advanceTimersByTimeAsync(0);
    streams[0].controller.enqueue(new TextEncoder().encode('event: ready\n\n'));
    await vi.advanceTimersByTimeAsync(0);
    expect(handlers.ready).toHaveBeenCalledOnce();
    online = false;
    network.dispatchEvent(new Event('offline'));
    await vi.advanceTimersByTimeAsync(0);
    expect(streams[0].signal.aborted).toBe(true);
    expect(streams[0].cancel).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    online = true;
    network.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(handlers.ready).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(25_000);
    expect(handlers.error).toHaveBeenCalledOnce();
    stop();
    await vi.advanceTimersByTimeAsync(100_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(streams[1].cancel).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('board connection attempt ownership', () => {
  afterEach(() => vi.useRealTimers());
  function fixture() {
    const network = new EventTarget();
    let online = true;
    const streams: { handlers: BoardEventHandlers; close: ReturnType<typeof vi.fn> }[] = [];
    const handlers = {
      ready: vi.fn(),
      board: vi.fn(),
      revoked: vi.fn(),
      error: vi.fn(),
      connecting: vi.fn(),
      offline: vi.fn(),
    };
    const subscribe = vi.fn((events: BoardEventHandlers) => {
      const close = vi.fn(() => events.error()); // A close can itself produce a queued error.
      streams.push({ handlers: events, close });
      return close;
    });
    const stop = connectBoardEvents({ network, online: () => online, subscribe, handlers });
    return {
      streams,
      handlers,
      stop,
      subscribe,
      network,
      setOnline: (value: boolean) => {
        online = value;
        network.dispatchEvent(new Event(value ? 'online' : 'offline'));
      },
    };
  }

  it('retires before close and requires confirmation from the replacement attempt after a short outage', () => {
    vi.useFakeTimers();
    const f = fixture();
    f.streams[0].handlers.ready();
    expect(f.handlers.ready).toHaveBeenCalledOnce();
    f.setOnline(false);
    expect(f.streams[0].close).toHaveBeenCalledOnce();
    f.setOnline(true);
    expect(f.streams).toHaveLength(2);
    for (const event of ['ready', 'board', 'revoked', 'error'] as const)
      f.streams[0].handlers[event]();
    expect(f.handlers.ready).toHaveBeenCalledOnce();
    expect(f.handlers.board).not.toHaveBeenCalled();
    expect(f.handlers.revoked).not.toHaveBeenCalled();
    expect(f.handlers.error).not.toHaveBeenCalled();
    f.streams[1].handlers.board();
    expect(f.handlers.board).toHaveBeenCalledOnce();
    f.stop();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cancels pending retry on offline/disposal and queued old callbacks cannot revive it', () => {
    vi.useFakeTimers();
    const f = fixture();
    f.streams[0].handlers.error();
    expect(f.handlers.error).toHaveBeenCalledOnce();
    f.setOnline(false);
    vi.runAllTimers();
    expect(f.streams).toHaveLength(1);
    f.setOnline(true);
    f.streams[1].handlers.error();
    f.stop();
    for (const stream of f.streams)
      for (const event of ['ready', 'board', 'revoked', 'error'] as const) stream.handlers[event]();
    f.network.dispatchEvent(new Event('online'));
    vi.runAllTimers();
    expect(f.streams).toHaveLength(2);
    expect(f.handlers.ready).not.toHaveBeenCalled();
    expect(f.handlers.revoked).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('makes current revocation terminal even if online and old retry events arrive again', () => {
    vi.useFakeTimers();
    const f = fixture();
    f.streams[0].handlers.error();
    vi.advanceTimersByTime(250);
    expect(f.streams).toHaveLength(2);
    f.streams[1].handlers.revoked();
    f.streams[1].handlers.ready();
    f.network.dispatchEvent(new Event('online'));
    vi.runAllTimers();
    expect(f.handlers.revoked).toHaveBeenCalledOnce();
    expect(f.handlers.ready).not.toHaveBeenCalled();
    expect(f.streams).toHaveLength(2);
    expect(vi.getTimerCount()).toBe(0);
    f.stop();
  });

  it('isolates a replacement account/space scope from all retired callbacks', () => {
    vi.useFakeTimers();
    const old = fixture();
    old.stop();
    const current = fixture();
    for (const event of ['ready', 'board', 'revoked', 'error'] as const)
      old.streams[0].handlers[event]();
    for (const handler of [
      old.handlers.ready,
      old.handlers.board,
      old.handlers.revoked,
      old.handlers.error,
    ])
      expect(handler).not.toHaveBeenCalled();
    current.streams[0].handlers.ready();
    expect(current.handlers.ready).toHaveBeenCalledOnce();
    current.stop();
  });

  it('bounds retry delays and handles a synchronous transport constructor failure', () => {
    vi.useFakeTimers();
    const handlers = {
      ready: vi.fn(),
      board: vi.fn(),
      revoked: vi.fn(),
      error: vi.fn(),
      connecting: vi.fn(),
      offline: vi.fn(),
    };
    const subscribe = vi.fn(() => {
      throw new Error('synthetic constructor failure');
    });
    const stop = connectBoardEvents({
      network: new EventTarget(),
      online: () => true,
      subscribe,
      handlers,
    });
    expect(subscribe).toHaveBeenCalledTimes(1);
    for (const delay of [250, 500, 1000, 2000, 2000]) {
      const before = subscribe.mock.calls.length;
      vi.advanceTimersByTime(delay - 1);
      expect(subscribe).toHaveBeenCalledTimes(before);
      vi.advanceTimersByTime(1);
      expect(subscribe).toHaveBeenCalledTimes(before + 1);
    }
    stop();
    expect(vi.getTimerCount()).toBe(0);
  });
});
