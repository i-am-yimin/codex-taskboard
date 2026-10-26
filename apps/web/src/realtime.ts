import { companionKey, companionOrigin } from './companionBridge';

export type BoardEventHandlers = {
  ready(): void;
  board(): void;
  revoked(): void;
  error(): void;
};

/** EventSource and fetch transports share scope/attempt ownership, including network transitions. */
export function connectBoardEvents(options: {
  subscribe(handlers: BoardEventHandlers): () => void;
  handlers: BoardEventHandlers & { connecting(): void; offline(): void };
  network: EventTarget;
  online(): boolean;
}): () => void {
  let stopped = false;
  let generation = 0;
  let retry = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let unsubscribe = () => {};
  const retire = () => {
    generation++;
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    const close = unsubscribe;
    unsubscribe = () => {};
    close();
  };
  const stop = () => {
    stopped = true;
    retire();
    options.network.removeEventListener('online', reconnect);
    options.network.removeEventListener('offline', offline);
  };
  const connect = () => {
    if (stopped) return;
    retire();
    if (!options.online()) {
      options.handlers.offline();
      return;
    }
    options.handlers.connecting();
    const attempt = generation;
    const current = () => !stopped && generation === attempt && options.online();
    const error = () => {
      if (!current()) return;
      retire();
      options.handlers.error();
      const expected = generation;
      timer = setTimeout(
        () => {
          timer = undefined;
          if (!stopped && generation === expected && options.online()) connect();
        },
        Math.min(2000, 250 * 2 ** Math.min(retry++, 4)),
      );
    };
    try {
      const close = options.subscribe({
        ready: () => {
          if (current()) {
            retry = 0;
            options.handlers.ready();
          }
        },
        board: () => {
          if (current()) {
            retry = 0;
            options.handlers.board();
          }
        },
        error,
        revoked: () => {
          if (current()) {
            stop();
            options.handlers.revoked();
          }
        },
      });
      // A transport can synchronously fail/revoke while being constructed.
      if (stopped || generation !== attempt) close();
      else unsubscribe = close;
    } catch {
      error();
    }
  };
  const offline = () => {
    if (stopped) return;
    retire();
    options.handlers.offline();
  };
  const reconnect = () => {
    if (!stopped) {
      retry = 0;
      connect();
    }
  };
  options.network.addEventListener('online', reconnect);
  options.network.addEventListener('offline', offline);
  connect();
  return stop;
}

export function subscribeBrowserBoardEvents(
  spaceId: string,
  handlers: BoardEventHandlers,
  base = '/api/v1',
): () => void {
  let stopped = false;
  const events = new EventSource(`${base}/spaces/${encodeURIComponent(spaceId)}/events`, {
    withCredentials: true,
  });
  const ready = () => {
    if (!stopped) handlers.ready();
  };
  const board = () => {
    if (!stopped) handlers.board();
  };
  const revoked = () => {
    if (!stopped) handlers.revoked();
  };
  events.addEventListener('ready', ready);
  events.addEventListener('board', board);
  events.addEventListener('revoked', revoked);
  events.onerror = () => {
    if (!stopped) handlers.error();
  };
  return () => {
    stopped = true;
    events.removeEventListener('ready', ready);
    events.removeEventListener('board', board);
    events.removeEventListener('revoked', revoked);
    events.onerror = null;
    events.close();
  };
}

/** Desktop fetch retains the companion capability boundary; no credentials enter browser SSE. */
export function subscribeDesktopBoardEvents(
  spaceId: string,
  handlers: BoardEventHandlers,
): () => void {
  const controller = new AbortController();
  let stopped = false;
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  const stop = () => {
    stopped = true;
    if (watchdog !== undefined) clearTimeout(watchdog);
    watchdog = undefined;
    controller.abort();
    void reader?.cancel().catch(() => {});
  };
  const fail = () => {
    if (!stopped) {
      stop();
      handlers.error();
    }
  };
  const revoked = () => {
    if (!stopped) {
      stop();
      handlers.revoked();
    }
  };
  const armWatchdog = () => {
    if (stopped) return;
    if (watchdog !== undefined) clearTimeout(watchdog);
    watchdog = setTimeout(fail, 25_000);
  };
  armWatchdog();
  void (async () => {
    try {
      const key = await companionKey();
      if (stopped) return;
      if (!key) {
        fail();
        return;
      }
      const response = await fetch(
        `${companionOrigin()}/api/v1/spaces/${encodeURIComponent(spaceId)}/events`,
        {
          headers: { 'x-taskboard-companion-key': key, accept: 'text/event-stream' },
          credentials: 'omit',
          signal: controller.signal,
        },
      );
      if (stopped) {
        await response.body?.cancel().catch(() => {});
        return;
      }
      if (response.status === 401 || response.status === 403) {
        revoked();
        return;
      }
      if (!response.ok || !response.body) throw new Error('Companion SSE unavailable');
      reader = response.body.getReader();
      const decoder = new TextDecoder();
      let pending = '';
      while (!stopped) {
        const { done, value } = await reader.read();
        if (stopped) return;
        if (done) break;
        pending += decoder.decode(value, { stream: true });
        const frames = pending.split(/\r?\n\r?\n/);
        pending = frames.pop() ?? '';
        for (const frame of frames) {
          if (stopped) return;
          const event = /^event:\s*([^\r\n]+)/m.exec(frame)?.[1];
          if (event === 'ready') {
            armWatchdog();
            handlers.ready();
          } else if (event === 'board') {
            armWatchdog();
            handlers.board();
          } else if (event === 'revoked') {
            revoked();
            return;
          }
        }
      }
      if (!stopped) fail();
    } catch {
      if (!stopped && !controller.signal.aborted) fail();
    } finally {
      if (watchdog !== undefined) clearTimeout(watchdog);
      reader?.releaseLock();
    }
  })();
  return stop;
}
