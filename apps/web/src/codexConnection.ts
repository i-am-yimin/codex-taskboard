import { useEffect, useSyncExternalStore } from 'react';
import { z } from 'zod';
import type { AdapterCapabilities } from '@taskboard/core';
import { companionKey, companionOrigin } from './companionBridge';

const connectionSchema = z.object({
  state: z.enum(['connected', 'connectable', 'restart-required', 'not-running', 'connecting']),
  mode: z.enum(['daily', 'managed']).optional(),
  version: z.string().optional(),
  reason: z.string(),
});
export type CodexConnection = z.infer<typeof connectionSchema>;
const capabilitiesSchema = z.object({
  embedded: z.boolean(),
  projects: z.boolean(),
  draft: z.boolean(),
  thread: z.boolean(),
  reason: z.string().optional(),
  draftReason: z.string().optional(),
  sidebar: z
    .object({
      state: z.enum([
        'unchecked',
        'structure-ready',
        'installed',
        'structure-missing',
        'structure-ambiguous',
        'state-blocked',
        'ownership-failed',
        'target-mismatch',
        'transport-unavailable',
        'restoration-unconfirmed',
        'disconnected',
      ]),
      appVersion: z.string().optional(),
      contractId: z.string().optional(),
      contractRevision: z.number().int().optional(),
    })
    .optional(),
});
function readCapabilities(value: unknown): AdapterCapabilities {
  const result = capabilitiesSchema.safeParse(value);
  if (!result.success || (result.data.embedded && result.data.sidebar?.state !== 'installed'))
    throw new Error('Codex 侧栏能力信息无效，请重新检测连接。');
  return result.data;
}
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
  capabilities?: AdapterCapabilities;
  stage?: 'native' | 'sidebar';
  diagnosis: string;
  autoConnect: boolean;
  preferenceError?: string;
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
  const result = connectionSchema.safeParse(await invoke<unknown>('codex_connection_status'));
  if (!result.success) throw new Error('本机 Codex 连接状态无效，请重新检测连接。');
  const connection = result.data;
  update({ connection });
  return connection;
}
let checking: Promise<CodexConnection | undefined> | undefined;
let connecting: Promise<void> | undefined;
let waiting: AbortController | undefined;
async function probe(): Promise<AdapterCapabilities> {
  const capabilities = readCapabilities(await localConnection<unknown>('/v1/codex/probe'));
  update({ capabilities });
  return capabilities;
}
async function waitForSidebar(signal: AbortSignal): Promise<AdapterCapabilities> {
  const deadline = Date.now() + 10_000;
  let result = await probe();
  // A newly opened host can briefly lack its complete workspace. Repeat only
  // read-only observations within this budget; every probe verifies ownership.
  // A missing structure never authorizes installation by itself.
  while (
    !result.embedded &&
    ['unchecked', 'structure-missing'].includes(result.sidebar?.state ?? '') &&
    Date.now() < deadline
  ) {
    update({ diagnosis: `${result.reason ?? '侧栏尚未就绪'}；正在短暂重新检测…` });
    await pause(signal);
    signal.throwIfAborted();
    result = await probe();
  }
  return result;
}
export function detectCodex(): Promise<CodexConnection | undefined> {
  if (checking) return checking;
  if (connecting) return connecting.then(() => snapshot.connection);
  checking = (async () => {
    update({ phase: 'checking', stage: 'native', connection: undefined, capabilities: undefined });
    try {
      const connection = await status();
      if (connection.state !== 'connected') {
        update({ phase: 'idle', diagnosis: connection.reason, capabilities: undefined });
        return connection;
      }
      update({ stage: 'sidebar' });
      const result = await probe();
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
      update({ stage: undefined });
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
let pendingPreference: boolean | undefined;
export function setAutoConnect(enabled: boolean) {
  try {
    localStorage.setItem(preferenceKey, enabled ? '1' : '0');
    pendingPreference = undefined;
    update({ autoConnect: enabled, preferenceError: undefined });
  } catch {
    pendingPreference = enabled;
    update({ preferenceError: '无法保存自动连接设置。请检查本机存储，然后重试保存。' });
  }
}
export function retryAutoConnectPreference() {
  if (pendingPreference !== undefined) setAutoConnect(pendingPreference);
}
export function connectDailyCodex(waitForExit = true, sidebarOnly = false): Promise<void> {
  if (connecting) return connecting;
  connecting = (async () => {
    if (checking) await checking;
    const controller = new AbortController();
    waiting = controller;
    update({
      phase: 'connecting',
      stage: 'native',
      connection: undefined,
      capabilities: undefined,
      diagnosis: '正在连接日常 Codex…',
    });
    try {
      let connection = await status();
      if (sidebarOnly && connection.state !== 'connected')
        throw new Error('原有 Codex 连接尚未确认，请先检测连接。');
      // Another native request may already be opening or attaching Codex.
      // Observe it before deciding whether a fresh launch is needed.
      const nativeDeadline = Date.now() + 120_000;
      while (connection.state === 'connecting') {
        update({ diagnosis: 'Codex 正在打开或连接，正在确认现有操作…' });
        if (Date.now() >= nativeDeadline)
          throw new Error('现有 Codex 连接仍未完成。请稍后检测连接，确认状态后再重试。');
        await pause(controller.signal);
        connection = await status();
      }
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
      if (!sidebarOnly) await window.__TAURI__!.core!.invoke<string>('connect_daily_codex');
      // Native attachment and sidebar installation are separate facts. Keep
      // the successful attachment even if the host rejects the sidebar.
      connection = await status();
      if (connection.state !== 'connected' || (!sidebarOnly && connection.mode !== 'daily'))
        throw new Error(connection.reason || '日常 Codex 连接尚未确认，请检测连接后重试。');
      update({ stage: 'sidebar', diagnosis: '已连接日常 Codex，正在检查侧栏能力…' });
      let result = await waitForSidebar(controller.signal);
      if (!result.embedded && result.sidebar?.state !== 'structure-ready') {
        update({
          phase: 'error',
          diagnosis: result.reason ?? '侧栏能力尚未就绪，请检测连接后重试。',
        });
        return;
      }
      if (!result.embedded) {
        update({ diagnosis: '侧栏检查通过，正在接入任务看板…' });
        result = readCapabilities(await localConnection<unknown>('/v1/codex/install', {}));
        update({ capabilities: result });
      }
      if (!result.embedded) {
        update({ phase: 'error', diagnosis: result.reason ?? '侧栏尚未就绪，请检测连接后重试。' });
        return;
      }
      if (connection.mode === 'daily' && readPreference() === null) setAutoConnect(true);
      update({
        phase: 'connected',
        connection,
        diagnosis:
          connection.mode === 'managed'
            ? '独立测试环境的侧栏看板已接入。'
            : '已接入日常 Codex 侧栏，原登录、项目和会话保持不变。',
      });
    } catch (error) {
      if (snapshot.stage === 'sidebar') {
        // An install refusal may include more specific current capabilities.
        // This is read-only; it never retries injection after a timeout.
        update({ capabilities: undefined });
        try {
          await probe();
        } catch {
          /* Preserve the original failure. */
        }
      }
      update({
        phase: controller.signal.aborted ? 'idle' : 'error',
        diagnosis: controller.signal.aborted
          ? '已取消等待，Codex 保持原样。准备好后可再次连接。'
          : connectionError(error, '看板接入失败'),
      });
    } finally {
      update({ stage: undefined });
      waiting = undefined;
      connecting = undefined;
    }
  })();
  return connecting;
}
export function openCodex(): Promise<void> {
  if (connecting) return connecting;
  connecting = (async () => {
    if (checking) await checking;
    update({
      phase: 'connecting',
      stage: 'native',
      capabilities: undefined,
      connection: undefined,
      diagnosis: '正在确认并打开 Codex 窗口…',
    });
    try {
      const connection = await status();
      if (connection.state === 'connected') {
        const current = await probe();
        if (
          ['ownership-failed', 'target-mismatch', 'restoration-unconfirmed'].includes(
            current.sidebar?.state ?? '',
          )
        )
          throw new Error(current.reason ?? 'Codex 接入核验未通过，请先重新检测连接。');
      }
      await window.__TAURI__!.core!.invoke<string>(
        connection.mode === 'managed' ? 'start_managed_codex' : 'connect_daily_codex',
      );
      const current = await status();
      if (current.state !== 'connected') throw new Error(current.reason);
      update({ stage: 'sidebar' });
      const capabilities = await probe();
      update({
        phase: capabilities.embedded ? 'connected' : 'idle',
        diagnosis: capabilities.embedded
          ? current.mode === 'managed'
            ? '独立测试环境的侧栏看板已接入。'
            : '已接入日常 Codex 侧栏，原登录、项目和会话保持不变。'
          : (capabilities.reason ?? 'Codex 已打开，请检测侧栏能力。'),
      });
    } catch (error) {
      update({ phase: 'error', diagnosis: connectionError(error, 'Codex 窗口打开失败') });
    } finally {
      update({ stage: undefined });
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
      !['ownership-failed', 'target-mismatch', 'restoration-unconfirmed'].includes(
        snapshot.capabilities?.sidebar?.state ?? '',
      ) &&
      ['connected', 'connectable', 'not-running'].includes(connection.state)
    ) {
      await connectDailyCodex(false);
    }
  })());
}
let observerCount = 0;
let stopObservation: (() => void) | undefined;
function observeConnection() {
  observerCount++;
  if (observerCount === 1) {
    const refresh = () => {
      if (document.visibilityState === 'visible' && !connecting && !checking) void detectCodex();
    };
    const timer = setInterval(() => {
      if (snapshot.phase === 'connected') refresh();
    }, 30_000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    stopObservation = () => {
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }
  return () => {
    observerCount--;
    if (!observerCount) {
      stopObservation?.();
      stopObservation = undefined;
    }
  };
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
    if (!available) return;
    void initialize();
    return observeConnection();
  }, [available]);
  return {
    ...current,
    available,
    busy: ['checking', 'connecting', 'waiting'].includes(current.phase),
    connect: connectDailyCodex,
    installSidebar: () => connectDailyCodex(false, true),
    open: openCodex,
    detect: detectCodex,
    cancelWait: cancelCodexWait,
    setAutoConnect,
    retryPreference: retryAutoConnectPreference,
  };
}
