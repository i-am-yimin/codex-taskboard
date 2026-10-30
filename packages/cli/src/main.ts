#!/usr/bin/env node
import { Command, CommanderError } from 'commander';
import { randomUUID } from 'node:crypto';
import { basename, join } from 'node:path';
import { SecretStore } from '@taskboard/companion/secret';
import { defaultDataDirectory } from '@taskboard/companion/store';
import { configureRunner } from '@taskboard/companion/runners';
import {
  runnerKindSchema,
  assessServerCompatibility,
  requiresCollaborationContract,
  MINIMUM_COLLABORATION_SERVER,
  LOCAL_RUNNER_SETUP_TIMEOUT_MS,
  type Task,
} from '@taskboard/core';

export const EXIT_CODES = {
  AUTH_REQUIRED: 20,
  FORBIDDEN: 21,
  NOT_FOUND: 22,
  CONFLICT: 23,
  OFFLINE: 24,
  VALIDATION: 25,
  REMOTE_ERROR: 26,
  RUN_FAILED: 27,
  INTERNAL: 70,
} as const;
export type ExitCode = (typeof EXIT_CODES)[keyof typeof EXIT_CODES];
type ApiError = { error?: { code?: string; message?: string; details?: unknown } };

export interface CliClientOptions {
  endpoint?: string;
  key?: string;
  fetcher?: typeof fetch;
  dataDirectory?: string;
}
export class CliError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}
function companionUrl(value: string): URL {
  const url = new URL(value);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
    throw new CliError('INVALID_COMPANION', 'CLI 只能连接本机伴随服务');
  return url;
}
function exitCode(code: string): ExitCode {
  if (code === 'AUTH_REQUIRED' || code === 'LOCAL_AUTH_REQUIRED' || code === 'UNAUTHENTICATED')
    return EXIT_CODES.AUTH_REQUIRED;
  if (
    code === 'FORBIDDEN' ||
    code === 'CLAIM_OWNER_REQUIRED' ||
    code === 'AGENT_SCOPE_FORBIDDEN' ||
    code === 'LOCAL_SURFACE_DENIED'
  )
    return EXIT_CODES.FORBIDDEN;
  if (code === 'NOT_FOUND') return EXIT_CODES.NOT_FOUND;
  if (
    code === 'VERSION_CONFLICT' ||
    code === 'CONFLICT' ||
    code === 'CLAIM_CONFLICT' ||
    code === 'RUN_STATE_UNCONFIRMED' ||
    code === 'REQUIREMENTS_CHANGED'
  )
    return EXIT_CODES.CONFLICT;
  if (code === 'OFFLINE') return EXIT_CODES.OFFLINE;
  if (code === 'VALIDATION' || code === 'BAD_REQUEST' || code === 'VALIDATION_ERROR')
    return EXIT_CODES.VALIDATION;
  if (code === 'RUN_FAILED' || code === 'RUNNER_UNAVAILABLE' || code === 'RUNNER_UNSUPPORTED')
    return EXIT_CODES.RUN_FAILED;
  return EXIT_CODES.REMOTE_ERROR;
}

