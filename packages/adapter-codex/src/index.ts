import type {
  AdapterCapabilities,
  AgentAdapter,
  DraftRequest,
  LocalProject,
} from '@taskboard/core';
import { randomBytes } from 'node:crypto';
import { realpathSync } from 'node:fs';
import WebSocket from 'ws';
import { resolveCodexProject } from './project-identity.ts';

/** The only desktop version this adapter knows how to inspect. A successful CDP
 * connection is deliberately not enough to mark a user's Codex installation as
 * supported: the host DOM must be observed through an explicit marker. */
export const SUPPORTED_CODEX_VERSIONS = ['26.901.5280.0', '26.917.9434.0', '26.924.1866.0', '26.924.2738.0', '26.928.1915.0', '26.930.7945.0'] as const;

/** Version-specific markers confirmed on an isolated host. Native launch support
 * has a separate gate: recognizing a host does not prove process ownership. */
export function codexHostMarkers(version: string) {
  if (!SUPPORTED_CODEX_VERSIONS.includes(version as (typeof SUPPORTED_CODEX_VERSIONS)[number]))
    throw new Error('Unsupported Codex host version');
  const redesignedShell = version === '26.924.1866.0' || version === '26.924.2738.0' || version === '26.928.1915.0' || version === '26.930.7945.0';
  return {
    shellMarker: 'div:has(>aside.app-shell-left-panel)',
    sidebarMarker: redesignedShell
      ? '.app-shell-left-panel nav:not([data-app-navigation-rail])'
      : '.app-shell-left-panel nav',
    contentMarker: redesignedShell
      ? 'main[data-app-shell-main-surface]'
      : '.app-shell-left-panel + div',
    composerMarker: '[contenteditable="true"][role="textbox"]',
    modalMarker: '[role="dialog"]',
  };
}
const OWNER_VERIFY_TIMEOUT_MS = 10_000;

export interface ManagedCodexOwner {
  /** Rechecks the launcher-held process and loopback listener before host mutation. */
  verify(): Promise<boolean>;
}

export interface CodexCdpConfig {
  endpoint?: string;
  appVersion?: string;
  /** Private launcher session directory, never supplied by the web renderer. */
  codexHome?: string;
  boardUrl?: string;
  owner?: ManagedCodexOwner;
  /** CSP bypass is never implicit and is only valid for the launcher process. */
  allowCspBypass?: boolean;
  /** Explicitly permits the guarded reload required to apply a CSP change. */
  allowCspReload?: boolean;
  shellMarker?: string;
  /** Observed Codex selectors for the optional native sidebar entry and content pane. */
  sidebarMarker?: string;
  contentMarker?: string;
  composerMarker?: string;
  modalMarker?: string;
  /** Bounds CDP connect, commands, and teardown; never wait on Codex indefinitely. */
  cdpTimeoutMs?: number;
  /** Maximum time to wait for the reloaded Codex shell and composer. 5–120 seconds. */
  hostReadyTimeoutMs?: number;
  targetBinding?: { targetId: string; exactPageUrl: string; pageWebSocketUrl: string };
}

export interface CdpConnection {
  send<T = unknown>(
    method: string,
    params?: Record<string, unknown>,
    timeoutMs?: number,
  ): Promise<T>;
  onEvent?(method: string, listener: () => void): () => void;
  close(): void;
}

export type CdpConnector = (webSocketDebuggerUrl: string) => Promise<CdpConnection>;

type VersionResponse = { webSocketDebuggerUrl?: string };
type PageTarget = { id?: string; type: string; url: string; webSocketDebuggerUrl?: string };

function loopbackEndpoint(value: string): URL {
  const url = new URL(value);
  if (
    !['127.0.0.1', '[::1]'].includes(url.hostname) ||
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  ) {
    throw new Error('CDP endpoint must bind to loopback');
  }
  return url;
}

