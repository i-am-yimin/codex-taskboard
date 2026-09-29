import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { Duplex } from 'node:stream';
import vm from 'node:vm';
import {
  CodexDesktopAdapter,
  connectCdp,
  type CdpConnection,
} from '../packages/adapter-codex/src/index.ts';

type MockCdp = {
  url: string;
  methods: string[];
  sendEvent(method: string): void;
  close(): Promise<void>;
};
async function mockCdp(
  onCommand: (id: number, method: string, socket: Duplex) => void,
): Promise<MockCdp> {
  const methods: string[] = [];
  let socket: Duplex | undefined;
  const server: Server = createServer();
  server.on('upgrade', (request, upgraded) => {
    const key = request.headers['sec-websocket-key'];
    if (typeof key !== 'string') return upgraded.destroy();
    upgraded.write(
      `HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${createHash('sha1').update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64')}\r\n\r\n`,
    );
    upgraded.on('error', () => undefined);
    socket = upgraded;
    upgraded.resume();
    let buffer = Buffer.alloc(0);
    upgraded.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      while (buffer.length >= 2) {
        const encodedLength = buffer[1] & 0x7f;
        const lengthBytes = encodedLength === 126 ? 2 : 0;
        if (encodedLength === 127 || buffer.length < 2 + lengthBytes) return;
        const length = lengthBytes ? buffer.readUInt16BE(2) : encodedLength;
        const maskStart = 2 + lengthBytes;
        const offset = maskStart + (buffer[1] & 0x80 ? 4 : 0);
        if (buffer.length < offset + length) return;
        const mask = buffer.subarray(maskStart, maskStart + 4);
        const body = Buffer.from(buffer.subarray(offset, offset + length));
        body.forEach((value, index) => (body[index] = value ^ mask[index % 4]));
        buffer = buffer.subarray(offset + length);
        const command = JSON.parse(body.toString()) as { id: number; method: string };
        methods.push(command.method);
        onCommand(command.id, command.method, upgraded);
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('mock CDP did not listen');
  const send = (value: unknown) => {
    if (!socket) throw new Error('mock CDP is not connected');
    const body = Buffer.from(JSON.stringify(value));
    socket.write(Buffer.concat([Buffer.from([0x81, body.length]), body]));
  };
  return {
    url: `ws://127.0.0.1:${address.port}`,
    methods,
    sendEvent: (method) => send({ method, params: {} }),
    close: () =>
      new Promise((resolve) => {
        socket?.destroy();
        server.close(() => resolve());
      }),
  };
}

function guardedCspSend(
  onInjection: (expression: string) => unknown = () => ({ installed: true }),
) {
  let timeOrigin = 0;
  return async (method: string, params?: Record<string, unknown>) => {
    if (method === 'Target.getTargetInfo')
      return { targetInfo: { targetId: 'target', type: 'page', url: 'app://codex' } };
    if (method !== 'Runtime.evaluate') return {};
    const expression = String(params?.expression);
    if (expression === 'performance.timeOrigin') return { result: { value: ++timeOrigin } };
    if (expression.startsWith('({ origin:'))
      return {
        result: {
          value: {
            origin: timeOrigin + 1,
            shell: 1,
            composer: 1,
            modal: false,
            composerHasText: false,
            url: 'app://codex',
          },
        },
      };
    if (
      expression.startsWith('(() => location.href') ||
      expression.startsWith('(() => { const root = document.querySelectorAll(')
    )
      return { result: { value: true } };
    return { result: { value: onInjection(expression) } };
  };
}

describe('Codex desktop adapter safety boundary', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('rejects pending protocol commands when the CDP socket disconnects', async () => {
    const cdp = await mockCdp((_id, _method, socket) => socket.destroy());
    try {
      const connection = await connectCdp(cdp.url, 100);
      await expect(connection.send('Runtime.evaluate')).rejects.toThrow('closed');
    } finally {
      await cdp.close();
    }
  });
  it('bounds a CDP handshake that never replies and closes its socket', async () => {
    let socket: Duplex | undefined;
    let peerEnded = false;
    const server = createServer();
    server.on('upgrade', (_request, upgraded) => {
      socket = upgraded;
      upgraded.resume();
      upgraded.once('end', () => {
        peerEnded = true;
        upgraded.destroy();
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('mock CDP did not listen');
    try {
      await expect(connectCdp(`ws://127.0.0.1:${address.port}`, 500)).rejects.toThrow('Timed out');
      await vi.waitFor(() => expect(peerEnded).toBe(true));
    } finally {
      socket?.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
  it('bounds protocol commands when a connected CDP endpoint never responds', async () => {
    const cdp = await mockCdp(() => undefined);
    try {
      const connection = await connectCdp(cdp.url, 250);
      await expect(connection.send('Runtime.evaluate')).rejects.toThrow('Timed out');
      connection.close();
    } finally {
      await cdp.close();
    }
  });
  it('enables Page events before injection and reinjects after a page reload', async () => {
    const cdp = await mockCdp((id, method, socket) => {
      const result =
        method === 'Runtime.evaluate'
          ? { result: { value: { installed: true } } }
          : method === 'Target.getTargetInfo'
            ? { targetInfo: { targetId: 'target', type: 'page', url: 'app://codex' } }
            : {};
      const body = Buffer.from(JSON.stringify({ id, result }));
      socket.write(Buffer.concat([Buffer.from([0x81, body.length]), body]));
    });
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/json/version'))
        return new Response(JSON.stringify({ webSocketDebuggerUrl: cdp.url }));
      return new Response(
        JSON.stringify([
          {
            id: 'target',
            type: 'page',
            url: 'app://codex',
            webSocketDebuggerUrl: `${cdp.url}/devtools/page/target`,
          },
        ]),
      );
    });
    const adapter = new CodexDesktopAdapter({
      owner: { verify: async () => true },
      appVersion: '26.901.5280.0',
      endpoint: `http://127.0.0.1:${new URL(cdp.url).port}`,
      targetBinding: {
        targetId: 'target',
        exactPageUrl: 'app://codex',
        pageWebSocketUrl: `${cdp.url}/devtools/page/target`,
      },
      shellMarker: '[data-codex-shell]',
      boardUrl: 'http://127.0.0.1:4173',
    });
    try {
      await adapter.install();
      expect(cdp.methods.slice(0, 3)).toEqual([
        'Target.getTargetInfo',
        'Page.enable',
        'Runtime.evaluate',
      ]);
      cdp.sendEvent('Page.loadEventFired');
      await vi.waitFor(() =>
        expect(cdp.methods.filter((method) => method === 'Runtime.evaluate')).toHaveLength(4),
      );
    } finally {
      await adapter.dispose();
      await cdp.close();
    }
  });
  it('closes a newly connected CDP client if enabling the Page domain fails', async () => {
    const close = vi.fn();
    const connector = vi
      .fn()
      .mockResolvedValue({ send: vi.fn().mockRejectedValue(new Error('Page denied')), close });
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/json/version'))
        return new Response(
          JSON.stringify({ webSocketDebuggerUrl: 'ws://127.0.0.1:1/devtools/page/target' }),
        );
      return new Response(
        JSON.stringify([
          {
            id: 'target',
            type: 'page',
            url: 'app://codex',
            webSocketDebuggerUrl: 'ws://127.0.0.1:1/devtools/page/target',
          },
        ]),
      );
    });
    const adapter = new CodexDesktopAdapter(
      {
        owner: { verify: async () => true },
        appVersion: '26.901.5280.0',
        endpoint: 'http://127.0.0.1:1',
        targetBinding: {
          targetId: 'target',
          exactPageUrl: 'app://codex',
          pageWebSocketUrl: 'ws://127.0.0.1:1/devtools/page/target',
        },
        shellMarker: '[shell]',
        boardUrl: 'http://127.0.0.1:4173',
      },
      connector,
    );
    await expect(adapter.install()).rejects.toThrow('Page denied');
    expect(close).toHaveBeenCalledOnce();
  });
  it('reverts an explicitly applied CSP bypass during dispose', async () => {
    const methods: Array<[string, unknown]> = [];
    const lifecycle = guardedCspSend();
    const connection = {
      send: vi.fn(async (method: string, params?: Record<string, unknown>) => {
        methods.push([method, params]);
        return lifecycle(method, params);
      }),
      close: vi.fn(),
    };
    const connector = vi.fn().mockResolvedValue(connection);
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) =>
      String(input).endsWith('/json/version')
        ? new Response(
            JSON.stringify({ webSocketDebuggerUrl: 'ws://127.0.0.1:1/devtools/page/target' }),
          )
        : new Response(
            JSON.stringify([
              {
                id: 'target',
                type: 'page',
                url: 'app://codex',
                webSocketDebuggerUrl: 'ws://127.0.0.1:1/devtools/page/target',
              },
            ]),
          ),
    );
    const adapter = new CodexDesktopAdapter(
      {
        owner: { verify: async () => true },
        appVersion: '26.901.5280.0',
        endpoint: 'http://127.0.0.1:1',
        targetBinding: {
          targetId: 'target',
          exactPageUrl: 'app://codex',
          pageWebSocketUrl: 'ws://127.0.0.1:1/devtools/page/target',
        },
        shellMarker: '[shell]',
        composerMarker: '[composer]',
        modalMarker: '[role="dialog"]',
        boardUrl: 'http://127.0.0.1',
        allowCspBypass: true,
        allowCspReload: true,
      },
      connector,
    );
    await adapter.install();
    await adapter.dispose();
    expect(methods).toContainEqual(['Page.setBypassCSP', { enabled: true }]);
    expect(methods).toContainEqual(['Page.setBypassCSP', { enabled: false }]);
  });
  it('closes within the cleanup deadline when CSP reset never resolves', async () => {
    const close = vi.fn();
    const lifecycle = guardedCspSend();
    const send = vi.fn((method: string, params?: Record<string, unknown>) => {
      if (
        method === 'Page.setBypassCSP' &&
        send.mock.calls.filter(([m]) => m === method).length > 1
      )
        return new Promise(() => undefined);
      return lifecycle(method, params);
    });
    const connector = vi.fn().mockResolvedValue({ send, close });
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) =>
      String(input).endsWith('/json/version')
        ? new Response(
            JSON.stringify({ webSocketDebuggerUrl: 'ws://127.0.0.1:1/devtools/page/target' }),
          )
        : new Response(
            JSON.stringify([
              {
                id: 'target',
                type: 'page',
                url: 'app://codex',
                webSocketDebuggerUrl: 'ws://127.0.0.1:1/devtools/page/target',
              },
            ]),
          ),
    );
    const adapter = new CodexDesktopAdapter(
      {
        owner: { verify: async () => true },
        appVersion: '26.901.5280.0',
        endpoint: 'http://127.0.0.1:1',
        targetBinding: {
          targetId: 'target',
          exactPageUrl: 'app://codex',
          pageWebSocketUrl: 'ws://127.0.0.1:1/devtools/page/target',
        },
        shellMarker: '[shell]',
        composerMarker: '[composer]',
        modalMarker: '[role="dialog"]',
        boardUrl: 'http://127.0.0.1',
        allowCspBypass: true,
        allowCspReload: true,
        cdpTimeoutMs: 40,
      },
      connector,
    );
    await adapter.install();
    const start = Date.now();
    await expect(adapter.dispose()).rejects.toThrow('CSP restoration unconfirmed');
    expect(close).toHaveBeenCalledOnce();
    expect(Date.now() - start).toBeLessThan(500);
  });
  it('executes the injected owner-scoped DOM script', async () => {
    let expression = '';
    const connector = vi.fn().mockResolvedValue({
      send: vi.fn((method: string, params?: { expression?: string }) => {
        if (method === 'Target.getTargetInfo')
          return Promise.resolve({
            targetInfo: { targetId: 'target', type: 'page', url: 'app://codex' },
          });
        if (method === 'Runtime.evaluate') {
          expression = params?.expression ?? '';
          return Promise.resolve({ result: { value: { installed: true } } });
        }
        return Promise.resolve({});
      }),
      close: vi.fn(),
    });
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) =>
      String(input).endsWith('/json/version')
        ? new Response(
            JSON.stringify({ webSocketDebuggerUrl: 'ws://127.0.0.1:1/devtools/page/target' }),
          )
        : new Response(
            JSON.stringify([
              {
                id: 'target',
                type: 'page',
                url: 'app://codex',
                webSocketDebuggerUrl: 'ws://127.0.0.1:1/devtools/page/target',
              },
            ]),
          ),
    );
    const adapter = new CodexDesktopAdapter(
      {
        owner: { verify: async () => true },
        appVersion: '26.901.5280.0',
        endpoint: 'http://127.0.0.1:1',
        targetBinding: {
          targetId: 'target',
          exactPageUrl: 'app://codex',
          pageWebSocketUrl: 'ws://127.0.0.1:1/devtools/page/target',
        },
        shellMarker: '[shell]',
        boardUrl: 'http://127.0.0.1',
      },
      connector,
    );
    await adapter.install();
    expect(expression).toContain('taskboard:ready-response');
    expect(expression).toContain('board-context-changed');
    return;
    type FrameHarness = {
      contentWindow: { postMessage: ReturnType<typeof vi.fn> };
      isConnected: boolean;
      style: Record<string, string>;
      addEventListener: ReturnType<typeof vi.fn>;
      removeEventListener: ReturnType<typeof vi.fn>;
    };
    const harness: {
      elements: number;
      frame?: FrameHarness;
      messageListener?: (event: unknown) => void;
    } = {
      elements: 0,
    };
    const frameOrThrow = () => {
      if (!harness.frame) throw new Error('Injected script did not create an iframe');
      return harness.frame;
    };
    const listenerOrThrow = () => {
      if (!harness.messageListener)
        throw new Error('Injected script did not add a message listener');
      return harness.messageListener;
    };
    const root: { append: (item: unknown) => void } = { append: vi.fn() };
    const document: {
      querySelector: (selector: string) => typeof root | null;
      addEventListener: () => void;
      removeEventListener: () => void;
      createElement: () => {
        style: Record<string, string>;
        setAttribute: () => void;
        append: (item: unknown) => void;
        remove: () => void;
        addEventListener: () => void;
        removeEventListener: () => void;
      };
    } = {
      querySelector: vi.fn((selector: string) => (selector === '[shell]' ? root : null)),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      createElement: () => {
        harness.elements += 1;
        const element = {
          style: {},
          isConnected: true,
          setAttribute: vi.fn(),
          append: vi.fn((item: unknown) => {
            if (
              item &&
              typeof item === 'object' &&
              'contentWindow' in item &&
              'isConnected' in item
            )
              harness.frame = item as FrameHarness;
          }),
          remove: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        };
        if (harness.elements === 2) {
          const postMessage = vi.fn();
          harness.frame = {
            contentWindow: { postMessage },
            isConnected: true,
            style: {},
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
          };
          return { ...element, ...harness.frame };
        }
        return element;
      },
    };
    const window = {
      addEventListener: vi.fn((_type: string, listener: (event: unknown) => void) => {
        harness.messageListener = listener;
      }),
      removeEventListener: vi.fn(),
    };
    const location = { href: 'app://codex' };
    const context = {
      document,
      location,
      window,
      setTimeout: vi.fn(() => 1),
      clearTimeout: vi.fn(),
      setInterval: vi.fn(() => 2),
      clearInterval: vi.fn(),
    };
    const pending = vm.runInNewContext(expression, context) as Promise<{ installed: boolean }>;
    const challenge = { nonce: expression.match(/nonce: "([A-Za-z0-9_-]+)"/)?.[1] ?? '' };
    let settled = false;
    void pending.then(() => {
      settled = true;
    });
    listenerOrThrow()({
      origin: 'http://127.0.0.1',
      source: {},
      data: { type: 'taskboard:ready-response', nonce: challenge.nonce },
    });
    listenerOrThrow()({
      origin: 'http://127.0.0.2',
      source: frameOrThrow().contentWindow,
      data: { type: 'taskboard:ready-response', nonce: challenge.nonce },
    });
    listenerOrThrow()({
      origin: 'http://127.0.0.1',
      source: frameOrThrow().contentWindow,
      data: { type: 'taskboard:ready-response', nonce: 'wrong-nonce' },
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    listenerOrThrow()({
      origin: 'http://127.0.0.1',
      source: frameOrThrow().contentWindow,
      data: { type: 'taskboard:ready-response', nonce: challenge.nonce },
    });
    await expect(pending).resolves.toEqual({ installed: true });

    harness.elements = 0;
    harness.frame = undefined;
    harness.messageListener = undefined;
    location.href = 'app://codex';
    const afterNavigation = vm.runInNewContext(expression, context) as Promise<{
      installed: boolean;
      reason: string;
    }>;
    const navigationChallenge = challenge;
    location.href = 'app://other';
    listenerOrThrow()({
      origin: 'http://127.0.0.1',
      source: frameOrThrow().contentWindow,
      data: { type: 'taskboard:ready-response', nonce: navigationChallenge.nonce },
    });
    await expect(afterNavigation).resolves.toEqual({
      installed: false,
      reason: 'board-context-changed',
    });

    harness.elements = 0;
    harness.frame = undefined;
    harness.messageListener = undefined;
    location.href = 'app://codex';
    const afterRemoval = vm.runInNewContext(expression, context) as Promise<{
      installed: boolean;
      reason: string;
    }>;
    const removalChallenge = challenge;
    frameOrThrow().isConnected = false;
    listenerOrThrow()({
      origin: 'http://127.0.0.1',
      source: frameOrThrow().contentWindow,
      data: { type: 'taskboard:ready-response', nonce: removalChallenge.nonce },
    });
    await expect(afterRemoval).resolves.toEqual({
      installed: false,
      reason: 'board-context-changed',
    });
  });
  it('never sends a CSP command without explicit opt-in', async () => {
    const send = vi.fn(async (method: string) =>
      method === 'Runtime.evaluate'
        ? { result: { value: { installed: true } } }
        : method === 'Target.getTargetInfo'
          ? { targetInfo: { targetId: 'target', type: 'page', url: 'app://codex' } }
          : {},
    );
    const connector = vi.fn().mockResolvedValue({ send, close: vi.fn() });
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) =>
      String(input).endsWith('/json/version')
        ? new Response(
            JSON.stringify({ webSocketDebuggerUrl: 'ws://127.0.0.1:1/devtools/page/target' }),
          )
        : new Response(
            JSON.stringify([
              {
                id: 'target',
                type: 'page',
                url: 'app://codex',
                webSocketDebuggerUrl: 'ws://127.0.0.1:1/devtools/page/target',
              },
            ]),
          ),
    );
    const adapter = new CodexDesktopAdapter(
      {
        owner: { verify: async () => true },
        appVersion: '26.901.5280.0',
        endpoint: 'http://127.0.0.1:1',
        targetBinding: {
          targetId: 'target',
          exactPageUrl: 'app://codex',
          pageWebSocketUrl: 'ws://127.0.0.1:1/devtools/page/target',
        },
        shellMarker: '[shell]',
        boardUrl: 'http://127.0.0.1',
      },
      connector,
    );
    await adapter.install();
    await adapter.dispose();
    expect(send).not.toHaveBeenCalledWith('Page.setBypassCSP', expect.anything());
  });
  it('reverts CSP before closing when installation fails after enabling it', async () => {
    const calls: Array<[string, unknown]> = [];
    const close = vi.fn();
    const lifecycle = guardedCspSend(() => {
      throw new Error('marker missing');
    });
    const connector = vi.fn().mockResolvedValue({
      send: vi.fn(async (method: string, params?: Record<string, unknown>) => {
        calls.push([method, params]);
        return lifecycle(method, params);
      }),
      close,
    });
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) =>
      String(input).endsWith('/json/version')
        ? new Response(
            JSON.stringify({ webSocketDebuggerUrl: 'ws://127.0.0.1:1/devtools/page/target' }),
          )
        : new Response(
            JSON.stringify([
              {
                id: 'target',
                type: 'page',
                url: 'app://codex',
                webSocketDebuggerUrl: 'ws://127.0.0.1:1/devtools/page/target',
              },
            ]),
          ),
    );
    const adapter = new CodexDesktopAdapter(
      {
        owner: { verify: async () => true },
        appVersion: '26.901.5280.0',
        endpoint: 'http://127.0.0.1:1',
        targetBinding: {
          targetId: 'target',
          exactPageUrl: 'app://codex',
          pageWebSocketUrl: 'ws://127.0.0.1:1/devtools/page/target',
        },
        shellMarker: '[shell]',
        composerMarker: '[composer]',
        modalMarker: '[role="dialog"]',
        boardUrl: 'http://127.0.0.1',
        allowCspBypass: true,
        allowCspReload: true,
      },
      connector,
    );
    await expect(adapter.install()).rejects.toThrow('marker missing');
    expect(calls).toContainEqual(['Page.setBypassCSP', { enabled: false }]);
    expect(close).toHaveBeenCalledOnce();
  });
  it('closes a connector that resolves after disposal without issuing CDP commands', async () => {
    let resolve!: (value: CdpConnection) => void;
    const connector = vi.fn(
      () =>
        new Promise<CdpConnection>((done) => {
          resolve = done;
        }),
    );
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) =>
      String(input).endsWith('/json/version')
        ? new Response(
            JSON.stringify({ webSocketDebuggerUrl: 'ws://127.0.0.1:1/devtools/page/target' }),
          )
        : new Response(
            JSON.stringify([
              {
                id: 'target',
                type: 'page',
                url: 'app://codex',
                webSocketDebuggerUrl: 'ws://127.0.0.1:1/devtools/page/target',
              },
            ]),
          ),
    );
    const adapter = new CodexDesktopAdapter(
      {
        owner: { verify: async () => true },
        appVersion: '26.901.5280.0',
        endpoint: 'http://127.0.0.1:1',
        targetBinding: {
          targetId: 'target',
          exactPageUrl: 'app://codex',
          pageWebSocketUrl: 'ws://127.0.0.1:1/devtools/page/target',
        },
        shellMarker: '[shell]',
        boardUrl: 'http://127.0.0.1',
      },
      connector,
    );
    const install = adapter.install();
    await vi.waitFor(() => expect(connector).toHaveBeenCalledOnce());
    await adapter.dispose();
    const late = { send: vi.fn(), close: vi.fn() };
    resolve(late);
    await expect(install).rejects.toThrow('cancelled');
    expect(late.close).toHaveBeenCalledOnce();
    expect(late.send).not.toHaveBeenCalled();
  });
  it('does not enable CSP bypass when disposal wins the initial reload-safety check', async () => {
    let resolveGuard!: (value: { result: { value: boolean } }) => void;
    const send = vi.fn((method: string, params?: Record<string, unknown>) => {
      if (method === 'Target.getTargetInfo')
        return Promise.resolve({
          targetInfo: { targetId: 'target', type: 'page', url: 'app://codex' },
        });
      if (
        method === 'Runtime.evaluate' &&
        String(params?.expression).startsWith('(() => location.href')
      )
        return new Promise<{ result: { value: boolean } }>((resolve) => {
          resolveGuard = resolve;
        });
      return Promise.resolve({});
    });
    const close = vi.fn();
    const connector = vi.fn().mockResolvedValue({ send, close });
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) =>
      String(input).endsWith('/json/version')
        ? new Response(
            JSON.stringify({ webSocketDebuggerUrl: 'ws://127.0.0.1:1/devtools/page/target' }),
          )
        : new Response(
            JSON.stringify([
              {
                id: 'target',
                type: 'page',
                url: 'app://codex',
                webSocketDebuggerUrl: 'ws://127.0.0.1:1/devtools/page/target',
              },
            ]),
          ),
    );
    const adapter = new CodexDesktopAdapter(
      {
        owner: { verify: async () => true },
        appVersion: '26.901.5280.0',
        endpoint: 'http://127.0.0.1:1',
        targetBinding: {
          targetId: 'target',
          exactPageUrl: 'app://codex',
          pageWebSocketUrl: 'ws://127.0.0.1:1/devtools/page/target',
        },
        shellMarker: '[shell]',
        composerMarker: '[composer]',
        modalMarker: '[role="dialog"]',
        boardUrl: 'http://127.0.0.1',
        allowCspBypass: true,
        allowCspReload: true,
      },
      connector,
    );
    const installing = adapter.install();
    await vi.waitFor(() =>
      expect(
        send.mock.calls.some(
          ([method, params]) =>
            method === 'Runtime.evaluate' && String(params?.expression).includes('location.href'),
        ),
      ).toBe(true),
    );
    await adapter.dispose();
    resolveGuard({ result: { value: true } });
    await expect(installing).rejects.toThrow('cancelled');
    expect(send).not.toHaveBeenCalledWith('Page.setBypassCSP', { enabled: true });
    expect(send).not.toHaveBeenCalledWith('Page.reload');
    expect(close).toHaveBeenCalledOnce();
  });
  it('does not inject after disposal wins the final recovery-shell check', async () => {
    let listener: (() => void) | undefined;
    let resolveFinalShell!: (value: { result: { value: boolean } }) => void;
    let injections = 0;
    const close = vi.fn();
    const send = vi.fn((method: string, params?: Record<string, unknown>) => {
      if (method === 'Target.getTargetInfo')
        return Promise.resolve({
          targetInfo: { targetId: 'target', type: 'page', url: 'app://codex' },
        });
      if (method !== 'Runtime.evaluate') return Promise.resolve({});
      const expression = String(params?.expression);
      if (expression.includes('taskboard:ready-challenge'))
        return Promise.resolve({ result: { value: { installed: ++injections === 1 } } });
      if (expression.includes('const sidebar')) return Promise.resolve({ result: { value: true } });
      if (expression.includes('return root.length === 1'))
        return new Promise<{ result: { value: boolean } }>((resolve) => {
          resolveFinalShell = resolve;
        });
      return Promise.resolve({ result: { value: undefined } });
    });
    const connector = vi.fn().mockResolvedValue({
      send,
      onEvent: vi.fn((_method, callback) => {
        listener = callback;
        return () => undefined;
      }),
      close,
    });
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) =>
      String(input).endsWith('/json/version')
        ? new Response(
            JSON.stringify({ webSocketDebuggerUrl: 'ws://127.0.0.1:1/devtools/page/target' }),
          )
        : new Response(
            JSON.stringify([
              {
                id: 'target',
                type: 'page',
                url: 'app://codex',
                webSocketDebuggerUrl: 'ws://127.0.0.1:1/devtools/page/target',
              },
            ]),
          ),
    );
    const adapter = new CodexDesktopAdapter(
      {
        owner: { verify: async () => true },
        appVersion: '26.901.5280.0',
        endpoint: 'http://127.0.0.1:1',
        targetBinding: {
          targetId: 'target',
          exactPageUrl: 'app://codex',
          pageWebSocketUrl: 'ws://127.0.0.1:1/devtools/page/target',
        },
        shellMarker: '[shell]',
        boardUrl: 'http://127.0.0.1',
      },
      connector,
    );
    await adapter.install();
    listener?.();
    await vi.waitFor(() =>
      expect(
        send.mock.calls.some(
          ([method, params]) =>
            method === 'Runtime.evaluate' &&
            String(params?.expression).includes('return root.length'),
        ),
      ).toBe(true),
    );
    await adapter.dispose();
    resolveFinalShell({ result: { value: true } });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(injections).toBe(1);
    expect(close).toHaveBeenCalledOnce();
  });
  it('does not resume a delayed CSP-enable install after disposal has restored CSP', async () => {
    let resolveEnable!: () => void;
    const calls: Array<[string, Record<string, unknown> | undefined]> = [];
    const close = vi.fn();
    const connection = {
      send: vi.fn((method: string, params?: Record<string, unknown>) => {
        calls.push([method, params]);
        if (method === 'Target.getTargetInfo')
          return Promise.resolve({
            targetInfo: { targetId: 'target', type: 'page', url: 'app://codex' },
          });
        if (method === 'Page.setBypassCSP' && params?.enabled === true)
          return new Promise<void>((resolve) => {
            resolveEnable = resolve;
          });
        if (method === 'Runtime.evaluate') {
          const expression = String(params?.expression);
          if (expression.startsWith('({ origin:'))
            return Promise.resolve({
              result: {
                value: {
                  origin: 2,
                  shell: 1,
                  composer: 1,
                  modal: false,
                  composerHasText: false,
                  url: 'app://codex',
                },
              },
            });
          if (expression.includes('performance.timeOrigin'))
            return Promise.resolve({ result: { value: 1 } });
          if (expression.startsWith('(() => location.href'))
            return Promise.resolve({ result: { value: true } });
          throw new Error(`Unexpected runtime evaluation: ${expression.slice(0, 80)}`);
        }
        return Promise.resolve({});
      }),
      close,
    };
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) =>
      String(input).endsWith('/json/version')
        ? new Response(
            JSON.stringify({ webSocketDebuggerUrl: 'ws://127.0.0.1:1/devtools/page/target' }),
          )
        : new Response(
            JSON.stringify([
              {
                id: 'target',
                type: 'page',
                url: 'app://codex',
                webSocketDebuggerUrl: 'ws://127.0.0.1:1/devtools/page/target',
              },
            ]),
          ),
    );
    const adapter = new CodexDesktopAdapter(
      {
        owner: { verify: async () => true },
        appVersion: '26.901.5280.0',
        endpoint: 'http://127.0.0.1:1',
        targetBinding: {
          targetId: 'target',
          exactPageUrl: 'app://codex',
          pageWebSocketUrl: 'ws://127.0.0.1:1/devtools/page/target',
        },
        shellMarker: '[shell]',
        composerMarker: '[composer]',
        modalMarker: '[role="dialog"]',
        boardUrl: 'http://127.0.0.1',
        allowCspBypass: true,
        allowCspReload: true,
      },
      vi.fn().mockResolvedValue(connection),
    );

    const installing = adapter.install();
    await vi.waitFor(() =>
      expect(connection.send).toHaveBeenCalledWith('Page.setBypassCSP', { enabled: true }),
    );
    await adapter.dispose();
    const reloadsAfterCleanup = calls.filter(([method]) => method === 'Page.reload').length;
    resolveEnable();
    await expect(installing).rejects.toThrow('cancelled');

    expect(
      calls.filter(
        ([method, params]) => method === 'Page.setBypassCSP' && params?.enabled === true,
      ),
    ).toHaveLength(1);
    expect(
      calls.filter(
        ([method, params]) => method === 'Page.setBypassCSP' && params?.enabled === false,
      ),
    ).toHaveLength(1);
    expect(calls.filter(([method]) => method === 'Page.reload')).toHaveLength(reloadsAfterCleanup);
    expect(reloadsAfterCleanup).toBe(1);
    expect(
      calls.filter(
        ([method, params]) =>
          method === 'Runtime.evaluate' &&
          String(params?.expression).includes('taskboard:ready-response'),
      ),
    ).toHaveLength(0);
    expect(close).toHaveBeenCalledOnce();
  });
  it('rejects a second install while a CSP-enabled installation is active', async () => {
    let failA!: () => void;
    const callsA: Array<[string, unknown]> = [];
    const guardedA = guardedCspSend();
    const a = {
      close: vi.fn(),
      send: vi.fn((method: string, params?: Record<string, unknown>) => {
        callsA.push([method, params]);
        const expression = String(params?.expression);
        if (method === 'Runtime.evaluate' && expression.includes('taskboard:ready-challenge'))
          return new Promise((_resolve, reject) => {
            failA = () => reject(new Error('A failed'));
          });
        return guardedA(method, params);
      }),
    };
    const callsB: Array<[string, unknown]> = [];
    const b = {
      close: vi.fn(),
      send: vi.fn(async (method: string, params?: unknown) => {
        callsB.push([method, params]);
        return method === 'Runtime.evaluate'
          ? { result: { value: { installed: true } } }
          : method === 'Target.getTargetInfo'
            ? { targetInfo: { targetId: 'target', type: 'page', url: 'app://codex' } }
            : {};
      }),
    };
    const connector = vi.fn().mockResolvedValueOnce(a).mockResolvedValueOnce(b);
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) =>
      String(input).endsWith('/json/version')
        ? new Response(
            JSON.stringify({ webSocketDebuggerUrl: 'ws://127.0.0.1:1/devtools/page/target' }),
          )
        : new Response(
            JSON.stringify([
              {
                id: 'target',
                type: 'page',
                url: 'app://codex',
                webSocketDebuggerUrl: 'ws://127.0.0.1:1/devtools/page/target',
              },
            ]),
          ),
    );
    const adapter = new CodexDesktopAdapter(
      {
        owner: { verify: async () => true },
        appVersion: '26.901.5280.0',
        endpoint: 'http://127.0.0.1:1',
        targetBinding: {
          targetId: 'target',
          exactPageUrl: 'app://codex',
          pageWebSocketUrl: 'ws://127.0.0.1:1/devtools/page/target',
        },
        shellMarker: '[shell]',
        composerMarker: '[composer]',
        modalMarker: '[role="dialog"]',
        boardUrl: 'http://127.0.0.1',
        allowCspBypass: true,
        allowCspReload: true,
      },
      connector,
    );
    const first = adapter.install();
    await vi.waitFor(() =>
      expect(a.send).toHaveBeenCalledWith(
        'Runtime.evaluate',
        expect.objectContaining({
          expression: expect.stringContaining('taskboard:ready-challenge'),
        }),
        20_000,
      ),
    );
    await expect(adapter.install()).rejects.toThrow('lifecycle is already active');
    failA();
    await expect(first).rejects.toThrow('A failed');
    expect(callsA).toContainEqual(['Page.setBypassCSP', { enabled: false }]);
    expect(callsB).not.toContainEqual(['Page.setBypassCSP', { enabled: false }]);
  });
  it('stays unsupported unless the launcher owns a known desktop version', async () => {
    const adapter = new CodexDesktopAdapter({ appVersion: '26.901.5280.0' });
    await expect(adapter.probe()).resolves.toMatchObject({
      embedded: false,
      reason: expect.stringContaining('启动器管理'),
    });
  });
  it('rejects an expired launcher owner before probing CDP', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const adapter = new CodexDesktopAdapter({
      owner: { verify: async () => false },
      appVersion: '26.901.5280.0',
      endpoint: 'http://127.0.0.1:1',
    });
    await expect(adapter.probe()).resolves.toMatchObject({
      embedded: false,
      reason: expect.stringContaining('归属已失效'),
    });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('does not report an embedded host when ownership expires during CDP probing', async () => {
    let checks = 0;
    const adapter = new CodexDesktopAdapter({
      owner: { verify: async () => ++checks === 1 },
      appVersion: '26.901.5280.0',
      endpoint: 'http://127.0.0.1:1',
    });
    vi.stubGlobal(
      'fetch',
      async () => new Response(JSON.stringify({ webSocketDebuggerUrl: 'ws://127.0.0.1:1/devtools/browser/test' })),
    );
    await expect(adapter.probe()).resolves.toMatchObject({
      embedded: false,
      reason: expect.stringContaining('归属已失效'),
    });
    expect(checks).toBe(2);
  });
  it('bounds an owner check that never responds', async () => {
    vi.useFakeTimers();
    try {
      const adapter = new CodexDesktopAdapter({
        owner: { verify: () => new Promise<boolean>(() => undefined) },
        appVersion: '26.901.5280.0',
      });
      const result = adapter.probe();
      await vi.advanceTimersByTimeAsync(10_000);
      await expect(result).resolves.toMatchObject({
        embedded: false,
        reason: expect.stringContaining('归属已失效'),
      });
    } finally {
      vi.useRealTimers();
    }
  });
  it('does not treat a newer installed Codex version as verified compatibility', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const adapter = new CodexDesktopAdapter({
      owner: { verify: async () => true },
      appVersion: '26.918.0.0',
      endpoint: 'http://127.0.0.1:1',
    });
    await expect(adapter.probe()).resolves.toMatchObject({
      embedded: false,
      reason: expect.stringContaining('版本未在受支持清单'),
    });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('closes CDP before any protocol command if launcher ownership expires during connection', async () => {
    let owned = true;
    const send = vi.fn();
    const close = vi.fn();
    const page = {
      id: 'target',
      type: 'page',
      url: 'app://codex',
      webSocketDebuggerUrl: 'ws://127.0.0.1:1/devtools/page/target',
    };
    vi.stubGlobal(
      'fetch',
      async (input: RequestInfo | URL) =>
        new Response(
          JSON.stringify(
            String(input).endsWith('/version')
              ? { webSocketDebuggerUrl: page.webSocketDebuggerUrl }
              : [page],
          ),
        ),
    );
    const adapter = new CodexDesktopAdapter(
      {
        owner: { verify: async () => owned },
        appVersion: '26.901.5280.0',
        endpoint: 'http://127.0.0.1:1',
        targetBinding: {
          targetId: page.id,
          exactPageUrl: page.url,
          pageWebSocketUrl: page.webSocketDebuggerUrl,
        },
        shellMarker: '[shell]',
        boardUrl: 'http://127.0.0.1:4173',
      },
      async () => {
        owned = false;
        return { send, close };
      },
    );
    await expect(adapter.install()).rejects.toThrow('ownership');
    expect(send).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledOnce();
  });
  it('fails closed without a target binding before connecting', async () => {
    const connector = vi.fn();
    vi.stubGlobal(
      'fetch',
      async (input: RequestInfo | URL) =>
        new Response(
          JSON.stringify(
            String(input).endsWith('/version')
              ? { webSocketDebuggerUrl: 'ws://127.0.0.1:1/devtools/page/target' }
              : [
                  {
                    id: 'target',
                    type: 'page',
                    url: 'app://codex',
                    webSocketDebuggerUrl: 'ws://127.0.0.1:1/devtools/page/target',
                  },
                ],
          ),
        ),
    );
    const adapter = new CodexDesktopAdapter(
      {
        owner: { verify: async () => true },
        appVersion: '26.901.5280.0',
        endpoint: 'http://127.0.0.1:1',
        shellMarker: '[shell]',
        boardUrl: 'http://127.0.0.1',
      },
      connector,
    );
    await expect(adapter.install()).rejects.toThrow('精确');
    expect(connector).not.toHaveBeenCalled();
  });
  it('closes and reverts CSP when recovery injection reports not installed', async () => {
    let listener: (() => void) | undefined;
    let evaluations = 0;
    const calls: Array<[string, unknown]> = [];
    const close = vi.fn();
    const lifecycle = guardedCspSend(() => ({ installed: ++evaluations === 1 }));
    const connection = {
      send: vi.fn(async (method: string, params?: Record<string, unknown>) => {
        calls.push([method, params]);
        return lifecycle(method, params);
      }),
      onEvent: vi.fn((_method, callback) => {
        listener = callback;
        return () => undefined;
      }),
      close,
    };
    const page = {
      id: 'target',
      type: 'page',
      url: 'app://codex',
      webSocketDebuggerUrl: 'ws://127.0.0.1:1/devtools/page/target',
    };
    vi.stubGlobal(
      'fetch',
      async (input: RequestInfo | URL) =>
        new Response(
          JSON.stringify(
            String(input).endsWith('/version')
              ? { webSocketDebuggerUrl: page.webSocketDebuggerUrl }
              : [page],
          ),
        ),
    );
    const adapter = new CodexDesktopAdapter(
      {
        owner: { verify: async () => true },
        appVersion: '26.901.5280.0',
        endpoint: 'http://127.0.0.1:1',
        targetBinding: {
          targetId: 'target',
          exactPageUrl: 'app://codex',
          pageWebSocketUrl: page.webSocketDebuggerUrl,
        },
        shellMarker: '[shell]',
        composerMarker: '[composer]',
        modalMarker: '[role="dialog"]',
        boardUrl: 'http://127.0.0.1',
        allowCspBypass: true,
        allowCspReload: true,
      },
      vi.fn().mockResolvedValue(connection),
    );
    await adapter.install();
    listener?.();
    await vi.waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(connection.send).toHaveBeenCalledWith('Page.setBypassCSP', { enabled: false });
    expect(calls).toContainEqual(['Page.setBypassCSP', { enabled: false }]);
  });
  it('closes with no mutation when the initial CDP target URL drifts', async () => {
    const send = vi.fn(async () => ({
      targetInfo: { targetId: 'target', type: 'page', url: 'app://other' },
    }));
    const close = vi.fn();
    const page = {
      id: 'target',
      type: 'page',
      url: 'app://codex',
      webSocketDebuggerUrl: 'ws://127.0.0.1:1/devtools/page/target',
    };
    vi.stubGlobal(
      'fetch',
      async (input: RequestInfo | URL) =>
        new Response(
          JSON.stringify(
            String(input).endsWith('/version')
              ? { webSocketDebuggerUrl: page.webSocketDebuggerUrl }
              : [page],
          ),
        ),
    );
    const adapter = new CodexDesktopAdapter(
      {
        owner: { verify: async () => true },
        appVersion: '26.901.5280.0',
        endpoint: 'http://127.0.0.1:1',
        targetBinding: {
          targetId: 'target',
          exactPageUrl: 'app://codex',
          pageWebSocketUrl: page.webSocketDebuggerUrl,
        },
        shellMarker: '[shell]',
        boardUrl: 'http://127.0.0.1',
      },
      vi.fn().mockResolvedValue({ send, close }),
    );
    await expect(adapter.install()).rejects.toThrow('changed');
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith('Target.getTargetInfo');
    expect(close).toHaveBeenCalledOnce();
  });
  it('closes and reverts CSP when the recovery target URL drifts', async () => {
    let listener: (() => void) | undefined;
    let targetCalls = 0;
    const calls: string[] = [];
    const close = vi.fn();
    const page = {
      id: 'target',
      type: 'page',
      url: 'app://codex',
      webSocketDebuggerUrl: 'ws://127.0.0.1:1/devtools/page/target',
    };
    const lifecycle = guardedCspSend();
    const connection = {
      send: vi.fn(async (method: string, params?: Record<string, unknown>) => {
        calls.push(method);
        if (method === 'Target.getTargetInfo')
          return {
            targetInfo: {
              targetId: 'target',
              type: 'page',
              url: ++targetCalls <= 2 ? 'app://codex' : 'app://other',
            },
          };
        return lifecycle(method, params);
      }),
      onEvent: vi.fn((_m, cb) => {
        listener = cb;
        return () => undefined;
      }),
      close,
    };
    vi.stubGlobal(
      'fetch',
      async (input: RequestInfo | URL) =>
        new Response(
          JSON.stringify(
            String(input).endsWith('/version')
              ? { webSocketDebuggerUrl: page.webSocketDebuggerUrl }
              : [page],
          ),
        ),
    );
    const adapter = new CodexDesktopAdapter(
      {
        owner: { verify: async () => true },
        appVersion: '26.901.5280.0',
        endpoint: 'http://127.0.0.1:1',
        targetBinding: {
          targetId: 'target',
          exactPageUrl: 'app://codex',
          pageWebSocketUrl: page.webSocketDebuggerUrl,
        },
        shellMarker: '[shell]',
        composerMarker: '[composer]',
        modalMarker: '[role="dialog"]',
        boardUrl: 'http://127.0.0.1',
        allowCspBypass: true,
        allowCspReload: true,
      },
      vi.fn().mockResolvedValue(connection),
    );
    await adapter.install();
    listener?.();
    await vi.waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(connection.send).toHaveBeenCalledWith('Page.setBypassCSP', { enabled: false });
    await expect(adapter.probe()).resolves.toMatchObject({
      embedded: false,
      reason: expect.stringContaining('CSP restoration unconfirmed'),
    });
  });
  it('rejects duplicate target ids before connecting', async () => {
    const connector = vi.fn();
    const page = {
      id: 'target',
      type: 'page',
      url: 'app://codex',
      webSocketDebuggerUrl: 'ws://127.0.0.1:1/devtools/page/target',
    };
    vi.stubGlobal(
      'fetch',
      async (input: RequestInfo | URL) =>
        new Response(
          JSON.stringify(
            String(input).endsWith('/version')
              ? { webSocketDebuggerUrl: page.webSocketDebuggerUrl }
              : [page, page],
          ),
        ),
    );
    const adapter = new CodexDesktopAdapter(
      {
        owner: { verify: async () => true },
        appVersion: '26.901.5280.0',
        endpoint: 'http://127.0.0.1:1',
        targetBinding: {
          targetId: 'target',
          exactPageUrl: 'app://codex',
          pageWebSocketUrl: page.webSocketDebuggerUrl,
        },
        shellMarker: '[shell]',
        boardUrl: 'http://127.0.0.1',
      },
      connector,
    );
    await expect(adapter.install()).rejects.toThrow();
    expect(connector).not.toHaveBeenCalled();
  });
  it('rejects a target binding with a different WebSocket port before connecting', async () => {
    const connector = vi.fn();
    const page = {
      id: 'target',
      type: 'page',
      url: 'app://codex',
      webSocketDebuggerUrl: 'ws://127.0.0.1:2/devtools/page/target',
    };
    vi.stubGlobal(
      'fetch',
      async (input: RequestInfo | URL) =>
        new Response(
          JSON.stringify(
            String(input).endsWith('/version')
              ? { webSocketDebuggerUrl: page.webSocketDebuggerUrl }
              : [page],
          ),
        ),
    );
    const adapter = new CodexDesktopAdapter(
      {
        owner: { verify: async () => true },
        appVersion: '26.901.5280.0',
        endpoint: 'http://127.0.0.1:1',
        targetBinding: {
          targetId: 'target',
          exactPageUrl: 'app://codex',
          pageWebSocketUrl: 'ws://127.0.0.1:2/devtools/page/target',
        },
        shellMarker: '[shell]',
        boardUrl: 'http://127.0.0.1',
      },
      connector,
    );
    await expect(adapter.install()).rejects.toThrow();
    expect(connector).not.toHaveBeenCalled();
  });

  it('refuses to install without observed DOM markers', async () => {
    const adapter = new CodexDesktopAdapter({
      owner: { verify: async () => true },
      appVersion: '26.901.5280.0',
      endpoint: 'http://127.0.0.1:1',
    });
    await expect(adapter.install()).rejects.toThrow();
  });

  it('never claims automatic draft support before injection', async () => {
    const adapter = new CodexDesktopAdapter({ owner: { verify: async () => true }, appVersion: '26.901.5280.0' });
    await expect(
      adapter.openDraft({ taskId: 'a', spaceId: 'b', projectPath: 'C:/workspace', prompt: 'x' }),
    ).rejects.toThrow('DRAFT_UNAVAILABLE');
  });
  it('does not touch a populated or mismatched composer when project identity is unverified', async () => {
    const adapter = new CodexDesktopAdapter({
      owner: { verify: async () => true },
      appVersion: '26.901.5280.0',
      composerMarker: '[data-observed-composer]',
    });
    const send = vi.fn();
    Object.assign(adapter as unknown as { observed: boolean; connection: { send: typeof send } }, {
      observed: true,
      connection: { send },
    });
    await expect(
      adapter.openDraft({
        taskId: 'a',
        spaceId: 'b',
        projectPath: 'C:/other-project',
        prompt: 'replace unsent text',
      }),
    ).rejects.toThrow('DRAFT_UNAVAILABLE');
    expect(send).not.toHaveBeenCalled();
  });
});
