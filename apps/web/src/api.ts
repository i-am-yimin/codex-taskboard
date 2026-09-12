import type { ApiFault, Board, Space, Task, TaskDetail, User } from './types';

const base = import.meta.env.VITE_API_BASE ?? '/api/v1';
export class ApiError extends Error implements ApiFault {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
  }
}
export function idempotencyKey() {
  return crypto.randomUUID();
}
export async function request<T>(
  path: string,
  init: { method?: string; body?: unknown; version?: number; idempotencyKey?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  if (init.version !== undefined) headers['If-Match'] = String(init.version);
  if (init.method && init.method !== 'GET')
    headers['Idempotency-Key'] = init.idempotencyKey ?? idempotencyKey();
  const desktop = typeof window !== 'undefined' && Boolean(window.__TAURI__?.core?.invoke);
  if (desktop) {
    const key = await companionKey();
    if (!key) throw new ApiError('COMPANION_UNAVAILABLE', '桌面伴随服务未准备好', 0);
    headers['x-taskboard-companion-key'] = key;
  }
  let response: Response;
  try {
    response = await fetch(`${desktop ? 'http://127.0.0.1:47831/api/v1' : base}${path}`, {
      method: init.method ?? 'GET',
      headers,
      credentials: desktop ? 'omit' : 'include',
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiError('OFFLINE', '当前无法连接到任务看板服务器', 0);
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = payload.error ?? {};
    throw new ApiError(
      err.code ?? 'REQUEST_FAILED',
      err.message ?? '请求未能完成',
      response.status,
      err.details,
    );
  }
  if (desktop && payload.meta?.source === 'cache' && payload.meta?.offline === true)
    throw new ApiError('OFFLINE', '桌面伴随服务正在使用离线缓存', 0);
  return payload.data as T;
}
export const api = {
  me: () => request<User>('/me'),
  login: async (body: { email: string; password: string; deviceName: string }) => {
    if (typeof window === 'undefined' || !window.__TAURI__?.core?.invoke)
      return request<{ user: User }>('/auth/login', { method: 'POST', body });
    const key = await companionKey();
    const response = await fetch('http://127.0.0.1:47831/v1/browser/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-taskboard-companion-key': key ?? '' },
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    if (!response.ok)
      throw new ApiError(
        payload.error?.code ?? 'LOGIN_FAILED',
        payload.error?.message ?? '登录失败',
        response.status,
      );
    return payload.data;
  },
  logout: async () => {
    if (typeof window === 'undefined' || !window.__TAURI__?.core?.invoke)
      return request<void>('/auth/logout', { method: 'POST' });
    const key = await companionKey();
    await fetch('http://127.0.0.1:47831/v1/browser/logout', {
      method: 'POST',
      headers: { 'x-taskboard-companion-key': key ?? '' },
    });
  },
  spaces: () => request<Space[]>('/spaces?archived=true'),
  createSpace: (body: Pick<Space, 'name' | 'icon' | 'color' | 'description'>) =>
    request<Space>('/spaces', { method: 'POST', body }),
  board: (id: string) => request<Board>(`/spaces/${id}/board`),
  createTask: (spaceId: string, body: Partial<Task>) =>
    request<Task>(`/spaces/${spaceId}/tasks`, { method: 'POST', body }),
  task: (id: string) => request<TaskDetail>(`/tasks/${id}/detail`),
  patchTask: (id: string, body: Partial<Task>, version: number) =>
    request<Task>(`/tasks/${id}`, { method: 'PATCH', body, version }),
  claim: (id: string, version: number) =>
    request<void>(`/tasks/${id}/claim`, { method: 'POST', body: {}, version }),
  submit: (id: string, summary: string, verification: string, version: number) =>
    request<void>(`/tasks/${id}/submit`, {
      method: 'POST',
      body: { summary, verification },
      version,
    }),
  accept: (id: string, version: number) =>
    request<void>(`/tasks/${id}/accept`, { method: 'POST', body: {}, version }),
  comment: (id: string, body: string) =>
    request<void>(`/tasks/${id}/comments`, { method: 'POST', body: { body } }),
  createStatus: (
    spaceId: string,
    body: { name: string; semantic: string; position: number; color: string },
  ) => request(`/spaces/${spaceId}/statuses`, { method: 'POST', body }),
  patchSpace: (id: string, body: Partial<Space>, version: number) =>
    request<Space>(`/spaces/${id}`, { method: 'PATCH', body, version }),
  updateMember: (spaceId: string, userId: string, role: string) =>
    request<void>(`/spaces/${spaceId}/members/${userId}`, { method: 'PATCH', body: { role } }),
  removeMember: (spaceId: string, userId: string) =>
    request<void>(`/spaces/${spaceId}/members/${userId}`, { method: 'DELETE' }),
  deleteStatus: (statusId: string, targetStatusId: string) =>
    request<void>(`/statuses/${statusId}`, { method: 'DELETE', body: { targetStatusId } }),
  members: (spaceId: string) => request<User[]>(`/spaces/${spaceId}/members`),
  invite: (spaceId: string, body: { email: string | null; role: string; expiresInHours: number }) =>
    request<{ id: string; token: string; expiresInHours: number }>(
      `/spaces/${spaceId}/invitations`,
      { method: 'POST', body },
    ),
  transferOwner: (spaceId: string, userId: string) =>
    request<void>(`/spaces/${spaceId}/transfer-owner`, { method: 'POST', body: { userId } }),
  archiveSpace: (spaceId: string) =>
    request<void>(`/spaces/${spaceId}/archive`, { method: 'POST' }),
  restoreSpace: (spaceId: string) =>
    request<void>(`/spaces/${spaceId}/restore`, { method: 'POST' }),
  patchStatus: (
    statusId: string,
    body: Partial<{ name: string; semantic: string; position: number; color: string }>,
  ) => request(`/statuses/${statusId}`, { method: 'PATCH', body }),
  acceptInvitation: (token: string, name: string, email: string, password: string) =>
    request<{ userId: string }>('/auth/invitations/accept', {
      method: 'POST',
      body: { token, name, email, password },
    }),
  completeRecovery: (token: string, password: string) =>
    request<{ reset: boolean }>('/auth/recovery/complete', {
      method: 'POST',
      body: { token, password },
    }),
};

declare global {
  interface Window {
    __TAURI__?: { core?: { invoke<T>(command: string): Promise<T> } };
  }
}
async function companionKey() {
  return window.__TAURI__?.core?.invoke<string>('bridge_capability');
}
/** The renderer only receives a short-lived local bridge capability, never a remote server token. */
export async function openCodexDraft(body: {
  taskId: string;
  spaceId: string;
  repository: string | null;
  prompt: string;
}): Promise<{ opened: boolean; fallback?: string }> {
  const key = await companionKey();
  if (!key)
    throw new ApiError(
      'COMPANION_UNAVAILABLE',
      '未检测到桌面伴随服务，请先在浏览器中使用看板。',
      0,
    );
  const response = await fetch('http://127.0.0.1:47831/v1/codex/open-draft', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-taskboard-companion-key': key },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new ApiError(
      payload.error?.code ?? 'COMPANION_FAILED',
      payload.error?.message ?? '无法打开 Codex 草稿',
      response.status,
    );
  return payload.data ?? payload;
}

/** Cache is keyed by the signed-in account, so a browser logout cannot expose another account's board. */
export function cacheBoard(accountId: string, board: Board) {
  localStorage.setItem(`tb:board:${accountId}:${board.space.id}`, JSON.stringify(board));
}
export function readCachedBoard(accountId: string, spaceId: string): Board | null {
  try {
    return JSON.parse(localStorage.getItem(`tb:board:${accountId}:${spaceId}`) ?? 'null');
  } catch {
    return null;
  }
}
export function clearAccountCache(accountId: string) {
  Object.keys(localStorage)
    .filter(
      (k) =>
        k.startsWith(`tb:board:${accountId}:`) ||
        k.startsWith(`tb:draft:${accountId}:`) ||
        k.startsWith(`tb:result:${accountId}:`),
    )
    .forEach((k) => localStorage.removeItem(k));
}
