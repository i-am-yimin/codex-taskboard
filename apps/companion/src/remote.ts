import type { TaskTransport } from '@taskboard/core';

export class CompanionError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 500,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export function validateNormalizedUpstream(value: string): string {
  const url = new URL(value);
  const localhost = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  if (
    (url.protocol !== 'https:' && !(localhost && url.protocol === 'http:')) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  )
    throw new CompanionError('UNSAFE_UPSTREAM', '远程服务必须使用 HTTPS（本机开发例外）');
  return url.href;
}

function endpoint(value: string): URL {
  const url = new URL(validateNormalizedUpstream(value));
  url.pathname = url.pathname.replace(/\/$/, '') + '/api/v1';
  return url;
}

export class RemoteTransport implements TaskTransport {
  private readonly base: URL;
  constructor(
    upstream: string,
    private readonly credential: () => Promise<string | undefined>,
    private readonly credentialKind: 'bearer' | 'cookie' = 'bearer',
    private readonly clientKind: 'agent' | 'browser' = 'agent',
  ) {
    this.base = endpoint(upstream);
  }
  async request<T>(
    path: string,
    options: { method?: string; body?: unknown; version?: number; idempotencyKey?: string } = {},
  ): Promise<T> {
    if (!path.startsWith('/') || path.includes('..'))
      throw new CompanionError('INVALID_PATH', '无效 API 路径');
    const token = await this.credential();
    if (!token) throw new CompanionError('AUTH_REQUIRED', '请先在伴随服务中登录', 401);
    const url = new URL(this.base.toString() + path);
    const headers: Record<string, string> = {
      accept: 'application/json',
      'x-taskboard-client': this.clientKind,
    };
    headers[this.credentialKind === 'bearer' ? 'authorization' : 'cookie'] =
      this.credentialKind === 'bearer' ? `Bearer ${token}` : token;
    if (options.body !== undefined) headers['content-type'] = 'application/json';
    if (options.version !== undefined) headers['if-match'] = String(options.version);
    if (options.idempotencyKey) headers['idempotency-key'] = options.idempotencyKey;
    let response: Response;
    try {
      response = await fetch(url, {
        method: options.method ?? 'GET',
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: AbortSignal.timeout(12_000),
      });
    } catch {
      throw new CompanionError('OFFLINE', '无法连接任务看板服务', 503);
    }
    const payload = (await response.json().catch(() => ({}))) as {
      data?: T;
      error?: { code?: string; message?: string; details?: unknown };
    };
    if (!response.ok)
      throw new CompanionError(
        payload.error?.code ?? 'REMOTE_ERROR',
        payload.error?.message ?? `远程服务返回 ${response.status}`,
        response.status,
        payload.error?.details,
      );
    return payload.data as T;
  }

  /**
   * Opens an authenticated, read-only server-sent event response.  The caller
   * owns the supplied signal and must abort it when the local client goes away.
   */
  async stream(path: string, signal: AbortSignal): Promise<Response> {
    if (!path.startsWith('/') || path.includes('..'))
      throw new CompanionError('INVALID_PATH', '无效 API 路径');
    const token = await this.credential();
    if (!token) throw new CompanionError('AUTH_REQUIRED', '请先在伴随服务中登录', 401);
    const url = new URL(this.base.toString() + path);
    const headers: Record<string, string> = {
      accept: 'text/event-stream',
      'x-taskboard-client': this.clientKind,
    };
    headers[this.credentialKind === 'bearer' ? 'authorization' : 'cookie'] =
      this.credentialKind === 'bearer' ? `Bearer ${token}` : token;
    let response: Response;
    try {
      response = await fetch(url, { method: 'GET', headers, signal, redirect: 'error' });
    } catch (error) {
      if (signal.aborted) throw error;
      throw new CompanionError('OFFLINE', '无法连接任务看板服务', 503);
    }
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as {
        error?: { code?: string; message?: string; details?: unknown };
      };
      throw new CompanionError(
        payload.error?.code ?? 'REMOTE_ERROR',
        payload.error?.message ?? `远程服务返回 ${response.status}`,
        response.status,
        payload.error?.details,
      );
    }
    if (!response.body)
      throw new CompanionError('STREAM_UNAVAILABLE', '远程服务未返回实时数据流', 502);
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.toLowerCase().startsWith('text/event-stream'))
      throw new CompanionError('STREAM_UNAVAILABLE', '远程服务未返回 SSE 数据流', 502);
    return response;
  }
}
