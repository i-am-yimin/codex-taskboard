import {
  assessServerCompatibility,
  requiresCollaborationContract,
  MINIMUM_COLLABORATION_SERVER,
  type ServerCompatibility,
} from '@taskboard/core';
import type { ApiFault, Board, Space, Task, TaskDetail, User } from './types';
import { companionKey, companionOrigin, hasLocalCompanion } from './companionBridge';
export {
  companionKey,
  companionOrigin,
  embeddedCapability,
  hasLocalCompanion,
} from './companionBridge';

const uncertainWriteKeys = new Map<string, string>();

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
async function sendRequest<T>(
  path: string,
  init: { method?: string; body?: unknown; version?: number; idempotencyKey?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  if (init.version !== undefined) headers['If-Match'] = String(init.version);
  const writeSignature =
    init.method && init.method !== 'GET'
      ? JSON.stringify([init.method, path, init.version, init.body])
      : null;
  if (writeSignature) {
    const key = init.idempotencyKey ?? uncertainWriteKeys.get(writeSignature) ?? idempotencyKey();
    headers['Idempotency-Key'] = key;
    if (uncertainWriteKeys.size >= 100 && !uncertainWriteKeys.has(writeSignature))
      throw new ApiError('PENDING_WRITES_LIMIT', '待确认操作过多，请先恢复连接并核对现有操作。', 0);
    uncertainWriteKeys.set(writeSignature, key);
  }
  const desktop = hasLocalCompanion();
  if (desktop) {
    const key = await companionKey();
    if (!key) throw new ApiError('COMPANION_UNAVAILABLE', '桌面伴随服务未准备好', 0);
    headers['x-taskboard-companion-key'] = key;
  }
  let response: Response;
  try {
    response = await fetch(`${desktop ? `${companionOrigin()}/api/v1` : base}${path}`, {
      method: init.method ?? 'GET',
      cache: path.split('?')[0] === '/health' ? 'no-store' : 'default',
      headers,
      credentials: desktop ? 'omit' : 'include',
      signal: AbortSignal.timeout(12000),
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiError('OFFLINE', '当前无法连接到任务看板服务器', 0);
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if ((init.method ?? 'GET') === 'GET' && [502, 503, 504].includes(response.status))
      throw new ApiError('OFFLINE', '任务看板服务器暂时不可用', response.status);
    if (writeSignature && response.status < 500) uncertainWriteKeys.delete(writeSignature);
    const err = payload.error ?? {};
    throw new ApiError(
      err.code ?? 'REQUEST_FAILED',
      err.message ?? '请求未能完成',
      response.status,
      err.details,
    );
  }
  if (
    (desktop || path.split('?')[0] === '/health') &&
    payload.meta?.source === 'cache' &&
    payload.meta?.offline === true
  )
    throw new ApiError('OFFLINE', '桌面伴随服务正在使用离线缓存', 0);
  if (writeSignature) uncertainWriteKeys.delete(writeSignature);
  return payload.data as T;
}
let compatibilityProbe: Promise<ServerCompatibility> | null = null;
let compatibilityEpoch = 0;
/** No previous success authorizes a new write: each wave probes the current server afresh. */
export function resetServerCompatibility(): void {
  compatibilityEpoch++;
  compatibilityProbe = null;
}
export function checkServerCompatibility(): Promise<ServerCompatibility> {
  if (compatibilityProbe) return compatibilityProbe;
  const epoch = compatibilityEpoch;
  const operation = sendRequest<unknown>('/health')
    .catch((error) => {
      if (error instanceof ApiError && error.status === 404) return {};
      throw error;
    })
    .then((value) => {
      if (epoch !== compatibilityEpoch)
        throw new ApiError('SERVER_CHANGED', '服务器或账号已切换，请重新检查兼容性', 409);
      return assessServerCompatibility(value);
    });
  compatibilityProbe = operation;
  void operation
    .finally(() => {
      if (compatibilityProbe === operation) compatibilityProbe = null;
    })
    .catch(() => undefined);
  return operation;
}
export async function ensureCollaborationServer(): Promise<void> {
  const compatibility = await checkServerCompatibility();
  if (compatibility.status !== 'compatible')
    throw new ApiError(
      'SERVER_UPGRADE_REQUIRED',
      `服务器需要升级：${compatibility.reason}请使用配套 ${MINIMUM_COLLABORATION_SERVER} 或支持相同协作协议的服务器，并完成数据库迁移。现有看板仅供浏览，草稿保留。`,
      409,
      compatibility,
    );
}
export const needsCollaborationContract = requiresCollaborationContract;
export async function request<T>(
  path: string,
  init: { method?: string; body?: unknown; version?: number; idempotencyKey?: string } = {},
): Promise<T> {
  if (needsCollaborationContract(path, init.method)) await ensureCollaborationServer();
  return sendRequest<T>(path, init);
}
export const api = {
  me: () => request<User>('/me'),
  login: async (body: { email: string; password: string; deviceName: string }) => {
    resetServerCompatibility();
    if (!hasLocalCompanion())
      return request<{ user: User }>('/auth/login', { method: 'POST', body });
    const key = await companionKey();
    const response = await fetch(`${companionOrigin()}/v1/browser/login`, {
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
    resetServerCompatibility();
    if (!hasLocalCompanion()) return request<void>('/auth/logout', { method: 'POST' });
    const key = await companionKey();
    await fetch(`${companionOrigin()}/v1/browser/logout`, {
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
  comment: (id: string, body: string, mentionIds: string[] = []) =>
    request<void>(`/tasks/${id}/comments`, {
      method: 'POST',
      body: { body, ...(mentionIds.length ? { mentionIds } : {}) },
    }),
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
  const response = await fetch(`${companionOrigin()}/v1/codex/open-draft`, {
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
  resetServerCompatibility();
  uncertainWriteKeys.clear();
  Object.keys(localStorage)
    .filter(
      (k) =>
        k.startsWith(`tb:board:${accountId}:`) ||
        k.startsWith(`tb:draft:${accountId}:`) ||
        k.startsWith(`tb:result:${accountId}:`) ||
        k.startsWith(`tb:comment:${accountId}:`) ||
        (k.startsWith('tb:appearance:') && k.endsWith(`:${accountId}`)),
    )
    .forEach((k) => localStorage.removeItem(k));
}