export class CompanionClient {
  private readonly base: URL;
  private readonly key?: string;
  private readonly fetcher: typeof fetch;
  private readonly dataDirectory: string;
  constructor(options: CliClientOptions = {}) {
    this.base = companionUrl(
      options.endpoint ?? process.env.TASKBOARD_COMPANION_URL ?? 'http://127.0.0.1:47831',
    );
    this.key = options.key ?? process.env.TASKBOARD_COMPANION_KEY;
    this.fetcher = options.fetcher ?? fetch;
    this.dataDirectory = options.dataDirectory ?? defaultDataDirectory();
  }
  private async bridgeKey(): Promise<string> {
    const key =
      this.key ?? (await new SecretStore(join(this.dataDirectory, 'cli-key.dpapi')).read());
    if (!key) throw new CliError('AUTH_REQUIRED', '本机伴随服务未配对；请先启动 Codex Taskboard');
    return key;
  }
  async request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    if (
      (path.startsWith('/v1/api/') &&
        requiresCollaborationContract(path.slice('/v1/api'.length), method)) ||
      path === '/v1/runners/start' ||
      /^\/v1\/runners\/[^/]+\/[^/]+\/sync$/.test(path)
    ) {
      let health: unknown;
      try {
        health = await this.request<unknown>('/v1/api/health');
      } catch (error) {
        if (error instanceof CliError && error.code === 'NOT_FOUND') health = {};
        else throw error;
      }
      const compatibility = assessServerCompatibility(health);
      if (compatibility.status !== 'compatible')
        throw new CliError(
          'SERVER_UPGRADE_REQUIRED',
          `服务器需要升级：${compatibility.reason}需要 ${MINIMUM_COLLABORATION_SERVER} 或相同协作协议、0005—0009迁移。未发送本次共享写入或启动请求。`,
          compatibility,
        );
    }
    const key = await this.bridgeKey();
    const response = await this.fetcher(new URL(path, this.base), {
      method,
      headers: { 'content-type': 'application/json', 'x-taskboard-companion-key': key },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(
        (path === '/v1/runners/start' && method === 'POST') ||
          (path === '/v1/runners/probe' && method === 'GET')
          ? LOCAL_RUNNER_SETUP_TIMEOUT_MS
          : 12000,
      ),
    }).catch(() => {
      throw new CliError('OFFLINE', '本机伴随服务不可用，请先查询原操作状态后重试');
    });
    const payload = (await response.json().catch(() => ({}))) as {
      data?: T;
      meta?: { source?: string; offline?: boolean };
    } & ApiError;
    if (path === '/v1/api/health' && payload.meta?.offline === true)
      throw new CliError('OFFLINE', '服务器当前离线；缓存能力不能授权共享写入');
    if (!response.ok)
      throw new CliError(
        payload.error?.code ?? 'REMOTE_ERROR',
        payload.error?.message ?? `请求失败 (${response.status})`,
        payload.error?.details,
      );
    return payload.data as T;
  }
  get<T>(path: string) {
    return this.request<T>(`/v1/api${path}`);
  }
  mutation<T>(
    path: string,
    method: 'POST' | 'PATCH',
    body: unknown,
    version?: number,
    idempotencyKey: string = randomUUID(),
  ) {
    return this.request<T>(`/v1/api${path}`, method, { body, version, idempotencyKey });
  }
}

function output(value: unknown): void {
  process.stdout.write(`${JSON.stringify({ ok: true, data: value })}\n`);
}
function fail(error: unknown): never {
  const value =
    error instanceof CliError
      ? error
      : error instanceof CommanderError
        ? new CliError('VALIDATION', error.message)
        : new CliError('INTERNAL', error instanceof Error ? error.message : '未知错误');
  process.stderr.write(
    `${JSON.stringify({ ok: false, error: { code: value.code, message: value.message, details: value.details } })}\n`,
  );
  process.exitCode = exitCode(value.code);
  throw value;
}
function json(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    throw new CliError('VALIDATION', '参数必须是有效 JSON');
  }
}
function version(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1)
    throw new CliError('VALIDATION', '--version 必须为正整数');
  return parsed;
}