function boardEndpoint(value: string): URL {
  const url = new URL(value);
  if (
    !['127.0.0.1', '[::1]'].includes(url.hostname) ||
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error('Taskboard board URL must be a credential-free literal loopback HTTP(S) URL');
  return url;
}

export async function fetchCdpVersion(
  endpoint = 'http://127.0.0.1:9222',
): Promise<VersionResponse> {
  const url = loopbackEndpoint(endpoint);
  url.pathname = '/json/version';
  const response = await fetch(url, { signal: AbortSignal.timeout(1_500), redirect: 'error' });
  if (!response.ok) throw new Error(`CDP probe returned ${response.status}`);
  const body = (await response.json()) as VersionResponse;
  if (body.webSocketDebuggerUrl !== undefined && typeof body.webSocketDebuggerUrl !== 'string')
    throw new Error('Invalid CDP version response');
  return body;
}

export async function fetchCdpPages(endpoint = 'http://127.0.0.1:9222'): Promise<PageTarget[]> {
  const url = loopbackEndpoint(endpoint);
  url.pathname = '/json/list';
  const response = await fetch(url, { signal: AbortSignal.timeout(1_500), redirect: 'error' });
  if (!response.ok) throw new Error(`CDP page list returned ${response.status}`);
  const body = (await response.json()) as unknown;
  if (!Array.isArray(body) || body.some((item) => !item || typeof item !== 'object'))
    throw new Error('Invalid CDP page response');
  return body as PageTarget[];
}

/** Minimal DevTools protocol connector. It deliberately exposes only commands
 * used by this adapter and has no browser-navigation or filesystem surface. */
export async function connectCdp(
  webSocketDebuggerUrl: string,
  timeoutMs = 3_000,
): Promise<CdpConnection> {
  // ws owns and aborts the underlying HTTP upgrade request on this timeout;
  // browser WebSocket.close() cannot reliably cancel a CONNECTING handshake.
  const socket = new WebSocket(webSocketDebuggerUrl, { handshakeTimeout: timeoutMs });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => finish(() => reject(new Error('Timed out connecting to Codex CDP'))),
      timeoutMs + 50,
    );
    const finish = (action: () => void) => {
      clearTimeout(timer);
      socket.off('open', opened);
      socket.off('error', failed);
      socket.off('close', closed);
      action();
    };
    const opened = () => finish(resolve);
    const failed = (error: Error) =>
      finish(() =>
        reject(
          /timed out/i.test(error.message)
            ? new Error('Timed out connecting to Codex CDP')
            : new Error('Cannot connect to Codex CDP'),
        ),
      );
    const closed = () => finish(() => reject(new Error('Codex CDP closed while connecting')));
    socket.once('open', opened);
    socket.once('error', failed);
    socket.once('close', closed);
  }).catch((error) => {
    // terminate() can emit an asynchronous error after handshake listeners
    // have been removed. The initiating error is already being propagated.
    socket.once('error', () => undefined);
    socket.terminate();
    throw error;
  });
  let id = 0;
  const pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (reason: Error) => void }
  >();
  const listeners = new Map<string, Set<() => void>>();
  let closed = false;
  const rejectPending = (reason: string) => {
    if (closed) return;
    closed = true;
    pending.forEach((item) => item.reject(new Error(reason)));
    pending.clear();
    listeners.clear();
  };
  socket.on('message', (data) => {
    let message: {
      id?: number;
      method?: string;
      result?: unknown;
      error?: { message?: string };
    };
    try {
      message = JSON.parse(data.toString());
    } catch {
      return;
    }
    if (message.id !== undefined) {
      const item = pending.get(message.id);
      pending.delete(message.id);
      if (!item) return;
      if (message.error) item.reject(new Error(message.error.message ?? 'CDP command failed'));
      else item.resolve(message.result);
    } else if (message.method) listeners.get(message.method)?.forEach((listener) => listener());
  });
  socket.on('close', () => rejectPending('CDP connection closed'));
  socket.on('error', () => rejectPending('CDP connection failed'));
  return {
    send<T>(method: string, params?: Record<string, unknown>, commandTimeoutMs = timeoutMs) {
      if (closed) return Promise.reject(new Error('CDP connection closed'));
      const requestId = ++id;
      return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => {
          if (!pending.delete(requestId)) return;
          reject(new Error(`Timed out waiting for CDP command ${method}`));
        }, commandTimeoutMs);
        pending.set(requestId, {
          resolve: (value) => {
            clearTimeout(timer);
            resolve(value as T);
          },
          reject: (reason) => {
            clearTimeout(timer);
            reject(reason);
          },
        });
        try {
          socket.send(JSON.stringify({ id: requestId, method, params }));
        } catch {
          pending.delete(requestId);
          clearTimeout(timer);
          reject(new Error('Cannot send CDP command'));
        }
      });
    },
    onEvent(method, listener) {
      const set = listeners.get(method) ?? new Set();
      set.add(listener);
      listeners.set(method, set);
      return () => set.delete(listener);
    },
    close() {
      rejectPending('CDP connection closed');
      socket.terminate();
    },
  };
}

const HANDSHAKE_TIMEOUT_MS = 15_000;
const HANDSHAKE_COMMAND_TIMEOUT_MS = 20_000;
// Real Codex reloads can replace the document immediately but mount the shell
// substantially later; this is separate from the iframe readiness handshake.
const CSP_RELOAD_HOST_READY_TIMEOUT_MS = 90_000;
const MIN_HOST_READY_TIMEOUT_MS = 5_000;
const MAX_HOST_READY_TIMEOUT_MS = 120_000;
const READY_CHALLENGE = 'taskboard:ready-challenge';
const READY_RESPONSE = 'taskboard:ready-response';

