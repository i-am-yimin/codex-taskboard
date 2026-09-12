export type BoardEventHandlers = {
  ready(): void;
  board(): void;
  revoked(): void;
  error(): void;
};

/**
 * EventSource cannot send the renderer's local bridge capability.  Desktop
 * therefore reads the companion SSE response with fetch, keeping the remote
 * browser session and its credential inside the loopback companion.
 */
export function subscribeDesktopBoardEvents(spaceId: string, handlers: BoardEventHandlers): () => void {
  const controller = new AbortController();
  let stopped = false;
  void (async () => {
    try {
      const key = await window.__TAURI__?.core?.invoke<string>('bridge_capability');
      if (!key || stopped) {
        if (!stopped) handlers.error();
        return;
      }
      const response = await fetch(
        `http://127.0.0.1:47831/api/v1/spaces/${encodeURIComponent(spaceId)}/events`,
        {
          headers: { 'x-taskboard-companion-key': key, accept: 'text/event-stream' },
          credentials: 'omit',
          signal: controller.signal,
        },
      );
      if (response.status === 401 || response.status === 403) {
        handlers.revoked();
        return;
      }
      if (!response.ok || !response.body) throw new Error('Companion SSE unavailable');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let pending = '';
      while (!stopped) {
        const { done, value } = await reader.read();
        if (done) break;
        pending += decoder.decode(value, { stream: true });
        const frames = pending.split(/\r?\n\r?\n/);
        pending = frames.pop() ?? '';
        for (const frame of frames) {
          const event = /^event:\s*([^\r\n]+)/m.exec(frame)?.[1];
          if (event === 'ready') handlers.ready();
          else if (event === 'board') handlers.board();
          else if (event === 'revoked') handlers.revoked();
        }
      }
      if (!stopped) handlers.error();
    } catch {
      if (!stopped && !controller.signal.aborted) handlers.error();
    }
  })();
  return () => {
    stopped = true;
    controller.abort();
  };
}
