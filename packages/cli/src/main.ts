#!/usr/bin/env node
import { Command } from 'commander';
import { randomUUID } from 'node:crypto';
import { basename, join } from 'node:path';
import { SecretStore } from '@taskboard/companion/secret';
import { defaultDataDirectory } from '@taskboard/companion/store';

export const EXIT_CODES = {
  AUTH_REQUIRED: 20,
  FORBIDDEN: 21,
  NOT_FOUND: 22,
  CONFLICT: 23,
  OFFLINE: 24,
  VALIDATION: 25,
  REMOTE_ERROR: 26,
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
  if (code === 'AUTH_REQUIRED' || code === 'LOCAL_AUTH_REQUIRED') return EXIT_CODES.AUTH_REQUIRED;
  if (code === 'FORBIDDEN') return EXIT_CODES.FORBIDDEN;
  if (code === 'NOT_FOUND') return EXIT_CODES.NOT_FOUND;
  if (code === 'VERSION_CONFLICT' || code === 'CONFLICT') return EXIT_CODES.CONFLICT;
  if (code === 'OFFLINE') return EXIT_CODES.OFFLINE;
  if (code === 'VALIDATION' || code === 'BAD_REQUEST') return EXIT_CODES.VALIDATION;
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
    const key = await this.bridgeKey();
    const response = await this.fetcher(new URL(path, this.base), {
      method,
      headers: { 'content-type': 'application/json', 'x-taskboard-companion-key': key },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => ({}))) as { data?: T } & ApiError;
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
    .requiredOption(
      '--thread <threadId>',
      'Codex 线程 ID，默认 CODEX_THREAD_ID',
      process.env.CODEX_THREAD_ID,
    )
    .requiredOption('--version <version>')
    .action(async (taskId, options) => {
      if (!options.thread) throw new CliError('VALIDATION', '需要 --thread 或 CODEX_THREAD_ID');
      output(
        await client.mutation(
          `/tasks/${taskId}/claim`,
          'POST',
          { threadId: options.thread },
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
    .action(async (taskId, summary, verification, options) =>
      output(
        await client.mutation(
          `/tasks/${taskId}/submit`,
          'POST',
          { summary, verification },
          version(options.version),
          key(),
        ),
      ),
    );
  return program;
}

if (
  process.env.TASKBOARD_RUNTIME_TASKCTL === '1' ||
  ['main.ts', 'taskctl.js'].includes(basename(process.argv[1] ?? ''))
)
  createProgram()
    .parseAsync(process.argv)
    .catch((error) => {
      try {
        fail(error);
      } catch {
        process.exitCode ??= EXIT_CODES.INTERNAL;
      }
    });
