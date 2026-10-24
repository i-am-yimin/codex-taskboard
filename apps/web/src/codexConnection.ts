import { useEffect, useSyncExternalStore } from 'react';
import { companionKey, companionOrigin } from './companionBridge';

export type CodexConnection = {
  state: 'connected' | 'connectable' | 'restart-required' | 'not-running' | 'connecting';
  mode?: 'daily' | 'managed';
  version?: string;
  reason: string;
};
type Phase = 'idle' | 'checking' | 'connecting' | 'waiting' | 'connected' | 'error';
const preferenceKey = 'tb:daily-codex:auto-connect';
function readPreference(): string | null {
  try {
    return localStorage.getItem(preferenceKey);
  } catch {
    return null;
  }
}
let snapshot: {
  phase: Phase;
  connection?: CodexConnection;
  diagnosis: string;
  autoConnect: boolean;
} = {
  phase: 'idle',
  diagnosis: '从 Taskboard 打开或连接日常 Codex，沿用原登录、项目和会话。',
  autoConnect: readPreference() === '1',
};
const listeners = new Set<() => void>();
function update(changes: Partial<typeof snapshot>) {
  snapshot = { ...snapshot, ...changes };
  listeners.forEach((listener) => listener());
}
export function connectionError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  return message.trim() ? message : fallback;
}
export async function localConnection<T>(path: string, body?: unknown): Promise<T> {
  const key = await companionKey();
  if (!key) throw new Error('需要 Windows 启动器提供本机连接；当前可使用浏览器看板。');
  const response = await fetch(`${companionOrigin()}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      'x-taskboard-companion-key': key,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(path === '/v1/codex/install' ? 150_000 : 15_000),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message ?? '本机连接失败');
  return result.data;
}
async function status(): Promise<CodexConnection> {
  const invoke = window.__TAURI__?.core?.invoke;
  if (!invoke) throw new Error('请在 Windows Taskboard 中连接 Codex。');
  const connection = await invoke<CodexConnection>('codex_connection_status');
  update({ connection });
  return connection;
}
let checking: Promise<CodexConnection | undefined> | undefined;
let connecting: Promise<void> | undefined;
let waiting: AbortController | undefined;
export function detectCodex(): Promise<CodexConnection | undefined> {
  if (checking) return checking;
  if (connecting) return connecting.then(() => snapshot.connection);
  checking = (async () => {
    update({ phase: 'checking' });
    try {
      const connection = await status();
      if (connection.state !== 'connected') {
        update({ phase: 'idle', diagnosis: connection.reason });
        return connection;
      }
      const result = await localConnection<{ embedded: boolean; reason?: string }>(
        '/v1/codex/probe',
      );
      update({
        phase: result.embedded ? 'connected' : 'idle',
        diagnosis: result.embedded
          ? connection.mode === 'daily'
            ? '已接入日常 Codex 侧栏，原登录、项目和会话保持不变。'
            : '独立测试环境的侧栏看板已接入。'
          : (result.reason ?? connection.reason),
      });
      return connection;
    } catch (error) {
      update({ phase: 'error', diagnosis: connectionError(error, '检测失败') });
      return undefined;
    } finally {
      checking = undefined;
    }
  })();
  return checking;
}
function pause(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException('已取消等待', 'AbortError'));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, 2000);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
  });
}
export function setAutoConnect(enabled: boolean) {
  try {
    localStorage.setItem(preferenceKey, enabled ? '1' : '0');
    update({ autoConnect: enabled });
  } catch {
    update({ phase: 'error', diagnosis: '无法保存自动连接设置，请检查本机存储后重试。' });
  }
}
export function connectDailyCodex(waitForExit = true): Promise<void> {
  if (connecting) return connecting;
  connecting = (async () => {
    if (checking) await checking;
    const controller = new AbortController();
    waiting = controller;
    update({ phase: 'connecting', diagnosis: '正在连接日常 Codex…' });
    try {
      let connection = await status();
      if (connection.state === 'restart-required') {
        if (!waitForExit) {
          update({ phase: 'idle', diagnosis: connection.reason });
          return;
        }
        const deadline = Date.now() + 5 * 60_000;
        while (connection.state === 'restart-required' || connection.state === 'connecting') {
          update({
            phase: 'waiting',
            diagnosis:
              '请先保存工作并正常退出 Codex。Taskboard 正在等待，退出后会自动打开原环境并接入侧栏，无需使用快捷方式。',
          });
          if (Date.now() >= deadline)
            throw new Error('等待已结束。保存工作并退出 Codex 后，可再次点击“连接 Codex”。');
          await pause(controller.signal);
          connection = await status();
          controller.signal.throwIfAborted();
        }
      }
      controller.signal.throwIfAborted();
      update({ phase: 'connecting', diagnosis: '正在打开或连接日常 Codex，并接入任务看板…' });
      await window.__TAURI__!.core!.invoke<string>('connect_daily_codex');
      const result = await localConnection<{ embedded: boolean; reason?: string }>(
        '/v1/codex/install',
        {},
      );
      if (!result.embedded) throw new Error(result.reason ?? '侧栏尚未就绪，请检测连接后重试。');
      if (readPreference() === null) setAutoConnect(true);
      update({
        phase: 'connected',
        connection: { ...connection, state: 'connected', mode: 'daily' },
        diagnosis: '已接入日常 Codex 侧栏，原登录、项目和会话保持不变。',
      });
    } catch (error) {
      update({
        phase: controller.signal.aborted ? 'idle' : 'error',
        diagnosis: controller.signal.aborted
          ? '已取消等待，Codex 保持原样。准备好后可再次连接。'
          : connectionError(error, '看板接入失败'),
      });
    } finally {
      waiting = undefined;
      connecting = undefined;
    }
  })();
  return connecting;
}
export function cancelCodexWait() {
  if (snapshot.phase === 'waiting') waiting?.abort();
}
let initialized: Promise<void> | undefined;
function initialize() {
  return (initialized ??= (async () => {
    const connection = await detectCodex();
    if (
      snapshot.autoConnect &&
      connection &&
      connection.mode !== 'managed' &&
      ['connected', 'connectable', 'not-running'].includes(connection.state)
    ) {
      await connectDailyCodex(false);
    }
  })());
}
export function useCodexConnection() {
  const current = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => snapshot,
  );
  const available = Boolean(window.__TAURI__?.core?.invoke);
  useEffect(() => {
    if (available) void initialize();
  }, [available]);
  return {
    ...current,
    available,
    busy: ['checking', 'connecting', 'waiting'].includes(current.phase),
    connect: connectDailyCodex,
    detect: detectCodex,
    cancelWait: cancelCodexWait,
    setAutoConnect,
  };
}