export function boardEmbedScript(
  boardUrl: string,
  shellMarker: string,
  owner: number,
  exactPageUrl: string,
  boardOrigin: string,
  nonce: string,
  timeoutMs: number,
  sidebarMarker?: string,
  contentMarker?: string,
): string {
  return `(() => {
    if (location.href !== ${JSON.stringify(exactPageUrl)}) return { installed: false };
    const owner = ${JSON.stringify(String(owner))};
    const cleanupKey = ${JSON.stringify(`__taskboardEmbedCleanup_${owner}`)};
    const selectOne = (selector) => {
      const matches = Array.from(document.querySelectorAll(selector));
      return matches.length === 1 ? matches[0] : null;
    };
    const root = selectOne(${JSON.stringify(shellMarker)});
    const sidebar = ${sidebarMarker ? `selectOne(${JSON.stringify(sidebarMarker)})` : 'null'};
    const content = ${contentMarker ? `selectOne(${JSON.stringify(contentMarker)})` : 'null'};
    if (!root || (${Boolean(sidebarMarker || contentMarker)} && (!sidebar || !content || !root.contains(sidebar) || !root.contains(content))))
      return { installed: false, reason: 'shell-marker-not-observed' };
    const oldCleanup = window[cleanupKey];
    if (typeof oldCleanup === 'function') oldCleanup();
    const installFocus = document.activeElement;
    const contentStyle = content && content.style;
    const priorPosition = contentStyle && contentStyle.getPropertyValue('position');
    const priorPriority = contentStyle && contentStyle.getPropertyPriority('position');
    const positionedContent = Boolean(sidebar && content && getComputedStyle(content).position === 'static');
    if (positionedContent) contentStyle.setProperty('position', 'relative');
    const host = document.createElement('aside');
    host.id = 'taskboard-codex-sidebar';
    host.setAttribute('data-taskboard-owned', owner);
    host.style.cssText = sidebar
      ? 'position:absolute;inset:0;display:none;flex-direction:column;min-width:0;background:var(--background,#fff);z-index:2147483000'
      : 'width:380px;min-width:280px;border-left:1px solid rgba(127,127,127,.22);background:var(--background,#fff);z-index:2147483000';
    const frame = document.createElement('iframe');
    frame.title = '任务看板';
    frame.src = ${JSON.stringify(boardUrl)};
    frame.style.cssText = sidebar
      ? 'border:0;width:100%;flex:1;min-height:0'
      : 'border:0;width:100%;height:100%';
    host.append(frame);
    (content || root).append(host);
    const entry = sidebar ? document.createElement('button') : null;
    if (entry) {
      entry.type = 'button';
      entry.setAttribute('data-taskboard-entry', owner);
      entry.setAttribute('aria-label', '任务看板');
      entry.setAttribute('aria-pressed', 'false');
      entry.title = '打开任务看板';
      entry.style.cssText = 'box-sizing:border-box;display:flex;flex:none;align-items:center;gap:10px;width:100%;height:32px;padding:0 12px;border:0;border-radius:10px;background:transparent;color:inherit;font:inherit;font-size:14px;text-align:left;cursor:pointer';
      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      icon.setAttribute('aria-hidden', 'true');
      icon.setAttribute('viewBox', '0 0 16 16');
      icon.setAttribute('width', '16');
      icon.setAttribute('height', '16');
      icon.style.flex = 'none';
      for (const x of [2, 6, 10]) {
        const bar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        bar.setAttribute('x', String(x));
        bar.setAttribute('y', '3');
        bar.setAttribute('width', '3');
        bar.setAttribute('height', x === 6 ? '7' : '10');
        bar.setAttribute('rx', '1');
        bar.setAttribute('fill', 'currentColor');
        icon.append(bar);
      }
      const label = document.createElement('span');
      label.textContent = '任务看板';
      entry.append(icon, label);
      // The observed native shell has a fixed header above a scrolling list.
      // Keep this entry in that header so it cannot fall below the viewport.
      const header = sidebar.firstElementChild;
      const scrollArea = header && header.nextElementSibling;
      if (header && scrollArea && getComputedStyle(header).flexShrink === '0' && getComputedStyle(scrollArea).flexGrow !== '0')
        header.append(entry);
      else sidebar.prepend(entry);
    }
    return new Promise((resolve) => {
      let finished = false;
      const ownsFocus = () => host.contains(document.activeElement) || document.activeElement === entry;
      const hide = () => { host.style.display = 'none'; if (entry) { entry.style.background = 'transparent'; entry.setAttribute('aria-pressed', 'false'); entry.title = '打开任务看板'; entry.focus(); } };
      const show = () => { host.style.display = sidebar ? 'flex' : 'block'; if (entry) { entry.style.background = 'rgba(127,127,127,.14)'; entry.setAttribute('aria-pressed', 'true'); entry.title = '再次点击返回 Codex'; entry.focus(); } };
      const toggle = () => { if (host.style.display === 'none') show(); else hide(); };
      const onKey = (event) => { if (event.key === 'Escape' && host.style.display !== 'none' && ownsFocus()) hide(); };
      const teardown = () => {
        const restore = ownsFocus() && installFocus && installFocus !== entry && installFocus.isConnected ? installFocus : null;
        window.removeEventListener('message', onMessage);
        document.removeEventListener('keydown', onKey);
        clearTimeout(timeout);
        clearInterval(challengeTimer);
        frame.removeEventListener('load', challenge);
        host.remove();
        entry && entry.remove();
        if (positionedContent && contentStyle.getPropertyValue('position') === 'relative' && contentStyle.getPropertyPriority('position') === '')
          contentStyle.setProperty('position', priorPosition, priorPriority);
        if (window[cleanupKey] === cleanup) delete window[cleanupKey];
        restore && restore.focus();
      };
      const finish = (value, removeHost) => {
        if (finished) return;
        finished = true;
        window.removeEventListener('message', onMessage);
        clearTimeout(timeout);
        clearInterval(challengeTimer);
        frame.removeEventListener('load', challenge);
        if (removeHost) teardown();
        resolve(value);
      };
      const cleanup = () => { if (finished) teardown(); else finish({ installed: false, reason: 'unloaded' }, true); };
      const onMessage = (event) => {
        const data = event.data;
        if (event.origin !== ${JSON.stringify(boardOrigin)} || event.source !== frame.contentWindow || !data || typeof data !== 'object' || data.type !== ${JSON.stringify(READY_RESPONSE)} || data.nonce !== ${JSON.stringify(nonce)}) return;
        if (location.href !== ${JSON.stringify(exactPageUrl)} || !host.isConnected || !frame.isConnected)
          return finish({ installed: false, reason: 'board-context-changed' }, true);
        finish({ installed: true }, false);
      };
      const challenge = () => { if (frame.contentWindow) frame.contentWindow.postMessage({ type: ${JSON.stringify(READY_CHALLENGE)}, nonce: ${JSON.stringify(nonce)} }, ${JSON.stringify(boardOrigin)}); };
      window[cleanupKey] = cleanup;
      window.addEventListener('message', onMessage);
      document.addEventListener('keydown', onKey);
      entry && entry.addEventListener('click', toggle);
      frame.addEventListener('load', challenge);
      const challengeTimer = setInterval(challenge, 100);
      const timeout = setTimeout(() => finish({ installed: false, reason: 'board-ready-timeout' }, true), ${timeoutMs});
      challenge();
    });
  })()`;
}

export class CodexDesktopAdapter implements AgentAdapter {
  readonly id = 'codex-desktop';
  private connection?: CdpConnection;
  private removeLoadListener?: () => void;
  private observed = false;
  // A session is published only after its connector is still current. Cleanup
  // always compares identity, so a late failed install cannot tear down a newer one.
  private session?: {
    connection: CdpConnection;
    generation: number;
    bypassAttempted: boolean;
    injectionAttempted: boolean;
  };
  private generation = 0;
  private recovery?: Promise<void>;
  private lastLifecycleError?: string;
  private installing?: Promise<void>;
  private draftInProgress = false;
  private readonly cleanupTasks = new WeakMap<object, Promise<void>>();

  private hostReadyTimeoutMs(): number {
    const value = this.config.hostReadyTimeoutMs;
    return typeof value === 'number' &&
      Number.isInteger(value) &&
      value >= MIN_HOST_READY_TIMEOUT_MS &&
      value <= MAX_HOST_READY_TIMEOUT_MS
      ? value
      : CSP_RELOAD_HOST_READY_TIMEOUT_MS;
  }

  constructor(
    private readonly config: CodexCdpConfig = {},
    private readonly connector?: CdpConnector,
  ) {}

