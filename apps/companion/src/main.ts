import Fastify, { type FastifyInstance } from 'fastify';
import { createHash, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { z } from 'zod';
import { taskPrompt, type Task } from '@taskboard/core';
import { CodexDesktopAdapter, SUPPORTED_CODEX_VERSIONS, codexHostMarkers } from '@taskboard/adapter-codex';
import type { AgentAdapter, DraftRequest } from '@taskboard/core';
import { CompanionStore, defaultDataDirectory, normalizeUpstream } from './store.ts';
import { SecretStore } from './secret.ts';
import { CompanionError, RemoteTransport, validateNormalizedUpstream } from './remote.ts';
import { LauncherControl } from './launcher-control.ts';

const PORT = 47831;
const allowedOrigins = new Set(
  (
    process.env.TASKBOARD_ALLOWED_ORIGINS ??
    'http://127.0.0.1:4173,http://localhost:4173,http://127.0.0.1:47830,http://localhost:47830,http://127.0.0.1:47831,tauri://localhost,http://tauri.localhost'
  )
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
);
const writeSchema = z
  .object({
    body: z.unknown().optional(),
    version: z.number().int().positive().optional(),
    idempotencyKey: z.uuid().optional(),
  })
  .strict();

export interface CompanionOptions {
  dataDirectory?: string;
  upstream?: string;
  port?: number;
  allowedOrigins?: Set<string>;
  clientKey?: string;
  adapter?: AgentAdapter;
  launcherControl?: LauncherControl;
  embeddedWebRoot?: string;
}
export interface CompanionRuntime {
  app: FastifyInstance;
  port: number;
  clientKey: string;
  embeddedUrl: string;
  stop(): Promise<void>;
}

function localError(error: unknown) {
  if (error instanceof CompanionError)
    return {
      status: error.status,
      body: { error: { code: error.code, message: error.message, details: error.details } },
    };
  return { status: 500, body: { error: { code: 'INTERNAL', message: '伴随服务发生未知错误' } } };
}

function cacheKey(path: string): string {
  return `remote:${path}`;
}
function isWrite(method: string): boolean {
  return !['GET', 'HEAD', 'OPTIONS'].includes(method);
}
function allowOrigin(origin: string | undefined, origins: Set<string>): boolean {
  return !origin || origins.has(origin);
}

export async function createCompanion(options: CompanionOptions = {}): Promise<CompanionRuntime> {
  const control = options.launcherControl ?? LauncherControl.fromEnvironment();
  const embeddedKey = randomBytes(32).toString('base64url');
  const embeddedBase = `/embedded/${embeddedKey}/`;
  const embeddedBoardUrl = (port: number) =>
    `http://127.0.0.1:${port}${embeddedBase}?embedded=1`;
  const embeddedWebRoot = options.embeddedWebRoot ?? join(dirname(process.argv[1] ?? ''), 'web');
  let embeddedPort = options.port ?? PORT;
  const directory = options.dataDirectory ?? defaultDataDirectory();
  const store = new CompanionStore(directory);
  await store.load();
  const secret = new SecretStore(join(directory, 'agent-token.dpapi'));
  const browserSecret = new SecretStore(join(directory, 'browser-session.dpapi'));
  const lockedUpstream = options.upstream ?? process.env.TASKBOARD_UPSTREAM;
  let upstream = validateNormalizedUpstream(
    lockedUpstream ?? store.configuredUpstream() ?? 'http://127.0.0.1:47830',
  );
  if (!store.activeIdentity() || store.activeIdentity()!.upstream !== normalizeUpstream(upstream)) {
    await secret.clear();
    await browserSecret.clear();
    await store.clearActiveData();
  }
  // DPAPI protects persistence; retaining the verified values only in this
  // process avoids a PowerShell DPAPI round trip on every stream-triggered UI
  // refresh. They are cleared with the encrypted copies on revocation.
  let agentToken = await secret.read();
  let browserSession = await browserSecret.read();
  let remote = new RemoteTransport(upstream, async () => agentToken);
  let browserRemote = new RemoteTransport(
    upstream,
    async () => browserSession,
    'cookie',
    'browser',
  );
  // The renderer capability is fresh for each Tauri launch. The CLI has a
  // separate DPAPI key and can never call browser-session routes.
  const clientKey =
    options.clientKey ?? process.env.TASKBOARD_CLIENT_KEY ?? randomBytes(32).toString('base64url');
  const cliKeyStore = new SecretStore(join(directory, 'cli-key.dpapi'));
  const cliKey = (await cliKeyStore.read()) ?? randomBytes(32).toString('base64url');
  if (!(await cliKeyStore.read())) await cliKeyStore.write(cliKey);
  // Only a launcher-owned session can supply an adapter. Environment variables
  // are diagnostics, never proof that an arbitrary Codex process belongs to us.
  let adapter = options.adapter;
  let controlSessionId: string | undefined;
  let retirementError: string | undefined;
  let unsupportedHostReason: string | undefined;
  const currentAdapter = async (): Promise<AgentAdapter | undefined> => {
    if (options.adapter || !control) return adapter;
    if (retirementError) return undefined;
    const session = await control.session().catch(() => undefined);
    if (session?.id === controlSessionId && adapter) return adapter;
    if (adapter) {
      try {
        await adapter.dispose();
      } catch {
        retirementError = 'Codex 页面恢复未确认；受管理会话已撤销';
      }
    }
    adapter = undefined;
    controlSessionId = undefined;
    unsupportedHostReason = undefined;
    if (retirementError) return undefined;
    if (!session) return undefined;
    if (!(SUPPORTED_CODEX_VERSIONS as readonly string[]).includes(session.version)) {
      unsupportedHostReason = `Codex ${session.version} 尚未完成页面验收，仅可隔离启动`;
      return undefined;
    }
    adapter = new CodexDesktopAdapter({
      endpoint: session.endpoint,
      appVersion: session.version,
      codexHome: session.codexHome,
      boardUrl: embeddedBoardUrl(embeddedPort),
      targetBinding: {
        targetId: session.targetId,
        exactPageUrl: session.exactPageUrl,
        pageWebSocketUrl: session.pageWebSocketUrl,
      },
      owner: { verify: () => control.verify(session) },
      ...codexHostMarkers(session.version),
      allowCspBypass: true,
      allowCspReload: true,
      cdpTimeoutMs: 15_000,
      hostReadyTimeoutMs: 120_000,
    });
    controlSessionId = session.id;
    return adapter;
  };
  const origins = new Set(options.allowedOrigins ?? allowedOrigins);
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? 'warn' },
    trustProxy: false,
    bodyLimit: 1_000_000,
  });
  // Every credential-changing action advances this value. Requests and streams
  // pin it before awaiting upstream so an old account can never populate or
  // invalidate the account that signed in while it was in flight.
  let authEpoch = 0;
  let pendingAuthMutations = 0;
  let closing = false;
  let authQueue = Promise.resolve();
  const liveStreams = new Set<() => void>();
  const session = () => ({ epoch: authEpoch, identity: store.activeIdentity()?.key });
  const upstreamState = () => ({
    upstream,
    locked: Boolean(lockedUpstream),
    authenticated: Boolean(agentToken || browserSession || store.activeIdentity()),
  });
  const assertStableAuth = () => {
    if (pendingAuthMutations > 0)
      throw new CompanionError('AUTH_TRANSITION', '认证状态正在变更，请重试请求', 409);
  };
  const isCurrentSession = (value: ReturnType<typeof session>) =>
    value.epoch === authEpoch && value.identity === store.activeIdentity()?.key;
  const withAuthMutation = async <T>(action: () => Promise<T>): Promise<T> => {
    let release!: () => void;
    const previous = authQueue;
    authQueue = new Promise<void>((resolve) => {
      release = resolve;
    });
    pendingAuthMutations += 1;
    await previous;
    try {
      return await action();
    } finally {
      pendingAuthMutations -= 1;
      release();
    }
  };
  const clearLocalAuthState = async () => {
    agentToken = undefined;
    browserSession = undefined;
    // clearActiveData mutates the in-memory identity before its disk write,
    // closing local drafts/cache even if a later persistence operation fails.
    const results = await Promise.allSettled([
      secret.clear(),
      browserSecret.clear(),
      store.clearActiveData(),
    ]);
    if (results.some((result) => result.status === 'rejected'))
      throw new CompanionError('LOCAL_STATE_CLEAR_FAILED', '无法安全清除本地认证状态', 500);
  };
  const setUpstream = async (input: string) => {
    if (lockedUpstream) throw new CompanionError('UPSTREAM_LOCKED', '启动器已锁定服务器地址', 409);
    if (agentToken || browserSession || store.activeIdentity())
      throw new CompanionError('UPSTREAM_IN_USE', '已登录时不能更换服务器地址', 409);
    let next: string;
    try {
      next = validateNormalizedUpstream(input);
    } catch {
      throw new CompanionError('UNSAFE_UPSTREAM', '服务器地址必须是 HTTPS 或本机 HTTP 根地址', 400);
    }
    await store.setUpstream(next);
    upstream = next;
    remote = new RemoteTransport(upstream, async () => agentToken);
    browserRemote = new RemoteTransport(upstream, async () => browserSession, 'cookie', 'browser');
  };
  const revokeLocalSession = async () => {
    const expected = authEpoch;
    await withAuthMutation(async () => {
      if (expected !== authEpoch) return;
      authEpoch += 1;
      liveStreams.forEach((close) => close());
      await clearLocalAuthState();
    });
  };
  app.addHook('onRequest', async (request, reply) => {
    const requestPath = request.url.split('?', 1)[0];
    const embeddedResource =
      requestPath === embeddedBase || requestPath.startsWith(`${embeddedBase}assets/`);
    const origin = request.headers.origin;
    if (!allowOrigin(origin, origins))
      return reply
        .code(403)
        .send({ error: { code: 'ORIGIN_DENIED', message: '不允许此页面访问本机伴随服务' } });
    if (origin) reply.header('access-control-allow-origin', origin).header('vary', 'Origin');
    reply
      .header(
        'access-control-allow-headers',
        'content-type,x-taskboard-companion-key,if-match,idempotency-key',
      )
      .header('access-control-allow-methods', 'GET,POST,PATCH,DELETE,OPTIONS');
    if (request.method === 'OPTIONS') return reply.code(204).send();
    if (embeddedResource && request.method === 'GET') {
      if (closing)
        return reply
          .code(503)
          .send({ error: { code: 'SHUTTING_DOWN', message: '伴随服务正在关闭' } });
      return;
    }
    const supplied = request.headers['x-taskboard-companion-key'];
    const browserSurface =
      request.url.startsWith('/api/v1/') || request.url.startsWith('/v1/browser/');
    const embeddedAction =
      request.url === '/v1/codex/open-draft' || request.url === '/v1/codex/open-thread';
    if (browserSurface && supplied !== clientKey && supplied !== embeddedKey)
      return reply.code(supplied === cliKey ? 403 : 401).send({
        error: {
          code: supplied === cliKey ? 'LOCAL_SURFACE_DENIED' : 'LOCAL_AUTH_REQUIRED',
          message: 'CLI 不能访问浏览器会话代理',
        },
      });
    if (
      !browserSurface &&
      supplied !== clientKey &&
      supplied !== cliKey &&
      !(embeddedAction && supplied === embeddedKey)
    )
      return reply
        .code(401)
        .send({ error: { code: 'LOCAL_AUTH_REQUIRED', message: '本机伴随服务认证失败' } });
    if (closing && request.url.split('?', 1)[0] !== '/internal/shutdown')
      return reply
        .code(503)
        .send({ error: { code: 'SHUTTING_DOWN', message: '伴随服务正在关闭' } });
    if (
      pendingAuthMutations > 0 &&
      ![
        '/health',
        '/internal/shutdown',
        '/v1/login',
        '/v1/logout',
        '/v1/browser/login',
        '/v1/browser/logout',
      ].includes(request.url.split('?', 1)[0])
    )
      return reply
        .code(409)
        .send({ error: { code: 'AUTH_TRANSITION', message: '认证状态正在变更，请重试请求' } });
  });
  app.setErrorHandler((error, _request, reply) => {
    const result = localError(error);
    reply.code(result.status).send(result.body);
  });
  const embeddedHeaders = (reply: import('fastify').FastifyReply) =>
    reply
      .header('cache-control', 'no-store')
      .header('referrer-policy', 'no-referrer')
      .header('x-content-type-options', 'nosniff')
      .header(
        'content-security-policy',
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; frame-src 'none'; base-uri 'none'",
      );
  app.get(embeddedBase, async (_request, reply) => {
    const html = await readFile(join(embeddedWebRoot, 'index.html'), 'utf8');
    return embeddedHeaders(reply)
      .type('text/html; charset=utf-8')
      .send(html.replaceAll('"/assets/', `"${embeddedBase}assets/`));
  });
  app.get(`${embeddedBase}assets/:file`, async (request, reply) => {
    const file = (request.params as { file: string }).file;
    if (!/^[A-Za-z0-9_.-]+\.(?:js|css)$/.test(file)) return reply.code(404).send();
    const data = await readFile(join(embeddedWebRoot, 'assets', file));
    return embeddedHeaders(reply)
      .type(file.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/css; charset=utf-8')
      .send(data);
  });
  app.get('/health', async () => ({
    data: {
      version: 1,
      deviceId: store.snapshot().deviceId,
      online: Boolean(agentToken),
      account: store.activeIdentity()
        ? { userId: store.activeIdentity()!.userId, upstream: store.activeIdentity()!.upstream }
        : null,
    },
  }));
  const assertBrowserUpstreamOrigin = (origin: string | undefined) => {
    if (!origin || !origins.has(origin))
      throw new CompanionError('ORIGIN_DENIED', '不允许此页面访问本机伴随服务', 403);
  };
  app.get('/v1/browser/upstream', async (request) => {
    assertBrowserUpstreamOrigin(request.headers.origin);
    return { data: upstreamState() };
  });
  app.post('/v1/browser/upstream', async (request) => {
    assertBrowserUpstreamOrigin(request.headers.origin);
    const parsed = z
      .object({ upstream: z.string().min(1).max(2048) })
      .strict()
      .safeParse(request.body);
    if (!parsed.success) throw new CompanionError('VALIDATION_ERROR', '服务器地址格式无效', 400);
    const body = parsed.data;
    await withAuthMutation(async () => setUpstream(body.upstream));
    return { data: upstreamState() };
  });
  app.post('/v1/login', async (request) => {
    const body = z
      .object({
        email: z.email(),
        password: z.string().min(12),
        deviceName: z.string().min(1).max(80).default('Codex Taskboard'),
      })
      .strict()
      .parse(request.body);
    return withAuthMutation(async () => {
      authEpoch += 1;
      liveStreams.forEach((close) => close());
      const url = new URL('/api/v1/auth/login', upstream).toString();
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...body, tokenKind: 'agent' }),
        signal: AbortSignal.timeout(12_000),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        data?: { deviceToken?: string; user?: { id?: string } };
        error?: { code?: string; message?: string };
      };
      if (!response.ok || !payload.data?.deviceToken)
        throw new CompanionError(
          payload.error?.code ?? 'LOGIN_FAILED',
          payload.error?.message ?? '登录失败',
          response.status,
        );
      if (!payload.data.user?.id)
        throw new CompanionError(
          'LOGIN_IDENTITY_MISSING',
          '服务器未返回账户标识，无法安全保存本地缓存',
          502,
        );
      const userId = payload.data.user.id;
      const deviceToken = payload.data.deviceToken;
      try {
        if (
          !store.activeIdentity() ||
          store.activeIdentity()!.userId !== userId ||
          store.activeIdentity()!.upstream !== normalizeUpstream(upstream)
        ) {
          await browserSecret.clear();
          browserSession = undefined;
          await store.clearActiveData();
        }
        await secret.write(deviceToken);
        await store.activate(upstream, userId);
        agentToken = deviceToken;
      } catch {
        await clearLocalAuthState().catch(() => undefined);
        throw new CompanionError('LOGIN_STATE_FAILED', '无法安全保存登录状态', 500);
      }
      return { data: { deviceId: store.snapshot().deviceId } };
    });
  });
  app.post('/v1/logout', async () => {
    return withAuthMutation(async () => {
      authEpoch += 1;
      liveStreams.forEach((close) => close());
      const retiringAgentToken = agentToken;
      const retiringBrowserSession = browserSession;
      await Promise.allSettled([
        new RemoteTransport(upstream, async () => retiringAgentToken).request('/auth/logout', {
          method: 'POST',
        }),
        new RemoteTransport(
          upstream,
          async () => retiringBrowserSession,
          'cookie',
          'browser',
        ).request('/auth/logout', { method: 'POST' }),
      ]);
      await clearLocalAuthState();
      return { data: { loggedOut: true } };
    });
  });
  app.post('/v1/browser/login', async (request) => {
    const body = z
      .object({
        email: z.email(),
        password: z.string().min(12),
        deviceName: z.string().min(1).max(80).default('Codex Taskboard Desktop'),
      })
      .strict()
      .parse(request.body);
    return withAuthMutation(async () => {
      authEpoch += 1;
      liveStreams.forEach((close) => close());
      const response = await fetch(new URL('/api/v1/auth/login', upstream), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...body, tokenKind: 'browser' }),
        signal: AbortSignal.timeout(12_000),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        data?: { user?: { id?: string } };
        error?: { code?: string; message?: string };
      };
      const cookies =
        (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ??
        (response.headers.get('set-cookie') ? [response.headers.get('set-cookie')!] : []);
      const session = cookies.find((value) => /^tb_session=/i.test(value))?.split(';', 1)[0];
      if (!response.ok || !payload.data?.user?.id || !session)
        throw new CompanionError(
          payload.error?.code ?? 'BROWSER_LOGIN_FAILED',
          payload.error?.message ?? '桌面浏览器登录失败',
          response.status,
        );
      const user = payload.data.user;
      const userId = user.id!;
      try {
        if (
          !store.activeIdentity() ||
          store.activeIdentity()!.userId !== userId ||
          store.activeIdentity()!.upstream !== normalizeUpstream(upstream)
        ) {
          await secret.clear();
          agentToken = undefined;
          await store.clearActiveData();
        }
        await browserSecret.write(session);
        await store.activate(upstream, userId);
        browserSession = session;
      } catch {
        await clearLocalAuthState().catch(() => undefined);
        throw new CompanionError('LOGIN_STATE_FAILED', '无法安全保存登录状态', 500);
      }
      return { data: { user } };
    });
  });
  app.post('/v1/browser/logout', async () => {
    return withAuthMutation(async () => {
      authEpoch += 1;
      liveStreams.forEach((close) => close());
      const retiringAgentToken = agentToken;
      const retiringBrowserSession = browserSession;
      await Promise.allSettled([
        new RemoteTransport(
          upstream,
          async () => retiringBrowserSession,
          'cookie',
          'browser',
        ).request('/auth/logout', { method: 'POST' }),
        new RemoteTransport(upstream, async () => retiringAgentToken).request('/auth/logout', {
          method: 'POST',
        }),
      ]);
      await clearLocalAuthState();
      return { data: { loggedOut: true } };
    });
  });
  app.post('/v1/mappings', async (request) => {
    const body = z
      .object({ repository: z.string(), path: z.string().min(1).max(32767) })
      .strict()
      .parse(request.body);
    await store.mapRepository(body.repository, body.path);
    return { data: { repository: body.repository } };
  });
  app.get('/v1/mappings/:repository', async (request) => {
    const repository = decodeURIComponent((request.params as { repository: string }).repository);
    return { data: { path: store.localPath(repository) ?? null } };
  });
  app.post('/v1/drafts', async (request) => {
    const body = z.object({ taskId: z.uuid(), body: z.unknown() }).strict().parse(request.body);
    return { data: await store.saveDraft(body.taskId, body.body) };
  });
  app.get('/v1/drafts', async () => ({ data: store.drafts() }));
  app.get('/v1/codex/probe', async () => {
    const current = await currentAdapter();
    return {
      data: retirementError
        ? { embedded: false, projects: false, draft: false, thread: false, reason: retirementError }
        : current
          ? await current.probe()
          : {
              embedded: false,
              projects: false,
              draft: false,
              thread: false,
              reason: unsupportedHostReason ?? '桌面适配器未由启动器启用',
            },
    };
  });
  app.post('/v1/codex/install', async () => {
    const current = await currentAdapter();
    if (retirementError) throw new CompanionError('RESTORATION_UNCONFIRMED', retirementError, 409);
    if (!(current instanceof CodexDesktopAdapter))
      throw new CompanionError('ADAPTER_UNAVAILABLE', unsupportedHostReason ?? '当前设备没有可安装的 Codex 适配器', 409);
    try { await current.install(); }
    catch (error) {
      throw new CompanionError('CODEX_INSTALL_REFUSED',
        error instanceof Error ? error.message : 'Codex 内嵌安装失败', 409);
    }
    return { data: await current.probe() };
  });
  app.post('/v1/codex/open-draft', async (request) => {
    const requestBody = z
      .object({
        taskId: z.uuid(),
        spaceId: z.uuid(),
        repository: z.string().nullable(),
        prompt: z.string().min(1).max(120000),
      })
      .strict()
      .parse(request.body);
    const projectPath = store.localPath(requestBody.repository);
    if (!projectPath)
      return {
        data: {
          opened: false,
          fallback: '请先在此设备映射仓库目录，然后手动在 Codex 项目中粘贴任务草稿。',
        },
      };
    const current = await currentAdapter();
    if (!current)
      return {
        data: { opened: false, fallback: '桌面适配器未启用；请在 Codex 中手动粘贴任务草稿。' },
      };
    try {
      await current.openDraft({ ...requestBody, projectPath } satisfies DraftRequest);
      return { data: { opened: true } };
    } catch (error) {
      return {
        data: {
          opened: false,
          fallback: error instanceof Error && error.message.startsWith('DRAFT_UNCONFIRMED')
            ? '草稿状态未确认，请先检查独立 Codex 窗口，不要重复填入。'
            : '当前 Codex 项目、空白编辑器或页面归属未通过验证；草稿未写入。请手动检查。',
        },
      };
    }
  });
  app.post('/v1/codex/open-thread', async (request) => {
    const body = z
      .object({ threadId: z.string().min(1).max(512) })
      .strict()
      .parse(request.body);
    const current = await currentAdapter();
    if (!current) return { data: { opened: false, fallback: '桌面适配器未启用。' } };
    try {
      await current.openThread(body.threadId);
      return { data: { opened: true } };
    } catch {
      return { data: { opened: false, fallback: '无法验证 Codex 会话路由。' } };
    }
  });
  const proxy = async (request: import('fastify').FastifyRequest) => {
    const suffix = (request.params as { '*': string })['*'];
    const query = request.raw.url?.includes('?')
      ? request.raw.url.slice(request.raw.url.indexOf('?'))
      : '';
    const path = `/${suffix}${query}`;
    const pathOnly = path.split('?', 1)[0];
    if (!(/^\/me$/.test(pathOnly) || /^\/(spaces|tasks|statuses|devices)(?:\/|$)/.test(pathOnly)))
      throw new CompanionError('PATH_DENIED', '不允许的远程 API 路径', 403);
    const browserRequest = request.routeOptions.url === '/api/v1/*';
    const method = request.method;
    const parsed = isWrite(method) && !browserRequest ? writeSchema.parse(request.body) : undefined;
    const rawVersion = request.headers['if-match'];
    const version =
      rawVersion === undefined
        ? undefined
        : Number(Array.isArray(rawVersion) ? rawVersion[0] : rawVersion);
    const rawKey = request.headers['idempotency-key'];
    const idempotencyKey = Array.isArray(rawKey) ? rawKey[0] : rawKey;
    if (browserRequest && rawVersion !== undefined && (!Number.isInteger(version) || version! < 1))
      throw new CompanionError('VALIDATION', 'If-Match 必须为正整数', 400);
    assertStableAuth();
    const requestSession = session();
    if (!requestSession.identity)
      throw new CompanionError('AUTH_REQUIRED', '请先在伴随服务中登录', 401);
    const hadCredential = browserRequest ? Boolean(browserSession) : Boolean(agentToken);
    try {
      const transport = request.routeOptions.url === '/api/v1/*' ? browserRemote : remote;
      const data = await transport.request<unknown>(path, {
        method,
        body: browserRequest ? request.body : parsed?.body,
        version: browserRequest ? version : parsed?.version,
        idempotencyKey: browserRequest ? idempotencyKey : parsed?.idempotencyKey,
      });
      if (!isCurrentSession(requestSession))
        throw new CompanionError('AUTH_SUPERSEDED', '认证状态已变更，请重试请求', 409);
      if (method === 'GET') await store.cachePut(cacheKey(path), data);
      return { data, meta: { source: 'remote' } };
    } catch (error) {
      if (!isCurrentSession(requestSession))
        throw new CompanionError('AUTH_SUPERSEDED', '认证状态已变更，请重试请求', 409);
      if (error instanceof CompanionError && error.code === 'OFFLINE') {
        if (method === 'GET') {
          const cached = store.cacheGet<unknown>(cacheKey(path));
          if (cached !== undefined)
            return { data: cached, meta: { source: 'cache', offline: true } };
        }
        // Only a submitted execution report can wait in the outbox. Claims and task changes are rejected offline.
        if (
          !browserRequest &&
          method === 'POST' &&
          /^\/tasks\/[^/]+\/submit$/.test(path) &&
          parsed?.version &&
          parsed.idempotencyKey
        ) {
          await store.queue({
            path,
            body: parsed.body,
            version: parsed.version,
            idempotencyKey: parsed.idempotencyKey,
          });
          return { data: { queued: true }, meta: { offline: true } };
        }
      }
      // A 403 can be an ordinary permission decision (for example a read-only
      // member). Only an authentication challenge invalidates local secrets.
      if (
        error instanceof CompanionError &&
        error.status === 401 &&
        hadCredential &&
        isCurrentSession(requestSession)
      )
        await revokeLocalSession();
      throw error;
    }
  };
  // `/api/v1` is the UI-facing proxy; `/v1/api` is retained for taskctl.
  // Both still require the local bridge capability and never expose the remote token.
  app.route({ method: ['GET', 'POST', 'PATCH', 'DELETE'], url: '/v1/api/*', handler: proxy });
  app.route({ method: ['GET', 'POST', 'PATCH', 'DELETE'], url: '/api/v1/*', handler: proxy });
  app.get('/api/v1/spaces/:spaceId/events', async (request, reply) => {
    const { spaceId } = z.object({ spaceId: z.uuid() }).parse(request.params);
    assertStableAuth();
    const streamSession = session();
    if (!streamSession.identity)
      throw new CompanionError('AUTH_REQUIRED', '请先在伴随服务中登录', 401);
    const controller = new AbortController();
    let upstreamResponse: Response | undefined;
    let ended = false;
    const close = () => {
      if (ended) return;
      ended = true;
      controller.abort();
      if (!reply.raw.writableEnded) reply.raw.end();
    };
    liveStreams.add(close);
    reply.raw.once('close', close);
    try {
      upstreamResponse = await browserRemote.stream(`/spaces/${spaceId}/events`, controller.signal);
      if (!isCurrentSession(streamSession)) {
        close();
        return;
      }
      reply.hijack();
      for (const [name, value] of Object.entries(reply.getHeaders())) {
        if (value !== undefined) reply.raw.setHeader(name, value);
      }
      reply.raw.writeHead(200, {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache, no-transform',
        connection: 'keep-alive',
        'x-accel-buffering': 'no',
      });
      const reader = upstreamResponse.body!.getReader();
      try {
        while (!ended) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!reply.raw.write(value))
            await new Promise<void>((resolve) => {
              const resume = () => {
                reply.raw.off('close', resume);
                resolve();
              };
              reply.raw.once('drain', resume);
              reply.raw.once('close', resume);
            });
        }
      } finally {
        await reader.cancel().catch(() => undefined);
        close();
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      if (
        error instanceof CompanionError &&
        error.status === 401 &&
        Boolean(browserSession) &&
        isCurrentSession(streamSession)
      )
        await revokeLocalSession();
      throw error;
    } finally {
      reply.raw.off('close', close);
      liveStreams.delete(close);
      if (!upstreamResponse) controller.abort();
    }
  });
  app.addHook('preClose', async () => {
    liveStreams.forEach((close) => close());
  });
  app.post('/v1/outbox/flush', async () => {
    assertStableAuth();
    const active = store.activeIdentity();
    if (!active) throw new CompanionError('AUTH_REQUIRED', '请先登录', 401);
    const items = store.outbox();
    const flushSession = session();
    const flushToken = agentToken;
    for (const item of items) {
      if (!isCurrentSession(flushSession))
        throw new CompanionError('AUTH_SUPERSEDED', '认证状态已变更，已停止发送待发送结果', 409);
      if (item.identity !== active.key)
        throw new CompanionError(
          'OUTBOX_IDENTITY_MISMATCH',
          '待发送结果属于其他账户，已拒绝发送',
          409,
        );
      await new RemoteTransport(upstream, async () => flushToken).request(item.path, {
        method: 'POST',
        body: item.body,
        version: item.version,
        idempotencyKey: item.idempotencyKey,
      });
      if (!isCurrentSession(flushSession))
        throw new CompanionError('AUTH_SUPERSEDED', '认证状态已变更，已停止发送待发送结果', 409);
      await store.removeOutbox(item.id);
    }
    return { data: { flushed: items.length } };
  });
  app.post('/v1/prompt', async (request) => {
    const task = request.body as Task;
    return {
      data: {
        prompt: taskPrompt(task),
        digest: createHash('sha256').update(task.id).digest('hex').slice(0, 12),
      },
    };
  });
  let stopping: Promise<void> | undefined;
  const stop = () =>
    (stopping ??= (async () => {
      closing = true;
      liveStreams.forEach((close) => close());
      try {
        await adapter?.dispose();
      } finally {
        await app.close();
      }
    })());
  app.post('/internal/shutdown', async (request, reply) => {
    if (request.headers['x-taskboard-companion-key'] !== clientKey)
      return reply.code(403).send({
        error: { code: 'LOCAL_SURFACE_DENIED', message: '仅桌面渲染器可以关闭伴随服务' },
      });
    reply.code(202).send({ data: { stopping: true } });
    setImmediate(() => {
      void stop().catch(() => process.stderr.write('Taskboard companion shutdown failed\n'));
    });
  });
  const address = await app.listen({ host: '127.0.0.1', port: options.port ?? PORT });
  const port = Number(new URL(address).port);
  origins.add(`http://127.0.0.1:${port}`);
  embeddedPort = port;
  return {
    app,
    port,
    clientKey,
    embeddedUrl: embeddedBoardUrl(port),
    stop,
  };
}

if (
  process.env.TASKBOARD_RUNTIME_COMPANION === '1' ||
  ['main.ts', 'companion.js'].includes(basename(process.argv[1] ?? ''))
) {
  createCompanion()
    .then((runtime) =>
      process.stdout.write(
        JSON.stringify({ event: 'ready', port: runtime.port, pid: process.pid }) + '\n',
      ),
    )
    .catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.stack : error}\n`);
      process.exitCode = 1;
    });
}
