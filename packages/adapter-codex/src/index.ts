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

/** Exact desktop versions this adapter knows how to inspect. A successful CDP
 * connection is deliberately not enough to mark a user's Codex installation as
 * supported: the host DOM must be observed through an explicit marker. */
export const SUPPORTED_CODEX_VERSIONS = ['26.901.5280.0', '26.917.9434.0', '26.924.1866.0', '26.924.2738.0', '26.928.1915.0', '26.930.7945.0', '26.1007.9446.0', '26.1013.4894.0', '26.1016.8622.0'] as const;

/** Version-specific markers confirmed on an isolated host. Native launch support
 * has a separate gate: recognizing a host does not prove process ownership. */
export function codexHostMarkers(version: string) {
  if (!SUPPORTED_CODEX_VERSIONS.includes(version as (typeof SUPPORTED_CODEX_VERSIONS)[number]))
    throw new Error('Unsupported Codex host version');
  const redesignedShell = version === '26.924.1866.0' || version === '26.924.2738.0' || version === '26.928.1915.0' || version === '26.930.7945.0' || version === '26.1007.9446.0' || version === '26.1013.4894.0' || version === '26.1016.8622.0';
  return {
    shellMarker: 'div:has(>aside.app-shell-left-panel)',
    sidebarMarker: redesignedShell
      ? '.app-shell-left-panel nav:not([data-app-navigation-rail])'
      : '.app-shell-left-panel nav',
    contentMarker: redesignedShell
      ? 'main[data-app-shell-main-surface]'
      : '.app-shell-left-panel + div',
    // This complete workspace, including its fixed thread toolbar, was observed
    // on this exact host. Other versions retain their verified content boundary.
    workspaceMarker: version === '26.1016.8622.0'
      ? '[data-app-shell-workspace-row] > [data-app-shell-header-placement]'
      : undefined,
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
  /** Complete native view, including toolbars outside the main content pane. */
  workspaceMarker?: string;
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
  workspaceMarker?: string,
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
    const workspace = ${workspaceMarker ? `selectOne(${JSON.stringify(workspaceMarker)})` : 'content'};
    const mount = workspace && workspace.parentElement;
    if (!root || (${Boolean(sidebarMarker || contentMarker || workspaceMarker)} &&
      (!sidebar || !content || !workspace || !mount || !root.contains(sidebar) || !root.contains(content)
        || !root.contains(mount) || workspace === root || workspace.contains(sidebar) || !workspace.contains(content))))
      return { installed: false, reason: 'shell-marker-not-observed' };
    const oldCleanup = window[cleanupKey];
    if (typeof oldCleanup === 'function') oldCleanup();
    const installFocus = document.activeElement;
    const host = document.createElement(sidebar ? 'section' : 'aside');
    host.id = 'taskboard-codex-sidebar';
    host.setAttribute('data-taskboard-owned', owner);
    host.setAttribute('role', 'region');
    host.setAttribute('aria-label', '任务看板');
    host.style.cssText = sidebar
      ? 'position:relative;display:none;flex:1;flex-direction:column;align-self:stretch;min-width:0;min-height:0;overflow:hidden;background:var(--background,#fff)'
      : 'width:380px;min-width:280px;border-left:1px solid rgba(127,127,127,.22);background:var(--background,#fff);z-index:2147483000';
    const frame = document.createElement('iframe');
    frame.title = '任务看板';
    frame.src = ${JSON.stringify(boardUrl)};
    frame.style.cssText = sidebar
      ? 'border:0;width:100%;flex:1;min-height:0'
      : 'border:0;width:100%;height:100%';
    host.append(frame);
    (sidebar ? mount : (content || root)).append(host);
    const navStyle = sidebar ? document.createElement('style') : null;
    if (navStyle) {
      navStyle.setAttribute('data-taskboard-style', owner);
      navStyle.textContent = '[data-taskboard-suspended-current="' + owner + '"]:not(:hover):not(:focus-visible){background-color:transparent!important}';
      root.append(navStyle);
    }
    const entry = sidebar ? document.createElement('button') : null;
    if (entry) {
      entry.type = 'button';
      entry.setAttribute('data-taskboard-entry', owner);
      entry.setAttribute('aria-label', '任务看板');
      entry.setAttribute('aria-pressed', 'false');
      entry.setAttribute('aria-controls', host.id);
      entry.title = '打开任务看板';
      entry.style.cssText = 'box-sizing:border-box;display:flex;flex:none;align-items:center;gap:10px;width:100%;height:32px;padding:0 12px;border:0;border-radius:10px;background:transparent;color:inherit;font:inherit;font-size:14px;text-align:left;cursor:pointer';
      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      icon.setAttribute('aria-hidden', 'true');
      icon.setAttribute('viewBox', '0 0 32 32');
      icon.setAttribute('width', '16');
      icon.setAttribute('height', '16');
      icon.style.flex = 'none';
      for (const d of [
        'M6 4h13a3 3 0 0 1 3 3v3h-4V8H7v14h4v4H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Z',
        'M13 6v4h12v14H14v-3h-4v4a3 3 0 0 0 3 3h13a3 3 0 0 0 3-3V9a3 3 0 0 0-3-3H13Z',
        'm12 13 7 3-7 3v-6Z',
      ]) {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', d);
        path.setAttribute('fill', 'currentColor');
        icon.append(path);
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
      let viewState = null;
      let returnFocus = workspace && workspace.contains(installFocus) ? installFocus : null;
      const nativeCurrent = new Map();
      const restoreAttribute = (node, name, value) => value === null ? node.removeAttribute(name) : node.setAttribute(name, value);
      const selectedMarker = '[aria-current]:not([aria-current="false"]),[aria-selected="true"],[data-app-action-sidebar-thread-active="true"],[data-app-action-sidebar-thread-selected="true"]';
      const suspendCurrent = () => {
        for (const node of sidebar.querySelectorAll(selectedMarker)) {
          if (entry.contains(node)) continue;
          const attributes = new Map();
          for (const name of ['aria-current', 'aria-selected']) {
            const value = node.getAttribute(name);
            if (value !== null && value !== 'false') attributes.set(name, value);
          }
          nativeCurrent.set(node, { attributes, marker: node.getAttribute('data-taskboard-suspended-current') });
          node.setAttribute('data-taskboard-suspended-current', owner);
          for (const name of attributes.keys()) node.setAttribute(name, 'false');
        }
      };
      const restoreCurrent = () => {
        for (const [node, state] of nativeCurrent) {
          if (node.getAttribute('data-taskboard-suspended-current') !== owner) continue;
          for (const [name, value] of state.attributes) {
            if (node.getAttribute(name) === 'false') restoreAttribute(node, name, value);
          }
          restoreAttribute(node, 'data-taskboard-suspended-current', state.marker);
        }
        nativeCurrent.clear();
      };
      const suspendWorkspace = () => {
        viewState = { display: workspace.style.getPropertyValue('display'), priority: workspace.style.getPropertyPriority('display'),
          hidden: workspace.getAttribute('aria-hidden'), inert: workspace.getAttribute('inert') };
        workspace.style.setProperty('display', 'none', 'important');
        workspace.setAttribute('aria-hidden', 'true');
        workspace.inert = true;
        viewState.appliedInert = workspace.getAttribute('inert');
      };
      const restoreWorkspace = () => {
        if (!viewState) return;
        if (workspace.style.getPropertyValue('display') === 'none' && workspace.style.getPropertyPriority('display') === 'important')
          workspace.style.setProperty('display', viewState.display, viewState.priority);
        if (workspace.getAttribute('aria-hidden') === 'true') restoreAttribute(workspace, 'aria-hidden', viewState.hidden);
        if (workspace.getAttribute('inert') === viewState.appliedInert) restoreAttribute(workspace, 'inert', viewState.inert);
        viewState = null;
      };
      const ownsFocus = () => host.contains(document.activeElement) || document.activeElement === entry;
      const hide = (focusEntry = true) => {
        const resumeFocus = !focusEntry && ownsFocus() && returnFocus && returnFocus.isConnected ? returnFocus : null;
        host.style.display = 'none';
        restoreWorkspace(); restoreCurrent();
        if (entry) { entry.style.background = 'transparent'; entry.setAttribute('aria-pressed', 'false'); entry.removeAttribute('aria-current'); entry.title = '打开任务看板'; if (focusEntry) entry.focus(); }
        resumeFocus && resumeFocus.focus({ preventScroll: true });
      };
      const show = () => {
        if (host.style.display !== 'none') return;
        if (sidebar && (!workspace.isConnected || workspace.parentElement !== mount || !host.isConnected)) return cleanup();
        if (sidebar) { suspendWorkspace(); suspendCurrent(); }
        host.style.display = sidebar ? 'flex' : 'block';
        if (entry) { entry.style.background = 'rgba(127,127,127,.14)'; entry.setAttribute('aria-pressed', 'true'); entry.setAttribute('aria-current', 'page'); entry.title = '当前显示任务看板'; entry.focus(); }
      };
      const onFocus = (event) => {
        if (workspace && host.style.display === 'none' && workspace.contains(event.target)) returnFocus = event.target;
      };
      const onKey = (event) => { if (event.key === 'Escape' && host.style.display !== 'none' && ownsFocus()) hide(); };
      // Native navigation resumes the complete conversation view. Neither view
      // is unmounted, so editors, streaming output and unsaved board work survive.
      const onHostNavigation = () => { if (sidebar && host.style.display !== 'none') hide(false); };
      const onHostClick = (event) => {
        if (sidebar.contains(event.target) && !entry.contains(event.target)) onHostNavigation();
      };
      const hasSelection = (node) => node.nodeType === 1 && (node.matches(selectedMarker) || node.querySelector(selectedMarker));
      // Codex can switch chats in memory without changing the document URL.
      // Observe selection only; streamed titles and expanding folders are not navigation.
      const selectionObserver = sidebar ? new MutationObserver((records) => {
        if (host.style.display === 'none') return;
        let changed = false;
        for (let index = 0; index < records.length; index++) {
          const record = records[index];
          if (entry.contains(record.target)) continue;
          if (record.type !== 'attributes') {
            if ([...record.addedNodes, ...record.removedNodes].some(hasSelection)) changed = true;
            continue;
          }
          // A batch can contain both our presentation write and a host refresh.
          // Recover each mutation's value rather than confusing it with the last one.
          const next = records.slice(index + 1).find(item => item.target === record.target && item.attributeName === record.attributeName);
          const value = next ? next.oldValue : record.target.getAttribute(record.attributeName);
          const state = nativeCurrent.get(record.target);
          if (record.oldValue === value) {
            // A native deselection can write the same false value that we are
            // presenting. Keep that newer native state when the view resumes.
            if (state && state.attributes.has(record.attributeName) && value === 'false'
              && state.attributes.get(record.attributeName) !== 'false') {
              state.attributes.set(record.attributeName, value); changed = true;
            }
            continue;
          }
          if (state && state.attributes.has(record.attributeName)) {
            const original = state.attributes.get(record.attributeName);
            if (record.oldValue === original && value === 'false') continue;
            if (value === original) {
              if (record.target.getAttribute(record.attributeName) === original) record.target.setAttribute(record.attributeName, 'false');
              continue;
            }
            state.attributes.set(record.attributeName, value);
          }
          changed = true;
        }
        if (changed) onHostNavigation();
      }) : null;
      const workspaceObserver = sidebar ? new MutationObserver(() => {
        if (!root.isConnected || !workspace.isConnected || workspace.parentElement !== mount || !host.isConnected || !root.contains(sidebar)) return cleanup();
        if (viewState && (workspace.style.getPropertyValue('display') !== 'none' || workspace.style.getPropertyPriority('display') !== 'important'
          || workspace.getAttribute('aria-hidden') !== 'true' || !workspace.inert)) hide(false);
      }) : null;
      const navigation = sidebar ? window.navigation : null;
      const teardown = () => {
        const restore = ownsFocus() && returnFocus && returnFocus.isConnected ? returnFocus : null;
        window.removeEventListener('message', onMessage);
        document.removeEventListener('keydown', onKey);
        document.removeEventListener('focusin', onFocus);
        document.removeEventListener('click', onHostClick, true);
        window.removeEventListener('popstate', onHostNavigation);
        window.removeEventListener('hashchange', onHostNavigation);
        navigation && navigation.removeEventListener('navigate', onHostNavigation);
        selectionObserver && selectionObserver.disconnect();
        workspaceObserver && workspaceObserver.disconnect();
        entry && entry.removeEventListener('click', show);
        clearTimeout(timeout);
        clearInterval(challengeTimer);
        frame.removeEventListener('load', challenge);
        restoreWorkspace(); restoreCurrent();
        host.remove(); navStyle && navStyle.remove();
        entry && entry.remove();
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
      // Private generation-bound view controls let guarded draft validation read
      // the real native selection, rather than accepting our suspended ARIA state.
      cleanup.showNative = () => { const active = host.style.display !== 'none'; if (active) hide(false); return active; };
      cleanup.showBoard = show;
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
      document.addEventListener('focusin', onFocus);
      if (sidebar) {
        document.addEventListener('click', onHostClick, true);
        window.addEventListener('popstate', onHostNavigation);
        window.addEventListener('hashchange', onHostNavigation);
        navigation && navigation.addEventListener('navigate', onHostNavigation);
        selectionObserver.observe(sidebar, { subtree: true, childList: true, attributes: true,
          attributeOldValue: true, attributeFilter: ['aria-current', 'aria-selected',
            'data-app-action-sidebar-thread-active', 'data-app-action-sidebar-thread-selected'] });
        workspaceObserver.observe(root, { subtree: true, childList: true });
        workspaceObserver.observe(workspace, { attributes: true, attributeFilter: ['style', 'aria-hidden', 'inert'] });
      }
      entry && entry.addEventListener('click', show);
      frame.addEventListener('load', challenge);
      const challengeTimer = setInterval(challenge, 100);
      const timeout = setTimeout(() => finish({ installed: false, reason: 'board-ready-timeout' }, true), ${timeoutMs});
      challenge();
    });
  })()`;
}

function embedInstallationError(reason?: string): Error {
  if (reason === 'board-ready-timeout')
    return new Error('已定位 Codex 侧栏，但任务看板未在时限内就绪；请保持窗口可见后重试');
  if (reason === 'board-context-changed' || reason === 'unloaded')
    return new Error('接入期间 Codex 页面发生变化，侧栏已撤回；请等待页面加载完成后重试');
  return new Error('Codex DOM 标记未观察到，已拒绝注入');
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
  private ensuring?: Promise<AdapterCapabilities>;
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

  async ensureInstalled(): Promise<AdapterCapabilities> {
    if (this.ensuring) return this.ensuring;
    const task = this.ensureInstalledInternal();
    this.ensuring = task;
    try {
      return await task;
    } finally {
      if (this.ensuring === task) this.ensuring = undefined;
    }
  }

  private async ensureInstalledInternal(): Promise<AdapterCapabilities> {
    if (this.installing) await this.installing;
    if (this.recovery) await this.recovery;
    let capabilities = await this.probe();
    if (capabilities.embedded || this.lastLifecycleError) return capabilities;
    // A failed read-only probe does not revoke an existing installation. It
    // may coincide with a page recovery or a briefly busy launcher/CDP port.
    // Never start another injection or CSP reload while that session exists.
    if (!this.session) await this.install();
    const deadline = Date.now() + 10_000;
    do {
      if (this.recovery) await this.recovery;
      capabilities = await this.probe();
      if (capabilities.embedded || this.lastLifecycleError || !this.session) return capabilities;
      if (Date.now() >= deadline) return capabilities;
      await new Promise((resolve) => setTimeout(resolve, 100));
    } while (Date.now() < deadline);
    return capabilities;
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
    if (this.config.workspaceMarker && !this.config.sidebarMarker)
      throw new Error('Codex workspace marker requires verified native sidebar and content markers');
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
          await this.assertReloadSafe(connection, binding.exactPageUrl, true);
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
      const result = await this.evaluate<{ installed?: boolean; reason?: string }>(
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
          this.config.workspaceMarker,
        ),
        HANDSHAKE_COMMAND_TIMEOUT_MS,
      );
      if (generation !== this.generation)
        throw new Error('Codex adapter installation was cancelled');
      if (!result.installed) throw embedInstallationError(result.reason);
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

  private async assertReloadSafe(connection: CdpConnection, exactPageUrl: string, waitForWorkspace = false): Promise<void> {
    const shell = this.config.shellMarker;
    const editor = this.config.composerMarker;
    const modal = this.config.modalMarker;
    if (!shell || !editor || !modal)
      throw new Error('CSP reload requires explicit shell, empty-editor, and modal markers');
    const deadline = Date.now() + (waitForWorkspace ? this.hostReadyTimeoutMs() : 0);
    while (true) {
      await this.assertOwner();
      const safe = await this.evaluate<boolean>(
        connection,
        `(() => location.href === ${JSON.stringify(exactPageUrl)} && document.querySelectorAll(${JSON.stringify(shell)}).length === 1 && document.querySelectorAll(${JSON.stringify(editor)}).length === 1 && !document.querySelector(${JSON.stringify(modal)}) && !(document.querySelector(${JSON.stringify(editor)})?.textContent ?? '').trim())()`,
      );
      if (safe) return;
      // Diagnose the refused state without enabling bypass or reloading.
      const state = await this.evaluate<{
        url?: string; shell?: number; editors?: number; modal?: boolean; hasText?: boolean; login?: boolean;
      }>(connection,
        `({ url: location.href, shell: document.querySelectorAll(${JSON.stringify(shell)}).length, editors: document.querySelectorAll(${JSON.stringify(editor)}).length, modal: Boolean(document.querySelector(${JSON.stringify(modal)})), hasText: Array.from(document.querySelectorAll(${JSON.stringify(editor)})).some(element => Boolean((element.textContent ?? '').trim())), login: Array.from(document.querySelectorAll('button,a')).some(element => /^(log in|sign in|continue with chatgpt|登录|继续登录|使用 ChatGPT 登录)$/i.test((element.textContent ?? '').trim())) })`,
      );
      if (state?.url !== exactPageUrl)
        throw new Error('CSP reload refused: Codex target changed');
      if (state.modal) throw new Error('CSP reload refused: a Codex dialog is open');
      if (state.hasText) throw new Error('CSP reload refused: the Codex editor contains an unsent draft');
      if (state.login) throw new Error('CSP reload refused: Codex workspace is not ready; sign in and open a project first');
      if (waitForWorkspace && state.shell === 1 && state.editors === 1 && Date.now() < deadline) {
        // The initial mount may finish between the safety and diagnostic samples.
        // Retry the full owner/page/empty-editor check; diagnostics never authorize reload.
        continue;
      }
      if ((state.shell === 0 || state.shell === 1) &&
          (state.editors === 0 || state.editors === 1) &&
          (state.shell === 0 || state.editors === 0)) {
        // A newly opened daily window exposes CDP before its workspace mounts.
        // Only wait while it is unambiguously loading; drafts, dialogs, target
        // drift and duplicate markers still refuse before CSP is changed.
        if (waitForWorkspace && Date.now() < deadline) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          continue;
        }
        throw new Error('CSP reload refused: Codex workspace is not ready; sign in and open a project first');
      }
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
            `(() => { const root = document.querySelectorAll(${JSON.stringify(shellMarker)});
              if (root.length !== 1 || location.href !== ${JSON.stringify(binding.exactPageUrl)}) return false;
              const sidebar = ${this.config.sidebarMarker ? `document.querySelectorAll(${JSON.stringify(this.config.sidebarMarker)})` : '[]'};
              const content = ${this.config.contentMarker ? `document.querySelectorAll(${JSON.stringify(this.config.contentMarker)})` : '[]'};
              const workspace = ${this.config.workspaceMarker ? `document.querySelectorAll(${JSON.stringify(this.config.workspaceMarker)})` : '[]'};
              if (${Boolean(this.config.sidebarMarker || this.config.contentMarker)} &&
                (sidebar.length !== 1 || content.length !== 1 || !root[0].contains(sidebar[0]) || !root[0].contains(content[0]))) return false;
              return ${Boolean(this.config.workspaceMarker)} ? workspace.length === 1 && workspace[0] !== root[0]
                && root[0].contains(workspace[0]) && workspace[0].contains(content[0]) && !workspace[0].contains(sidebar[0]) : true; })()`,
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
        const result = await this.evaluate<{ installed?: boolean; reason?: string }>(
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
            this.config.workspaceMarker,
          ),
          HANDSHAKE_COMMAND_TIMEOUT_MS,
        );
        if (generation !== this.generation || connection !== this.connection) return;
        if (!result.installed) throw embedInstallationError(result.reason);
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
        editorCount: number; editorEmpty: boolean; editorModelEmpty: boolean; editorHasText: boolean; modal: boolean; overlayVisible: boolean; overlayGeneration: string | null };
      const readSurface = () => this.evaluate<DraftSurface | null>(
        connection,
        `(() => { if (location.href !== ${JSON.stringify(binding.exactPageUrl)}) return null;
          const selected = [...document.querySelectorAll('[data-app-action-sidebar-project-id][aria-current="page"]')];
          const editors = [...document.querySelectorAll('[contenteditable="true"][role="textbox"]')];
          const editor = editors.length === 1 ? editors[0] : null;
          const model = editor?.pmViewDesc?.node;
          const editorModelEmpty = !!model && model.type?.name === 'doc' && model.childCount === 1 &&
            model.firstChild?.type?.name === 'paragraph' && model.firstChild.content?.size === 0;
          const overlay = document.querySelector('[data-taskboard-owned]');
          return { selectedIds: selected.map(el => el.getAttribute('data-app-action-sidebar-project-id')),
            labels: selected.map(el => el.getAttribute('data-app-action-sidebar-project-label')),
            composerLabels: [...document.querySelectorAll('[data-composer-navigation-target="workspace-project"]')].map(el => el.getAttribute('aria-label')),
            editorCount: editors.length, editorModelEmpty, editorHasText: editors.some(el => !!el.textContent.trim()),
            editorEmpty: !!editor && !editor.textContent.trim() && editor.children.length === 1 &&
              editor.firstElementChild.tagName === 'P' && editor.firstElementChild.children.length === 1 &&
              editor.firstElementChild.firstElementChild.tagName === 'BR',
            modal: !!document.querySelector('[role="dialog"]'),
            overlayVisible: !!overlay && getComputedStyle(overlay).display !== 'none',
            overlayGeneration: overlay?.getAttribute('data-taskboard-owned') ?? null }; })()`,
      );
      // Read the real native selection before removing the entry or restoring
      // CSP. A refused request returns to the same mounted board.
      const sidebarSession = this.session;
      if (sidebarSession) this.assertCurrentSession(sidebarSession);
      let resumeBoard = false;
      if (sidebarSession) {
        await this.assertOwner();
        const active = await this.evaluate<boolean | null>(connection,
          `(() => { if (location.href !== ${JSON.stringify(binding.exactPageUrl)}) return null;
            const host = document.querySelectorAll('[data-taskboard-owned="${sidebarSession.generation}"]');
            const control = window[${JSON.stringify(`__taskboardEmbedCleanup_${sidebarSession.generation}`)}];
            return host.length === 1 && typeof control?.showNative === 'function' ? control.showNative() : null; })()`);
        if (active === null) throw new Error('DRAFT_UNAVAILABLE: 已安装的看板视图身份未确认');
        resumeBoard = active;
      }
      try {
        const initial = await readSurface();
        const initialId = initial?.selectedIds.length === 1 ? initial.selectedIds[0] : undefined;
        const initialProject = initialId ? resolveCodexProject(home, initialId) : undefined;
        const initialProjectMatches = !!initialProject &&
          (process.platform === 'win32' ? initialProject.path.toLowerCase() === requestedPath.toLowerCase() : initialProject.path === requestedPath) &&
          initial?.labels.length === 1 && initial.labels[0] === initialProject.name &&
          initial.composerLabels.length === 1 && initial.composerLabels[0] === `切换项目：${initialProject.name}`;
        const knownOverlay = !initial?.overlayVisible ||
          (!!sidebarSession && initial.overlayGeneration === String(sidebarSession.generation));
        if (!initialProjectMatches || !initial?.editorEmpty || !initial.editorModelEmpty || initial.modal || !knownOverlay)
          throw new Error('DRAFT_UNAVAILABLE: 项目身份、空白编辑器或页面状态未通过验证');
        if (sidebarSession) this.assertCurrentSession(sidebarSession);
        await this.assertOwner();
      } catch (error) {
        if (resumeBoard && sidebarSession && this.session === sidebarSession) {
          await this.assertOwner();
          this.assertCurrentSession(sidebarSession);
          const restored = await this.evaluate<boolean>(connection,
            `(() => { if (location.href !== ${JSON.stringify(binding.exactPageUrl)}) return false;
              const host = document.querySelectorAll('[data-taskboard-owned="${sidebarSession.generation}"]');
              const control = window[${JSON.stringify(`__taskboardEmbedCleanup_${sidebarSession.generation}`)}];
              if (host.length !== 1 || typeof control?.showBoard !== 'function') return false;
              control.showBoard(); return getComputedStyle(host[0]).display !== 'none'; })()`);
          if (!restored) throw new Error('DRAFT_UNAVAILABLE: 草稿验证未通过，看板视图恢复未确认');
        }
        throw error;
      }
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
        if (projectMatches && composerMatches && state?.editorEmpty && state.editorModelEmpty && !state.modal && !state.overlayVisible)
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
      try {
        const result = await this.evaluate<{ inserted?: boolean; exactText?: boolean; modelAccepted?: boolean; projectStillSelected?: boolean }>(
          connection,
          `(async () => {
            if (location.href !== ${JSON.stringify(binding.exactPageUrl)} || document.querySelector('[role="dialog"]')) return { inserted: false };
            const selected = [...document.querySelectorAll('[data-app-action-sidebar-project-id][aria-current="page"]')];
            const labels = [...document.querySelectorAll('[data-composer-navigation-target="workspace-project"]')];
            const editors = [...document.querySelectorAll('[contenteditable="true"][role="textbox"]')];
            const editor = editors[0];
            const model = editor?.pmViewDesc?.node;
            const overlay = document.querySelector('[data-taskboard-owned]');
            if (selected.length !== 1 || selected[0].getAttribute('data-app-action-sidebar-project-id') !== ${JSON.stringify(id)} ||
              selected[0].getAttribute('data-app-action-sidebar-project-label') !== ${JSON.stringify(project.name)} ||
              labels.length !== 1 || labels[0].getAttribute('aria-label') !== ${JSON.stringify(`切换项目：${project.name}`)} ||
              editors.length !== 1 || editor.textContent.trim() || editor.children.length !== 1 ||
              editor.firstElementChild.tagName !== 'P' || editor.firstElementChild.children.length !== 1 ||
              editor.firstElementChild.firstElementChild.tagName !== 'BR' ||
              model?.type?.name !== 'doc' || model.childCount !== 1 ||
              model.firstChild?.type?.name !== 'paragraph' || model.firstChild.content?.size !== 0 ||
              (overlay && getComputedStyle(overlay).display !== 'none')) return { inserted: false };
            editor.focus();
            const inserted = document.execCommand('insertText', false, ${JSON.stringify(request.prompt)});
            // Let the host process its input transaction before checking its model.
            // Visible DOM alone does not prove that Codex accepted the draft.
            await new Promise(resolve => setTimeout(resolve, 0));
            // Codex stores pasted newlines as separate <p> nodes. textContent drops the
            // separators, so compare the actual paragraph sequence with the prompt.
            const paragraphs = [...editor.children];
            const exactText = editor.childNodes.length === paragraphs.length && paragraphs.length > 0 &&
              paragraphs.every(paragraph => paragraph.tagName === 'P' &&
                (paragraph.children.length === 0 ||
                  (paragraph.children.length === 1 && paragraph.firstElementChild.tagName === 'BR' &&
                    !paragraph.textContent))) &&
              paragraphs.map(paragraph => paragraph.textContent ?? '').join('\\n') === ${JSON.stringify(request.prompt)};
            let modelAccepted = false;
            try {
              const accepted = editor.pmViewDesc?.node;
              modelAccepted = accepted?.type?.name === 'doc' && accepted.childCount === paragraphs.length &&
                typeof accepted.textBetween === 'function' &&
                accepted.textBetween(0, accepted.content.size, '\\n') === ${JSON.stringify(request.prompt)};
            } catch { /* An unknown editor model cannot confirm a draft. */ }
            const currentEditors = [...document.querySelectorAll('[contenteditable="true"][role="textbox"]')];
            const currentSelected = [...document.querySelectorAll('[data-app-action-sidebar-project-id][aria-current="page"]')];
            const currentLabels = [...document.querySelectorAll('[data-composer-navigation-target="workspace-project"]')];
            return { inserted, exactText, modelAccepted,
              projectStillSelected: location.href === ${JSON.stringify(binding.exactPageUrl)} &&
                !document.querySelector('[role="dialog"]') && currentEditors.length === 1 && currentEditors[0] === editor &&
                currentSelected.length === 1 && currentSelected[0] === selected[0] &&
                currentSelected[0].getAttribute('data-app-action-sidebar-project-id') === ${JSON.stringify(id)} &&
                currentSelected[0].getAttribute('data-app-action-sidebar-project-label') === ${JSON.stringify(project.name)} &&
                currentLabels.length === 1 && currentLabels[0].getAttribute('aria-label') === ${JSON.stringify(`切换项目：${project.name}`)} };
          })()`,
        );
        await this.assertOwner();
        const confirmedTarget = await connection.send<{ targetInfo?: { targetId?: string; type?: string; url?: string } }>('Target.getTargetInfo');
        if (!result.inserted || !result.exactText || !result.modelAccepted || !result.projectStillSelected ||
          confirmedTarget.targetInfo?.targetId !== binding.targetId || confirmedTarget.targetInfo.type !== 'page' ||
          confirmedTarget.targetInfo.url !== binding.exactPageUrl)
          throw new Error('Draft acceptance could not be confirmed');
      } catch {
        // Text may already be visible. Preserve it and prohibit a blind retry.
        throw new Error('DRAFT_UNCONFIRMED: 草稿尚未得到目标 Codex 编辑器确认；请保留窗口并手动检查，不要重复填入');
      }
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