  private async hasOwner(): Promise<boolean> {
    if (!this.config.owner) return false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      return (
        (await Promise.race([
          this.config.owner.verify(),
          new Promise<boolean>((resolve) => {
            timeout = setTimeout(() => resolve(false), OWNER_VERIFY_TIMEOUT_MS);
          }),
        ])) === true
      );
    } catch {
      return false;
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  private async assertOwner(): Promise<void> {
    if (!(await this.hasOwner())) throw new Error('Codex launcher ownership is missing or expired');
  }

  async probe(): Promise<AdapterCapabilities> {
    if (this.lastLifecycleError)
      return {
        embedded: false,
        projects: false,
        draft: false,
        thread: false,
        reason: this.lastLifecycleError,
      };
    if (!this.config.owner)
      return {
        embedded: false,
        projects: false,
        draft: false,
        thread: false,
        reason: '仅探测由 Taskboard 启动器管理的 Codex 实例',
      };
    if (!(await this.hasOwner()))
      return {
        embedded: false,
        projects: false,
        draft: false,
        thread: false,
        reason: 'Codex 启动器进程归属已失效',
      };
    if (
      !this.config.appVersion ||
      !SUPPORTED_CODEX_VERSIONS.includes(
        this.config.appVersion as (typeof SUPPORTED_CODEX_VERSIONS)[number],
      )
    ) {
      return {
        embedded: false,
        projects: false,
        draft: false,
        thread: false,
        reason: 'Codex 版本未在受支持清单中',
      };
    }
    try {
      const version = await fetchCdpVersion(this.config.endpoint);
      if (!(await this.hasOwner()))
        return {
          embedded: false,
          projects: false,
          draft: false,
          thread: false,
          reason: 'Codex 启动器进程归属已失效',
        };
      if (!version.webSocketDebuggerUrl)
        return {
          embedded: false,
          projects: false,
          draft: false,
          thread: false,
          reason: 'CDP 未提供调试连接',
        };
      return {
        embedded: this.observed,
        projects: false,
        draft: Boolean(this.config.codexHome && this.config.targetBinding),
        thread: false,
        reason: this.observed
          ? '草稿填写前将重新验证项目身份和空白编辑器'
          : '尚未观察到已验证的 Codex 页面标记',
      };
    } catch {
      return {
        embedded: false,
        projects: false,
        draft: false,
        thread: false,
        reason: '未检测到可用的本地 CDP',
      };
    }
  }

  async install(): Promise<void> {
    if (this.installing || this.session)
      throw new Error('Codex adapter lifecycle is already active');
    this.lastLifecycleError = undefined;
    const task = this.installInternal();
    this.installing = task;
    try {
      await task;
    } finally {
      if (this.installing === task) this.installing = undefined;
    }
  }

  private async installInternal(): Promise<void> {
    const generation = ++this.generation;
    const board = this.config.boardUrl ? boardEndpoint(this.config.boardUrl) : undefined;
    if (Boolean(this.config.sidebarMarker) !== Boolean(this.config.contentMarker))
      throw new Error('Codex native sidebar and content markers must be provided together');
    const capabilities = await this.probe();
    if (capabilities.reason !== '尚未观察到已验证的 Codex 页面标记')
      throw new Error(capabilities.reason ?? '不允许注入');
    const binding = this.config.targetBinding;
    if (!binding) throw new Error('缺少启动器提供的精确 Codex CDP 目标绑定');
    const pages = await fetchCdpPages(this.config.endpoint);
    await this.assertOwner();
    const matches = pages.filter((item) => item.id === binding.targetId);
    if (matches.length !== 1) throw new Error('Codex CDP 目标绑定不唯一');
    const page =
      matches[0].type === 'page' &&
      matches[0].url === binding.exactPageUrl &&
      matches[0].webSocketDebuggerUrl === binding.pageWebSocketUrl
        ? matches[0]
        : undefined;
    if (!page?.webSocketDebuggerUrl) throw new Error('Codex CDP 目标绑定未精确匹配');
    const ws = new URL(page.webSocketDebuggerUrl);
    const endpoint = loopbackEndpoint(this.config.endpoint ?? 'http://127.0.0.1:9222');
    const endpointPort = endpoint.port || (endpoint.protocol === 'http:' ? '80' : '443');
    const wsPort = ws.port || (ws.protocol === 'ws:' ? '80' : '443');
    if (
      (endpoint.protocol === 'http:' ? ws.protocol !== 'ws:' : ws.protocol !== 'wss:') ||
      ws.hostname !== endpoint.hostname ||
      endpointPort !== wsPort ||
      ws.username ||
      ws.password ||
      ws.search ||
      ws.hash ||
      ws.pathname !== `/devtools/page/${binding.targetId}`
    )
      throw new Error('Codex CDP 页面 WebSocket 绑定无效');
    const connection = await (
      this.connector ?? ((url: string) => connectCdp(url, this.config.cdpTimeoutMs ?? 3_000))
    )(page.webSocketDebuggerUrl);
    if (generation !== this.generation) {
      connection.close();
      throw new Error('Codex adapter installation was cancelled');
    }
    const session = { connection, generation, bypassAttempted: false, injectionAttempted: false };
    this.connection = connection;
    this.session = session;
    try {
      await this.assertOwner();
      const target = await connection.send<{
        targetInfo?: { targetId?: string; type?: string; url?: string };
      }>('Target.getTargetInfo');
      if (
        target.targetInfo?.targetId !== binding.targetId ||
        target.targetInfo.type !== 'page' ||
        target.targetInfo.url !== binding.exactPageUrl
      )
        throw new Error('Codex CDP target changed after connection');
      if (generation !== this.generation)
        throw new Error('Codex adapter installation was cancelled');
      await connection.send('Page.enable');
      if (generation !== this.generation)
        throw new Error('Codex adapter installation was cancelled');
      if (this.config.allowCspBypass) {
        await this.assertOwner();
        if (!this.config.allowCspReload)
          throw new Error('CSP bypass requires explicit guarded reload opt-in');
        if (this.config.allowCspReload)
          await this.assertReloadSafe(connection, binding.exactPageUrl);
        if (generation !== this.generation || this.session !== session)
          throw new Error('Codex adapter installation was cancelled');
        // No bypass is enabled by default. This only takes effect after an explicit launcher setting.
        session.bypassAttempted = true;
        await connection.send('Page.setBypassCSP', { enabled: true });
        if (generation !== this.generation || this.session !== session)
          throw new Error('Codex adapter installation was cancelled');
        if (this.config.allowCspReload) await this.reloadAndWait(session, binding.exactPageUrl);
        if (generation !== this.generation || this.session !== session)
          throw new Error('Codex adapter installation was cancelled');
        if (generation !== this.generation)
          throw new Error('Codex adapter installation was cancelled');
      }
      const shellMarker = this.config.shellMarker;
      if (!shellMarker || !board) throw new Error('缺少已验证的 Codex DOM 标记或看板地址');
      await this.assertOwner();
      session.injectionAttempted = true;
      const result = await this.evaluate<{ installed?: boolean }>(
        connection,
        boardEmbedScript(
          board.href,
          shellMarker,
          generation,
          binding.exactPageUrl,
          board.origin,
          randomBytes(24).toString('base64url'),
          HANDSHAKE_TIMEOUT_MS,
          this.config.sidebarMarker,
          this.config.contentMarker,
        ),
        HANDSHAKE_COMMAND_TIMEOUT_MS,
      );
      if (generation !== this.generation)
        throw new Error('Codex adapter installation was cancelled');
      if (!result.installed) throw new Error('Codex DOM 标记未观察到，已拒绝注入');
      this.observed = true;
      this.removeLoadListener = connection.onEvent?.('Page.loadEventFired', () => {
        if (generation === this.generation && connection === this.connection) this.observed = false;
        void this.recover(generation);
      });
    } catch (error) {
      try {
        await this.cleanup(session);
      } catch (cleanupError) {
        this.lastLifecycleError = `CSP restoration unconfirmed: ${cleanupError instanceof Error ? cleanupError.message : 'unknown error'}`;
        throw new AggregateError(
          [error, cleanupError],
          error instanceof Error ? error.message : 'install failed',
        );
      }
      throw error;
    }
  }

  private async assertReloadSafe(connection: CdpConnection, exactPageUrl: string): Promise<void> {
    const shell = this.config.shellMarker;
    const editor = this.config.composerMarker;
    const modal = this.config.modalMarker;
    if (!shell || !editor || !modal)
      throw new Error('CSP reload requires explicit shell, empty-editor, and modal markers');
    const safe = await this.evaluate<boolean>(
      connection,
      `(() => location.href === ${JSON.stringify(exactPageUrl)} && document.querySelectorAll(${JSON.stringify(shell)}).length === 1 && document.querySelectorAll(${JSON.stringify(editor)}).length === 1 && !document.querySelector(${JSON.stringify(modal)}) && !(document.querySelector(${JSON.stringify(editor)})?.textContent ?? '').trim())()`,
    );
    if (!safe) {
      // Diagnose the refused state without enabling bypass or reloading.
      const state = await this.evaluate<{
        url?: string; shell?: number; editors?: number; modal?: boolean; hasText?: boolean;
      }>(connection,
        `({ url: location.href, shell: document.querySelectorAll(${JSON.stringify(shell)}).length, editors: document.querySelectorAll(${JSON.stringify(editor)}).length, modal: Boolean(document.querySelector(${JSON.stringify(modal)})), hasText: Array.from(document.querySelectorAll(${JSON.stringify(editor)})).some(element => Boolean((element.textContent ?? '').trim())) })`,
      );
      if (state?.url !== exactPageUrl)
        throw new Error('CSP reload refused: Codex target changed');
      if (state.modal) throw new Error('CSP reload refused: a Codex dialog is open');
      if (state.hasText) throw new Error('CSP reload refused: the Codex editor contains an unsent draft');
      if (state.shell === 0 || state.editors === 0)
        throw new Error('CSP reload refused: Codex workspace is not ready; sign in and open a project first');
      throw new Error('CSP reload refused: Codex workspace structure does not match the verified host');
    }
  }

  private assertCurrentSession(session: { connection: CdpConnection; generation: number }): void {
    if (session.generation !== this.generation || session.connection !== this.connection)
      throw new Error('Codex adapter installation was cancelled');
  }

  private async reloadAndWait(
    session: { connection: CdpConnection; generation: number },
    exactPageUrl: string,
    retiring = false,
  ): Promise<void> {
    const assertIdentity = () => {
      if (retiring) {
        if (
          session.connection !== this.connection ||
          this.session?.connection !== session.connection
        )
          throw new Error('CSP restoration unconfirmed: session changed');
      } else this.assertCurrentSession(session);
    };
    assertIdentity();
    await this.assertOwner();
    const target = await session.connection.send<{
      targetInfo?: { targetId?: string; type?: string; url?: string };
    }>('Target.getTargetInfo');
    const binding = this.config.targetBinding;
    assertIdentity();
    if (
      !binding ||
      target.targetInfo?.targetId !== binding.targetId ||
      target.targetInfo.type !== 'page' ||
      target.targetInfo.url !== exactPageUrl
    )
      throw new Error('CSP reload refused: Codex target changed');
    const before = await this.evaluate<number>(session.connection, 'performance.timeOrigin');
    assertIdentity();
    await this.assertReloadSafe(session.connection, exactPageUrl);
    assertIdentity();
    await this.assertOwner();
    await session.connection.send('Page.reload');
    const deadline = Date.now() + this.hostReadyTimeoutMs();
    let sawShell = false;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      assertIdentity();
      const ready = await this.evaluate<{
        origin?: number;
        shell?: number;
        composer?: number;
        modal?: boolean;
        composerHasText?: boolean;
        url?: string;
      }>(
        session.connection,
        `({ origin: performance.timeOrigin, shell: document.querySelectorAll(${JSON.stringify(this.config.shellMarker)}).length, composer: document.querySelectorAll(${JSON.stringify(this.config.composerMarker)}).length, modal: Boolean(document.querySelector(${JSON.stringify(this.config.modalMarker)})), composerHasText: Array.from(document.querySelectorAll(${JSON.stringify(this.config.composerMarker)})).some(editor => Boolean((editor.textContent ?? '').trim())), url: location.href })`,
      ).catch(() => undefined);
      if (ready && ready.origin !== before) {
        assertIdentity();
        if (ready.url !== exactPageUrl) throw new Error('CSP reload refused: Codex target changed');
        if (ready.modal || ready.composerHasText)
          throw new Error('CSP reload refused: Codex editor is not empty or a modal is open');
        if (ready.shell === 1) sawShell = true;
        if (ready.shell !== 1 || ready.composer !== 1) continue;
        await this.assertReloadSafe(session.connection, exactPageUrl);
        return;
      }
    }
    throw new Error(
      `CSP reload did not reach a new verified Codex document (${sawShell ? 'waiting-composer' : 'waiting-shell'})`,
    );
  }