export function createProgram(client = new CompanionClient()): Command {
  const program = new Command()
    .exitOverride()
    .configureOutput({ writeErr: () => undefined })
    .name('taskctl')
    .description('Codex Taskboard 的本机任务 CLI')
    .option('--json', '输出 JSON（默认即 JSON，供 Agent 稳定解析）')
    .option('--idempotency-key <uuid>', '重试同一写操作时复用此 UUID');
  program
    .command('login <email>')
    .option('--device-name <name>', 'Agent 设备名称', 'Taskboard Agent')
    .action(async (email, options) => {
      if (process.stdin.isTTY)
        throw new CliError('VALIDATION', '请通过标准输入提供密码，勿将密码放入命令参数');
      const chunks: Buffer[] = [];
      for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
      const password = Buffer.concat(chunks)
        .toString('utf8')
        .replace(/[\r\n]+$/, '');
      if (password.length < 12) throw new CliError('VALIDATION', '密码至少 12 个字符');
      output(
        await client.request('/v1/login', 'POST', {
          email,
          password,
          deviceName: options.deviceName,
        }),
      );
    });
  program.command('logout').action(async () => output(await client.request('/v1/logout', 'POST')));
  const key = (): string => {
    const value = program.opts<{ idempotencyKey?: string }>().idempotencyKey;
    if (
      value &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    )
      throw new CliError('VALIDATION', '--idempotency-key 必须为 UUID');
    return value ?? randomUUID();
  };
  program
    .command('list <spaceId>')
    .option('--query <query>')
    .option('--status <statusId>')
    .option('--priority <priority>')
    .option('--assignee <assigneeId>')
    .action(async (spaceId, options) =>
      output(
        await client.get(
          `/spaces/${spaceId}/tasks?${new URLSearchParams(
            Object.entries(options)
              .filter(([, v]) => v !== undefined)
              .map(([key, value]) => [
                key === 'status' ? 'statusId' : key === 'assignee' ? 'assigneeId' : key,
                String(value),
              ]),
          )}`,
        ),
      ),
    );
  program
    .command('get <taskId>')
    .action(async (taskId) => output(await client.get(`/tasks/${taskId}/detail`)));
  program
    .command('create <spaceId> <payloadJson>')
    .action(async (spaceId, payload) =>
      output(
        await client.mutation(`/spaces/${spaceId}/tasks`, 'POST', json(payload), undefined, key()),
      ),
    );
  program
    .command('update <taskId> <payloadJson>')
    .requiredOption('--version <version>')
    .action(async (taskId, payload, options) =>
      output(
        await client.mutation(
          `/tasks/${taskId}`,
          'PATCH',
          json(payload),
          version(options.version),
          key(),
        ),
      ),
    );
  program
    .command('claim <taskId>')
    .option(
      '--thread <threadId>',
      'Codex 线程 ID，默认 CODEX_THREAD_ID',
      process.env.CODEX_THREAD_ID,
    )
    .option('--agent-kind <kind>', '执行Agent类型', 'manual')
    .requiredOption('--version <version>')
    .action(async (taskId, options) => {
      output(
        await client.mutation(
          `/tasks/${taskId}/claim`,
          'POST',
          { ...(options.thread ? { threadId: options.thread } : {}), agentKind: options.agentKind },
          version(options.version),
          key(),
        ),
      );
    });
  program
    .command('comment <taskId> <body>')
    .action(async (taskId, body) =>
      output(
        await client.mutation(`/tasks/${taskId}/comments`, 'POST', { body }, undefined, key()),
      ),
    );
  program
    .command('link <taskId>')
    .requiredOption(
      '--thread <threadId>',
      'Codex 线程 ID，默认 CODEX_THREAD_ID',
      process.env.CODEX_THREAD_ID,
    )
    .action(async (taskId, options) => {
      if (!options.thread) throw new CliError('VALIDATION', '需要 --thread 或 CODEX_THREAD_ID');
      output(
        await client.mutation(
          `/tasks/${taskId}/executions`,
          'POST',
          { threadId: options.thread },
          undefined,
          key(),
        ),
      );
    });
  program
    .command('release <taskId> <reason>')
    .requiredOption('--version <version>')
    .action(async (taskId, reason, options) =>
      output(
        await client.mutation(
          `/tasks/${taskId}/release`,
          'POST',
          { reason },
          version(options.version),
          key(),
        ),
      ),
    );
  program
    .command('submit <taskId> <summary> <verification>')
    .requiredOption('--version <version>')
    .option('--requirements-version <version>', '提交所依据的需求版本（默认先读取快照）')
    .option('--handoff <text>', '交接摘要', '')
    .option('--blockers <text>', '阻塞', '')
    .option('--next-step <text>', '下一步', '')
    .option('--limitations <text>', '验证限制', '')
    .action(async (taskId, summary, verification, options) => {
      const requirementsVersion = options.requirementsVersion
        ? version(options.requirementsVersion)
        : (await client.get<{ task: Task }>(`/tasks/${taskId}/detail`)).task.requirementsVersion;
      output(
        await client.mutation(
          `/tasks/${taskId}/submit`,
          'POST',
          {
            summary,
            verification,
            requirementsVersion,
            handoffSummary: options.handoff,
            blockers: options.blockers,
            nextStep: options.nextStep,
            limitations: options.limitations,
          },
          version(options.version),
          key(),
        ),
      );
    });
  for (const [command, path] of [
    ['progress', 'progress'],
    ['propose', 'proposals'],
    ['artifact', 'artifacts'],
  ] as const) {
    program
      .command(`${command} <taskId> <payloadJson>`)
      .requiredOption('--version <version>')
      .action(async (taskId, payload, options) =>
        output(
          await client.mutation(
            `/tasks/${taskId}/${path}`,
            'POST',
            json(payload),
            version(options.version),
            key(),
          ),
        ),
      );
  }
  const run = program.command('run').description('本机真实CLI运行；领取、提交与人类验收独立');
  run
    .command('configure <runner> <executable> <home>')
    .description('仅本机设置：原生程序与专用登录目录')
    .option('--api-key-stdin', 'Claude API密钥从标准输入保存到本机加密存储')
    .option('--auth-mode <mode>', 'Claude认证：cli-login或api-key', 'cli-login')
    .option('--test-commands <json>', 'Claude开发模式允许的测试命令JSON白名单', '[]')
    .action(async (runner, executable, home, options) => {
      const parsed = runnerKindSchema.safeParse(runner);
      if (!parsed.success) throw new CliError('VALIDATION', 'runner必须为codex-cli或claude-code');
      if (!['cli-login', 'api-key'].includes(options.authMode))
        throw new CliError('VALIDATION', '无效认证模式');
      if (options.apiKeyStdin && options.authMode !== 'api-key')
        throw new CliError('VALIDATION', 'API密钥需明确 --auth-mode api-key');
      const commands = json(options.testCommands);
      if (!Array.isArray(commands) || commands.some((value) => typeof value !== 'string'))
        throw new CliError('VALIDATION', '测试命令必须是字符串JSON数组');
      await configureRunner(
        defaultDataDirectory(),
        parsed.data,
        executable,
        home,
        options.authMode,
        commands,
      );
      if (options.apiKeyStdin) {
        if (runner !== 'claude-code' || process.stdin.isTTY)
          throw new CliError('VALIDATION', '仅Claude支持此方式，请从标准输入提供密钥');
        const chunks: Buffer[] = [];
        for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
        const secret = Buffer.concat(chunks).toString('utf8').trim();
        if (!secret || secret.length > 4096) throw new CliError('VALIDATION', '密钥为空或过长');
        await new SecretStore(join(defaultDataDirectory(), 'claude-runner-key.dpapi')).write(
          secret,
        );
      }
      output({ configured: true, runner });
    });
  run.command('probe').action(async () => output(await client.request('/v1/runners/probe')));
  for (const action of ['start', 'resume'] as const) {
    const command = run
      .command(`${action} <taskId> <claimId> <runner>`)
      .requiredOption('--version <version>')
      .option(
        '--permission-mode <mode>',
        'read-only只读分析 / workspace-write工作区开发',
        'read-only',
      );
    if (action === 'resume')
      command.requiredOption('--from <runId>', '同设备已结束且具有官方会话ID的原运行');
    command.action(async (taskId, claimId, runner, options) => {
      if (!runnerKindSchema.safeParse(runner).success)
        throw new CliError('VALIDATION', '未知runner');
      output(
        await client.request('/v1/runners/start', 'POST', {
          taskId,
          claimId,
          runner,
          permissionMode: options.permissionMode,
          version: version(options.version),
          idempotencyKey: key(),
          ...(options.from ? { resumeFrom: options.from } : {}),
        }),
      );
    });
  }
  run
    .command('status <taskId> <runId>')
    .action(async (taskId, runId) =>
      output(await client.request(`/v1/runners/${taskId}/${runId}`)),
    );
  run
    .command('cancel <taskId> <runId>')
    .action(async (taskId, runId) =>
      output(await client.request(`/v1/runners/${taskId}/${runId}/cancel`, 'POST', {})),
    );
  run
    .command('sync <taskId> <runId>')
    .description('显式按最新任务快照同步本机运行事实，不重新启动')
    .action(async (taskId, runId) =>
      output(await client.request(`/v1/runners/${taskId}/${runId}/sync`, 'POST', {})),
    );
  return program;
}

if (
  process.env.TASKBOARD_RUNTIME_TASKCTL === '1' ||
  ['main.ts', 'taskctl.js', 'taskctl.cjs'].includes(basename(process.argv[1] ?? ''))
)
  createProgram()
    .parseAsync(process.argv)
    .catch((error) => {
      if (error instanceof CommanderError && error.exitCode === 0) {
        process.exitCode = 0;
        return;
      }
      try {
        fail(error);
      } catch {
        process.exitCode ??= EXIT_CODES.INTERNAL;
      }
    });