  private async recover(generation: number): Promise<void> {
    if (this.recovery) return this.recovery;
    const connection = this.connection;
    if (
      !connection ||
      !this.config.boardUrl ||
      !this.config.shellMarker ||
      generation !== this.generation
    )
      return;
    const board = boardEndpoint(this.config.boardUrl);
    const shellMarker = this.config.shellMarker;
    const binding = this.config.targetBinding;
    if (!binding) return;
    this.recovery = (async () => {
      try {
        await this.assertOwner();
        const target = await connection.send<{
          targetInfo?: { targetId?: string; type?: string; url?: string };
        }>('Target.getTargetInfo');
        if (generation !== this.generation || connection !== this.connection) return;
        if (
          target.targetInfo?.targetId !== binding.targetId ||
          target.targetInfo.type !== 'page' ||
          target.targetInfo.url !== binding.exactPageUrl
        ) {
          if (generation === this.generation && connection === this.connection) {
            this.observed = false;
            this.removeLoadListener?.();
            this.removeLoadListener = undefined;
            try {
              await this.cleanup(
                this.session?.connection === connection
                  ? this.session
                  : { connection, generation, bypassAttempted: false },
              );
            } catch (cleanupError) {
              if (generation === this.generation)
                this.lastLifecycleError = `CSP restoration unconfirmed: ${cleanupError instanceof Error ? cleanupError.message : 'unknown error'}`;
            }
          }
          return;
        }
        const deadline = Date.now() + this.hostReadyTimeoutMs();
        while (Date.now() < deadline) {
          if (generation !== this.generation || connection !== this.connection) return;
          const ready = await this.evaluate<boolean>(
            connection,
            `(() => { const root = document.querySelectorAll(${JSON.stringify(shellMarker)}); if (root.length !== 1 || location.href !== ${JSON.stringify(binding.exactPageUrl)}) return false; const sidebar = ${this.config.sidebarMarker ? `document.querySelectorAll(${JSON.stringify(this.config.sidebarMarker)})` : '[]'}; const content = ${this.config.contentMarker ? `document.querySelectorAll(${JSON.stringify(this.config.contentMarker)})` : '[]'}; return ${Boolean(this.config.sidebarMarker || this.config.contentMarker)} ? sidebar.length === 1 && content.length === 1 && root[0].contains(sidebar[0]) && root[0].contains(content[0]) : true; })()`,
          ).catch(() => false);
          if (ready) break;
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        if (generation !== this.generation || connection !== this.connection) return;
        const shellReady = await this.evaluate<boolean>(
          connection,
          `(() => { const root = document.querySelectorAll(${JSON.stringify(shellMarker)}); return root.length === 1 && location.href === ${JSON.stringify(binding.exactPageUrl)}; })()`,
        );
        if (!shellReady) throw new Error('Codex shell did not become ready after reload');
        if (generation !== this.generation || connection !== this.connection) return;
        await this.assertOwner();
        const result = await this.evaluate<{ installed?: boolean }>(
          connection,
          boardEmbedScript(
            board.href,
            shellMarker,
            generation,
            binding.exactPageUrl,
            board.origin,
            randomBytes(24).toString('base64url'),
            HANDSHAKE_TIMEOUT_MS,
            this.config.sidebarMarker,
            this.config.contentMarker,
          ),
          HANDSHAKE_COMMAND_TIMEOUT_MS,
        );
        if (generation !== this.generation || connection !== this.connection) return;
        if (!result.installed) throw new Error('Codex DOM 标记未观察到，已拒绝注入');
        this.observed = true;
      } catch (error) {
        if (generation === this.generation && connection === this.connection) {
          this.observed = false;
          this.removeLoadListener?.();
          this.removeLoadListener = undefined;
          const cleanup = this.cleanup(
            this.session?.connection === connection
              ? this.session
              : { connection, generation, bypassAttempted: false, injectionAttempted: false },
          );
          await cleanup.catch((cleanupError) => {
            if (generation === this.generation)
              this.lastLifecycleError = `CSP restoration unconfirmed: ${cleanupError instanceof Error ? cleanupError.message : 'unknown error'}`;
          });
          if (generation === this.generation && !this.lastLifecycleError)
            this.lastLifecycleError =
              error instanceof Error ? error.message : 'Codex recovery failed';
        }
      }
    })().finally(() => {
      this.recovery = undefined;
    });
    return this.recovery;
  }

  private cleanup(session: {
    connection: CdpConnection;
    generation: number;
    bypassAttempted: boolean;
    injectionAttempted?: boolean;
  }): Promise<void> {
    const existing = this.cleanupTasks.get(session.connection);
    if (existing) return existing;
    const task = this.cleanupInternal(session);
    this.cleanupTasks.set(session.connection, task);
    return task;
  }

  private async cleanupInternal(session: {
    connection: CdpConnection;
    generation: number;
    bypassAttempted: boolean;
    injectionAttempted?: boolean;
  }): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const cleanupDom = session.injectionAttempted
        ? session.connection.send('Runtime.evaluate', {
            expression: `window[${JSON.stringify(`__taskboardEmbedCleanup_${session.generation}`)}]?.(); document.querySelector('[data-taskboard-owned="${session.generation}"]')?.remove()`,
          })
        : Promise.resolve();
      const disableBypass = session.bypassAttempted
        ? session.connection.send('Page.setBypassCSP', { enabled: false })
        : Promise.resolve();
      const results = await Promise.race([
        Promise.allSettled([cleanupDom, disableBypass]),
        new Promise<PromiseSettledResult<unknown>[]>((resolve) => {
          timer = setTimeout(() => resolve([]), this.config.cdpTimeoutMs ?? 3_000);
        }),
      ]);
      if (session.bypassAttempted && (!results[1] || results[1].status === 'rejected'))
        throw new Error('CSP bypass disable command was not confirmed');
      if (session.injectionAttempted && (!results[0] || results[0].status === 'rejected'))
        throw new Error('DOM restoration unconfirmed');
      if (this.config.allowCspReload && session.bypassAttempted) {
        const binding = this.config.targetBinding;
        if (!binding)
          throw new Error('CSP restoration unconfirmed: exact target binding is missing');
        await this.assertReloadSafe(session.connection, binding.exactPageUrl);
        await this.reloadAndWait(session, binding.exactPageUrl, true);
      }
    } catch (error) {
      if (session.bypassAttempted)
        throw new Error(
          `CSP restoration unconfirmed: ${error instanceof Error ? error.message : 'unknown error'}`,
        );
      throw error;
    } finally {
      if (timer) clearTimeout(timer);
      session.connection.close();
      if (this.connection === session.connection) this.connection = undefined;
      if (this.session === session) this.session = undefined;
    }
  }

  private async evaluate<T>(
    connection: CdpConnection,
    expression: string,
    timeoutMs?: number,
  ): Promise<T> {
    const result = await connection.send<{
      result?: { value?: T };
      exceptionDetails?: { text?: string; exception?: { description?: string } };
    }>('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, timeoutMs);
    if (result.exceptionDetails)
      throw new Error(
        `Codex evaluation failed: ${result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? 'unknown exception'}`,
      );
    if (!result.result) throw new Error('Codex evaluation returned no value');
    return result.result.value as T;
  }

  async listProjects(): Promise<LocalProject[]> {
    return [];
  }
  async openDraft(request: DraftRequest): Promise<void> {
    if (this.draftInProgress) throw new Error('DRAFT_UNAVAILABLE: 草稿填写正在进行');
    this.draftInProgress = true;
    try {
      await this.fillSafeDraft(request);
    } finally {
      this.draftInProgress = false;
    }
  }

  private async fillSafeDraft(request: DraftRequest): Promise<void> {
    const binding = this.config.targetBinding;
    const home = this.config.codexHome;
    if (!binding || !home || !this.config.appVersion ||
      !SUPPORTED_CODEX_VERSIONS.includes(this.config.appVersion as (typeof SUPPORTED_CODEX_VERSIONS)[number]))
      throw new Error('DRAFT_UNAVAILABLE: 缺少已验证的启动器会话或 Codex 版本');
    if (typeof request.prompt !== 'string' || !request.prompt.trim() || request.prompt.length > 120_000)
      throw new Error('DRAFT_UNAVAILABLE: 草稿内容无效');
    let requestedPath: string;
    try { requestedPath = realpathSync.native(request.projectPath); }
    catch { throw new Error('DRAFT_UNAVAILABLE: 请求的项目目录不存在'); }
    await this.assertOwner();
    const pages = await fetchCdpPages(this.config.endpoint);
    if (pages.filter((page) => page.id === binding.targetId && page.type === 'page' &&
      page.url === binding.exactPageUrl && page.webSocketDebuggerUrl === binding.pageWebSocketUrl).length !== 1)
      throw new Error('DRAFT_UNAVAILABLE: Codex 页面绑定已变化');
    await this.assertOwner();
    const connection = await (this.connector ?? ((url: string) => connectCdp(url, this.config.cdpTimeoutMs ?? 3_000)))(binding.pageWebSocketUrl);
    try {
      await this.assertOwner();
      const target = await connection.send<{ targetInfo?: { targetId?: string; type?: string; url?: string } }>('Target.getTargetInfo');
      if (target.targetInfo?.targetId !== binding.targetId || target.targetInfo.type !== 'page' ||
        target.targetInfo.url !== binding.exactPageUrl)
        throw new Error('DRAFT_UNAVAILABLE: Codex 页面绑定已变化');
      type DraftSurface = { selectedIds: string[]; labels: string[]; composerLabels: string[];
        editorCount: number; editorEmpty: boolean; editorHasText: boolean; modal: boolean; overlayVisible: boolean; overlayGeneration: string | null };
      const readSurface = () => this.evaluate<DraftSurface | null>(
        connection,
        `(() => { if (location.href !== ${JSON.stringify(binding.exactPageUrl)}) return null;
          const selected = [...document.querySelectorAll('[data-app-action-sidebar-project-id][aria-current="page"]')];
          const editors = [...document.querySelectorAll('[contenteditable="true"][role="textbox"]')];
          const editor = editors.length === 1 ? editors[0] : null;
          const overlay = document.querySelector('[data-taskboard-owned]');
          return { selectedIds: selected.map(el => el.getAttribute('data-app-action-sidebar-project-id')),
            labels: selected.map(el => el.getAttribute('data-app-action-sidebar-project-label')),
            composerLabels: [...document.querySelectorAll('[data-composer-navigation-target="workspace-project"]')].map(el => el.getAttribute('aria-label')),
            editorCount: editors.length, editorHasText: editors.some(el => !!el.textContent.trim()),
            editorEmpty: !!editor && !editor.textContent.trim() && editor.children.length === 1 &&
              editor.firstElementChild.tagName === 'P' && editor.firstElementChild.children.length === 1 &&
              editor.firstElementChild.firstElementChild.tagName === 'BR',
            modal: !!document.querySelector('[role="dialog"]'),
            overlayVisible: !!overlay && getComputedStyle(overlay).display !== 'none',
            overlayGeneration: overlay?.getAttribute('data-taskboard-owned') ?? null }; })()`,
      );
      // Refuse unsafe requests before removing the persistent entry or reloading
      // the host. The active board may cover a valid, empty composer.
      const sidebarSession = this.session;
      if (sidebarSession) this.assertCurrentSession(sidebarSession);
      const initial = await readSurface();
      const initialId = initial?.selectedIds.length === 1 ? initial.selectedIds[0] : undefined;
      const initialProject = initialId ? resolveCodexProject(home, initialId) : undefined;
      const initialProjectMatches = !!initialProject &&
        (process.platform === 'win32' ? initialProject.path.toLowerCase() === requestedPath.toLowerCase() : initialProject.path === requestedPath) &&
        initial?.labels.length === 1 && initial.labels[0] === initialProject.name &&
        initial.composerLabels.length === 1 && initial.composerLabels[0] === `切换项目：${initialProject.name}`;
      const knownOverlay = !initial?.overlayVisible ||
        (!!sidebarSession && initial.overlayGeneration === String(sidebarSession.generation));
      if (!initialProjectMatches || !initial?.editorEmpty || initial.modal || !knownOverlay)
        throw new Error('DRAFT_UNAVAILABLE: 项目身份、空白编辑器或页面状态未通过验证');
      if (sidebarSession) this.assertCurrentSession(sidebarSession);
      await this.assertOwner();
      // Restore CSP before filling an unsent draft, then validate the reloaded
      // project and editor again. Cleanup must not reload after text is inserted.
      const restoringSidebar = Boolean(sidebarSession);
      if (restoringSidebar) await this.dispose();
      let id: string | undefined;
      let project: ReturnType<typeof resolveCodexProject>;
      const readyUntil = Date.now() + (restoringSidebar ? 5_000 : 0);
      while (true) {
        await this.assertOwner();
        const state = await readSurface();
        id = state?.selectedIds.length === 1 ? state.selectedIds[0] : undefined;
        project = id ? resolveCodexProject(home, id) : undefined;
        const projectMatches = !!project &&
          (process.platform === 'win32' ? project.path.toLowerCase() === requestedPath.toLowerCase() : project.path === requestedPath) &&
          state?.labels.length === 1 && state.labels[0] === project.name;
        const composerMatches = !!project && state?.composerLabels.length === 1 &&
          state.composerLabels[0] === `切换项目：${project.name}`;
        if (projectMatches && composerMatches && state?.editorEmpty && !state.modal && !state.overlayVisible)
          break;
        // Our guarded CSP restoration can finish before Codex rehydrates its
        // selected project. Wait only for missing markers after that reload;
        // a wrong project, typed text, modal, or unexpected overlay fails at once.
        const loading = restoringSidebar && state && !state.modal && !state.overlayVisible &&
          !state.editorHasText && state.selectedIds.length <= 1 && state.composerLabels.length <= 1 &&
          state.editorCount <= 1 &&
          (!id || projectMatches) &&
          (state.composerLabels.length === 0 || composerMatches) &&
          (!state.editorCount || state.editorEmpty);
        if (!loading || Date.now() >= readyUntil)
          throw new Error('DRAFT_UNAVAILABLE: 项目身份、空白编辑器或页面状态未通过验证');
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (!id || !project) throw new Error('DRAFT_UNAVAILABLE: Codex 项目身份未确认');
      await this.assertOwner();
      const current = await connection.send<{ targetInfo?: { targetId?: string; type?: string; url?: string } }>('Target.getTargetInfo');
      if (current.targetInfo?.targetId !== binding.targetId || current.targetInfo.type !== 'page' ||
        current.targetInfo.url !== binding.exactPageUrl)
        throw new Error('DRAFT_UNAVAILABLE: Codex 页面绑定已变化');
      await this.assertOwner();
      const result = await this.evaluate<{ inserted?: boolean; exactText?: boolean; projectStillSelected?: boolean }>(
        connection,
        `(() => {
          if (location.href !== ${JSON.stringify(binding.exactPageUrl)} || document.querySelector('[role="dialog"]')) return { inserted: false };
          const selected = [...document.querySelectorAll('[data-app-action-sidebar-project-id][aria-current="page"]')];
          const labels = [...document.querySelectorAll('[data-composer-navigation-target="workspace-project"]')];
          const editors = [...document.querySelectorAll('[contenteditable="true"][role="textbox"]')];
          const editor = editors[0];
          const overlay = document.querySelector('[data-taskboard-owned]');
          if (selected.length !== 1 || selected[0].getAttribute('data-app-action-sidebar-project-id') !== ${JSON.stringify(id)} ||
            selected[0].getAttribute('data-app-action-sidebar-project-label') !== ${JSON.stringify(project.name)} ||
            labels.length !== 1 || labels[0].getAttribute('aria-label') !== ${JSON.stringify(`切换项目：${project.name}`)} ||
            editors.length !== 1 || editor.textContent.trim() || editor.children.length !== 1 ||
            editor.firstElementChild.tagName !== 'P' || editor.firstElementChild.children.length !== 1 ||
            editor.firstElementChild.firstElementChild.tagName !== 'BR' ||
            (overlay && getComputedStyle(overlay).display !== 'none')) return { inserted: false };
          editor.focus();
          const inserted = document.execCommand('insertText', false, ${JSON.stringify(request.prompt)});
          // Codex stores pasted newlines as separate <p> nodes. textContent drops the
          // separators, so compare the actual paragraph sequence with the prompt.
          const paragraphs = [...editor.children];
          const exactText = editor.childNodes.length === paragraphs.length && paragraphs.length > 0 &&
            paragraphs.every(paragraph => paragraph.tagName === 'P' &&
              (paragraph.children.length === 0 ||
                (paragraph.children.length === 1 && paragraph.firstElementChild.tagName === 'BR' &&
                  !paragraph.textContent))) &&
            paragraphs.map(paragraph => paragraph.textContent ?? '').join('\\n') === ${JSON.stringify(request.prompt)};
          return { inserted, exactText,
            projectStillSelected: selected[0].isConnected && selected[0].getAttribute('aria-current') === 'page' };
        })()`,
      );
      if (!result.inserted || !result.exactText || !result.projectStillSelected)
        throw new Error('DRAFT_UNCONFIRMED: 草稿未能在目标项目中完整显示；请检查独立 Codex 窗口');
    } finally { connection.close(); }
  }
  async openThread(_threadId: string): Promise<void> {
    throw new Error('THREAD_UNAVAILABLE: 当前适配器不猜测 Codex 内部会话路由');
  }
  async dispose(): Promise<void> {
    ++this.generation;
    this.removeLoadListener?.();
    this.removeLoadListener = undefined;
    try {
      const session = this.session;
      if (session) await this.cleanup(session);
    } catch (error) {
      this.lastLifecycleError = error instanceof Error ? error.message : 'Codex disposal failed';
      throw error;
    } finally {
      this.observed = false;
    }
  }
}
