import { execFile, spawn, type ChildProcess, type SpawnOptions } from 'node:child_process';
import { promisify } from 'node:util';
import { access, mkdir, readFile, realpath, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  runnerKindSchema,
  normalizeRepository,
  type AgentRunner,
  type RunnerKind,
  type RunnerProbe,
  type TaskRun,
} from '@taskboard/core';
import { CompanionError } from './remote.ts';
import { SecretStore } from './secret.ts';
import {
  inspectOwnedWindowsProcess,
  terminateOwnedWindowsTree,
  type WindowsProcessIdentity,
} from './runner-process.ts';

const configSchema = z
  .object({
    'codex-cli': z
      .object({
        executable: z.string().min(1).refine(isAbsolute),
        home: z.string().min(1).refine(isAbsolute),
      })
      .strict()
      .optional(),
    'claude-code': z
      .object({
        executable: z.string().min(1).refine(isAbsolute),
        home: z.string().min(1).refine(isAbsolute),
        authMode: z.enum(['cli-login', 'api-key']).default('cli-login'),
        testCommands: z
          .array(
            z.enum([
              'pnpm test',
              'pnpm typecheck',
              'pnpm lint',
              'pnpm build',
              'npm test',
              'cargo test',
            ]),
          )
          .max(6)
          .default([]),
      })
      .strict()
      .optional(),
  })
  .strict();
type Configuration = z.infer<typeof configSchema>;
interface OwnedRun {
  run: TaskRun;
  child: ChildProcess;
  closed: Promise<void>;
  cancelRequested: boolean;
  events: Promise<void>;
  termination?: Promise<boolean>;
  identity?: WindowsProcessIdentity;
  identityReady: Promise<void>;
}
type Report = (run: TaskRun) => Promise<void>;
export const RUNNER_SHUTDOWN_TIMEOUT_MS = 35000;
export type SpawnProcess = (
  executable: string,
  args: readonly string[],
  options: SpawnOptions,
) => ChildProcess;
const active = (run: TaskRun) => ['starting', 'running', 'cancel_requested'].includes(run.phase);
const persistedRunSchema = z
  .object({
    id: z.uuid(),
    taskId: z.uuid(),
    claimId: z.uuid(),
    actorId: z.uuid(),
    deviceId: z.uuid(),
    runner: z.enum(['codex-cli', 'claude-code', 'manual']),
    phase: z.enum([
      'starting',
      'running',
      'cancel_requested',
      'cancelled',
      'succeeded',
      'failed',
      'unknown',
    ]),
    externalSessionId: z
      .string()
      .regex(/^[a-zA-Z0-9_-]{1,240}$/)
      .nullable(),
    startedAt: z.iso.datetime().nullable(),
    finishedAt: z.iso.datetime().nullable(),
    lastHeartbeatAt: z.iso.datetime().nullable(),
    failureReason: z.string().max(2000),
    permissionMode: z.enum(['read-only', 'workspace-write']).optional(),
    resolvedBy: z.uuid().nullable().optional(),
    resolvedAt: z.iso.datetime().nullable().optional(),
    resolutionReason: z.string().max(2000).optional(),
    localWorkingDirectory: z.string().max(32767).optional(),
  })
  .strict();

export async function resolveNativeExecutable(runner: RunnerKind, input: string): Promise<string> {
  const absolute = await realpath(input);
  if (runner === 'codex-cli' && /[\\/]@openai[\\/]codex[\\/]bin[\\/]codex\.js$/i.test(absolute)) {
    const packageRoot = dirname(dirname(absolute));
    const metadata = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8')) as {
      name?: string;
    };
    if (metadata.name !== '@openai/codex')
      throw new CompanionError('VALIDATION', '不是官方Codex npm入口', 400);
    const target =
      process.platform === 'win32'
        ? `${process.arch === 'arm64' ? 'aarch64' : 'x86_64'}-pc-windows-msvc`
        : process.platform === 'darwin'
          ? `${process.arch === 'arm64' ? 'aarch64' : 'x86_64'}-apple-darwin`
          : `${process.arch === 'arm64' ? 'aarch64' : 'x86_64'}-unknown-linux-musl`;
    const platformPackage = `codex-${process.platform === 'win32' ? 'win32' : process.platform === 'darwin' ? 'darwin' : 'linux'}-${process.arch}`;
    for (const vendor of [
      join(dirname(packageRoot), platformPackage, 'vendor'),
      join(packageRoot, 'vendor'),
    ]) {
      try {
        return await realpath(
          join(vendor, target, 'bin', process.platform === 'win32' ? 'codex.exe' : 'codex'),
        );
      } catch {
        /* try official fallback layout */
      }
    }
    throw new CompanionError('RUNNER_UNAVAILABLE', '官方npm原生包缺失，请重新安装Codex CLI', 409);
  }
  return absolute;
}

/** Only the local CLI writes this file. No renderer route accepts executable/home/argv. */
export async function configureRunner(
  directory: string,
  runner: RunnerKind,
  executable: string,
  home: string,
  authMode: 'cli-login' | 'api-key' = 'cli-login',
  testCommands: string[] = [],
): Promise<void> {
  runnerKindSchema.parse(runner);
  if (!isAbsolute(executable) || !isAbsolute(home))
    throw new CompanionError('VALIDATION', '运行程序与专用配置目录必须为绝对路径', 400);
  const binary = await resolveNativeExecutable(runner, executable);
  if (!(await stat(binary)).isFile() || /\.(?:cmd|bat|ps1|js)$/i.test(binary))
    throw new CompanionError('VALIDATION', '必须配置原生CLI程序，不能配置shell或npm包装脚本', 400);
  await mkdir(home, { recursive: true });
  let config: Configuration = {};
  try {
    config = configSchema.parse(
      JSON.parse(await readFile(join(directory, 'runners.json'), 'utf8')),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const normalizedHome = await realpath(home);
  if (runner === 'claude-code')
    config[runner] = configSchema.shape['claude-code']
      .unwrap()
      .parse({ executable: binary, home: normalizedHome, authMode, testCommands });
  else config[runner] = { executable: binary, home: normalizedHome };
  await mkdir(directory, { recursive: true });
  const temporary = join(directory, `runners.${randomUUID()}.tmp`);
  await writeFile(temporary, JSON.stringify(config), { mode: 0o600 });
  await rename(temporary, join(directory, 'runners.json'));
}

export class LocalAgentRunner implements AgentRunner {
  private owned = new Map<string, OwnedRun>();
  private records = new Map<string, TaskRun>();
  private starts = new Map<string, Promise<TaskRun>>();
  private writes: Promise<void> = Promise.resolve();
  private reportWrites = new Map<string, Promise<void>>();
  private workingDirectories = new Map<string, string>();
  private runDirectories = new Map<string, string>();
  constructor(
    private readonly directory: string,
    private readonly resolveRepository: (repository: string) => string | undefined,
    private readonly report: Report = async () => undefined,
    private readonly spawnProcess: SpawnProcess = spawn,
    private readonly authorize: (run: TaskRun) => void = () => undefined,
  ) {}
  async load(): Promise<void> {
    try {
      const stored = z
        .array(persistedRunSchema)
        .parse(JSON.parse(await readFile(join(this.directory, 'runs.json'), 'utf8')));
      for (const value of stored) {
        const { localWorkingDirectory, ...run } = value;
        if (active(run)) {
          run.phase = 'unknown';
          run.failureReason = '伴随服务已重启，原进程归属无法重新证明；请人工核查';
        }
        this.records.set(run.id, run);
        if (
          localWorkingDirectory &&
          (active(run) || (run.phase === 'unknown' && !run.resolvedAt))
        ) {
          this.runDirectories.set(run.id, localWorkingDirectory);
          this.workingDirectories.set(localWorkingDirectory, run.id);
        }
      }
      await this.save();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  private save(): Promise<void> {
    const pending = this.writes.then(async () => {
      await mkdir(this.directory, { recursive: true });
      const temporary = join(this.directory, `runs.${randomUUID()}.tmp`);
      await writeFile(
        temporary,
        JSON.stringify(
          [...this.records.values()].map((run) => ({
            ...run,
            ...(this.runDirectories.has(run.id)
              ? { localWorkingDirectory: this.runDirectories.get(run.id) }
              : {}),
          })),
        ),
        { mode: 0o600 },
      );
      await rename(temporary, join(this.directory, 'runs.json'));
    });
    this.writes = pending.catch(() => undefined);
    return pending;
  }
  private async configuration(): Promise<Configuration> {
    try {
      return configSchema.parse(
        JSON.parse(await readFile(join(this.directory, 'runners.json'), 'utf8')),
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
      throw new CompanionError('RUNNER_CONFIG_INVALID', '本机运行器配置无效', 409);
    }
  }
  private async environment(kind: RunnerKind, home: string): Promise<NodeJS.ProcessEnv> {
    // Provider authentication and the parent agent's own configuration never leak into a run.
    const env: NodeJS.ProcessEnv = {};
    const inherited = new Set([
      'path',
      'pathext',
      'systemroot',
      'windir',
      'comspec',
      'temp',
      'tmp',
      'os',
      'number_of_processors',
      'processor_architecture',
      'lang',
      'lc_all',
    ]);
    for (const [key, value] of Object.entries(process.env))
      if (inherited.has(key.toLowerCase())) env[key] = value;
    env.HOME = home;
    env.USERPROFILE = home;
    env.APPDATA = join(home, 'AppData', 'Roaming');
    env.LOCALAPPDATA = join(home, 'AppData', 'Local');
    if (kind === 'codex-cli') env.CODEX_HOME = home;
    else {
      env.CLAUDE_CONFIG_DIR = home;
      env.HOME = home;
      env.USERPROFILE = home;
      env.APPDATA = join(home, 'AppData', 'Roaming');
      env.LOCALAPPDATA = join(home, 'AppData', 'Local');
      if ((await this.configuration())['claude-code']?.authMode === 'api-key') {
        const key = await new SecretStore(join(this.directory, 'claude-runner-key.dpapi')).read();
        if (key) env.ANTHROPIC_API_KEY = key;
      }
    }
    return env;
  }
  async probe(): Promise<RunnerProbe[]> {
    const config = await this.configuration();
    return Promise.all(
      (['codex-cli', 'claude-code'] as const).map(async (runner): Promise<RunnerProbe> => {
        const configured = config[runner];
        const unavailable = (state: RunnerProbe['state'], reason: string): RunnerProbe => ({
          runner,
          state,
          version: null,
          start: { supported: false, reason },
          cancel: { supported: false, reason },
          resume: { supported: false, reason },
        });
        if (!configured)
          return unavailable(
            'unconfigured',
            '请通过本机 taskctl run configure 登记原生CLI和专用配置目录',
          );
        try {
          await access(configured.executable);
        } catch {
          return unavailable('missing_binary', '已配置的CLI程序不存在');
        }
        try {
          const env = await this.environment(runner, configured.home);
          const version = await new Promise<string>((resolve, reject) => {
            const child = this.spawnProcess(configured.executable, ['--version'], {
              shell: false,
              windowsHide: true,
              env,
              stdio: ['ignore', 'pipe', 'ignore'],
            });
            let output = '';
            const timer = setTimeout(() => {
              child.kill();
              reject(new Error('CLI探测超时'));
            }, 8000);
            child.stdout!.on('data', (data: Buffer) => {
              output += data.toString();
              if (output.length > 4096) child.kill();
            });
            child.once('error', (error) => {
              clearTimeout(timer);
              reject(error);
            });
            child.once('close', (code) => {
              clearTimeout(timer);
              if (code === 0 && output.length <= 4096) resolve(output.trim());
              else reject(new Error('CLI版本探测失败'));
            });
          });
          const recognized =
            runner === 'codex-cli'
              ? /^codex-cli\s+0\.164\.0$/.test(version)
              : /^2\.1\.310\s+\(Claude Code\)/.test(version);
          if (!recognized) return unavailable('unsupported', '此CLI版本尚未完成运行协议验证');
          const authenticated = await new Promise<boolean>((resolve) => {
            const args =
              runner === 'codex-cli'
                ? ['login', 'status']
                : [
                    ...(config['claude-code']?.authMode === 'api-key' ? ['--bare'] : []),
                    'auth',
                    'status',
                    '--json',
                  ];
            const child = this.spawnProcess(configured.executable, args, {
              shell: false,
              windowsHide: true,
              env,
              stdio: 'ignore',
            });
            const timer = setTimeout(() => {
              child.kill();
              resolve(false);
            }, 8000);
            child.once('error', () => {
              clearTimeout(timer);
              resolve(false);
            });
            child.once('close', (code) => {
              clearTimeout(timer);
              resolve(code === 0);
            });
          });
          if (!authenticated) {
            const result = unavailable(
              'auth_required',
              runner === 'claude-code' && config['claude-code']?.authMode === 'api-key'
                ? '专用API密钥未配置或认证状态不可用；请用taskctl本机设置'
                : '请在专用CLI配置目录自行登录；未读取日常登录',
            );
            return {
              ...result,
              version,
              cancel: {
                supported: true,
                reason: '可取消本实例仍持有并验证身份的进程，与CLI登录无关',
              },
            };
          }
          return {
            runner,
            state: 'ready',
            version,
            start: {
              supported: true,
              reason:
                runner === 'claude-code'
                  ? config['claude-code']?.authMode === 'api-key'
                    ? 'API-key模式：使用本机加密保存的专用密钥'
                    : 'CLI登录模式：使用专用CLAUDE_CONFIG_DIR的订阅/CLI登录'
                  : '使用专用CODEX_HOME登录；首次未登录会明确失败',
            },
            cancel: { supported: true, reason: '仅取消本实例持有的进程树，等待退出确认' },
            resume: {
              supported: true,
              reason: '仅有官方会话ID的已结束运行可续接；未知进程不可续接',
            },
          };
        } catch (error) {
          return unavailable('error', error instanceof Error ? error.message : 'CLI探测失败');
        }
      }),
    );
  }
  private async update(owned: OwnedRun, phase: TaskRun['phase'], reason = ''): Promise<void> {
    owned.run = {
      ...owned.run,
      phase,
      failureReason: reason,
      lastHeartbeatAt: new Date().toISOString(),
      ...(phase === 'running'
        ? { startedAt: owned.run.startedAt ?? new Date().toISOString() }
        : {}),
      ...(['failed', 'succeeded', 'cancelled'].includes(phase)
        ? { finishedAt: new Date().toISOString() }
        : {}),
    };
    this.records.set(owned.run.id, owned.run);
    await this.save();
    const snapshot = structuredClone(owned.run);
    const reporting = (this.reportWrites.get(snapshot.id) ?? Promise.resolve())
      .then(() => this.report(snapshot))
      .catch(() => undefined);
    this.reportWrites.set(snapshot.id, reporting);
    void reporting.finally(() => {
      if (this.reportWrites.get(snapshot.id) === reporting) this.reportWrites.delete(snapshot.id);
    });
  }
  start(run: TaskRun, prompt: string, repository: string): Promise<TaskRun> {
    const pending = this.starts.get(run.id);
    if (pending) return pending;
    const existing = this.records.get(run.id);
    if (existing) return Promise.resolve(structuredClone(existing));
    const operation = this.launch(run, prompt, repository, run.externalSessionId ?? undefined);
    this.starts.set(run.id, operation);
    return operation.finally(() => this.starts.delete(run.id));
  }
  private async launch(
    run: TaskRun,
    prompt: string,
    repository: string,
    sessionId?: string,
  ): Promise<TaskRun> {
    if (run.runner === 'manual')
      throw new CompanionError('RUNNER_UNSUPPORTED', '手动领取不会创建真实进程', 422);
    const probe = (await this.probe()).find((item) => item.runner === run.runner)!;
    if (!probe.start.supported)
      throw new CompanionError('RUNNER_UNAVAILABLE', probe.start.reason, 409);
    const configured = (await this.configuration())[run.runner]!;
    const mapped = this.resolveRepository(repository);
    if (!mapped || !isAbsolute(mapped))
      throw new CompanionError('REPOSITORY_UNMAPPED', '先配置此仓库的本机映射', 409);
    const cwd = await realpath(mapped);
    if (!(await stat(cwd)).isDirectory())
      throw new CompanionError('REPOSITORY_UNMAPPED', '仓库映射不是目录', 409);
    const origin = await promisify(execFile)(
      'git',
      ['-C', cwd, 'config', '--get', 'remote.origin.url'],
      { windowsHide: true, timeout: 5000 },
    ).catch(() => undefined);
    if (!origin || normalizeRepository(origin.stdout.trim()) !== normalizeRepository(repository))
      throw new CompanionError(
        'REPOSITORY_IDENTITY_MISMATCH',
        '本机映射的Git origin与任务仓库不一致',
        409,
      );
    const args =
      run.runner === 'codex-cli'
        ? [
            'exec',
            ...(sessionId
              ? ['resume', sessionId, '-c', `sandbox_mode="${run.permissionMode ?? 'read-only'}"`]
              : ['--sandbox', run.permissionMode ?? 'read-only']),
            '--json',
            '-',
          ]
        : [
            '-p',
            ...(sessionId ? ['--resume', sessionId] : []),
            '--output-format',
            'stream-json',
            '--verbose',
            '--permission-mode',
            run.permissionMode === 'workspace-write' ? 'acceptEdits' : 'plan',
            ...(run.permissionMode === 'workspace-write'
              ? ((await this.configuration())['claude-code']?.testCommands ?? []).flatMap(
                  (command) => ['--allowedTools', `Bash(${command})`],
                )
              : []),
            ...((await this.configuration())['claude-code']?.authMode === 'api-key'
              ? ['--bare']
              : []),
          ];
    // No auto-approval, bypass, shell, renderer-provided command or arbitrary working directory.
    const env = await this.environment(run.runner, configured.home);
    this.authorize(run);
    const cwdKey = process.platform === 'win32' ? cwd.toLowerCase() : cwd;
    if (this.workingDirectories.has(cwdKey))
      throw new CompanionError(
        'WORKING_DIRECTORY_BUSY',
        '同一工作目录已有运行；请等待退出，或在其他设备映射独立工作树',
        409,
      );
    this.workingDirectories.set(cwdKey, run.id);
    this.runDirectories.set(run.id, cwdKey);
    const child = this.spawnProcess(configured.executable, args, {
      cwd,
      env,
      shell: false,
      windowsHide: true,
      detached: process.platform !== 'win32',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let resolveClosed!: () => void;
    const owned: OwnedRun = {
      run: structuredClone(run),
      child,
      closed: new Promise<void>((resolve) => {
        resolveClosed = resolve;
      }),
      cancelRequested: false,
      events: Promise.resolve(),
      identityReady: Promise.resolve(),
    };
    this.records.set(run.id, owned.run);
    this.owned.set(run.id, owned);
    let completed = false;
    let failed = false;
    let buffer = '';
    let overflow = false;
    let failureCategory = 'RUN_RESULT_MISSING';
    const spawned = new Promise<void>((resolve) => {
      child.once('spawn', resolve);
      child.once('error', () => resolve());
    });
    owned.identityReady = spawned.then(async () => {
      if (process.platform === 'win32' && child.pid && child.exitCode === null)
        owned.identity = await inspectOwnedWindowsProcess(child.pid, configured.executable);
    });
    const enqueue = (action: () => Promise<void>) => {
      owned.events = owned.events.then(action).catch(() => undefined);
    };
    const line = (value: string) => {
      let event: Record<string, unknown>;
      try {
        const decoded: unknown = JSON.parse(value);
        if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) return;
        event = decoded as Record<string, unknown>;
      } catch {
        return;
      }
      const session =
        run.runner === 'codex-cli' && event.type === 'thread.started'
          ? event.thread_id
          : run.runner === 'claude-code' && ['system', 'result'].includes(String(event.type))
            ? event.session_id
            : undefined;
      if (typeof session === 'string' && /^[a-zA-Z0-9_-]{1,240}$/.test(session)) {
        if (owned.run.externalSessionId && owned.run.externalSessionId !== session) {
          failed = true;
          failureCategory = 'RUN_SESSION_MISMATCH';
        } else owned.run.externalSessionId ??= session;
      }
      if (event.type === 'turn.completed' || (event.type === 'result' && event.is_error === false))
        completed = true;
      if (event.type === 'turn.failed' || (event.type === 'result' && event.is_error !== false)) {
        failed = true;
        failureCategory = event.type === 'result' ? 'CLAUDE_RESULT_ERROR' : 'CODEX_TURN_FAILED';
      }
      if (owned.run.phase === 'starting' && !owned.cancelRequested)
        enqueue(() => this.update(owned, 'running'));
    };
    child.stdout!.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
      if (buffer.length > 1_000_000) {
        overflow = true;
        buffer = '';
        return;
      }
      let index: number;
      while ((index = buffer.indexOf('\n')) >= 0) {
        line(buffer.slice(0, index));
        buffer = buffer.slice(index + 1);
      }
    });
    // Drain stderr without persisting CLI output: it may contain user or credential data.
    child.stderr!.on('data', (data: Buffer) => {
      const value = data.toString('utf8');
      if (/auth|api.?key|login|not logged|401/i.test(value)) failureCategory = 'AUTH_REQUIRED';
      else if (/permission|access.denied|sandbox/i.test(value))
        failureCategory = 'CLI_PERMISSION_DENIED';
      else if (/network|connect|timeout|resolve/i.test(value))
        failureCategory = 'CLI_NETWORK_ERROR';
    });
    child.stdin!.on('error', () => undefined);
    child.once('error', () => {
      failed = true;
      failureCategory = 'SPAWN_FAILED';
    });
    child.once('close', (code) => {
      if (buffer) line(buffer);
      enqueue(async () => {
        const terminated = await owned.termination;
        const phase = owned.cancelRequested
          ? terminated && code !== 0
            ? 'cancelled'
            : 'unknown'
          : code === 0 && completed && !failed && !overflow
            ? 'succeeded'
            : 'failed';
        await this.update(
          owned,
          phase,
          phase === 'unknown'
            ? 'CANCEL_NOT_CONFIRMED：根进程已退出，但未取得子树终止成功回执；保持未知并阻塞重启，请人工核查。'
            : phase === 'failed'
              ? `${failureCategory}：CLI退出码 ${code ?? 'signal'}；未满足成功事件与零退出码。进程已结束，提交与验收仍需独立进行。`
              : '',
        );
      });
      void owned.events.finally(() => {
        if (owned.run.phase !== 'unknown') this.workingDirectories.delete(cwdKey);
        this.owned.delete(run.id);
        resolveClosed();
      });
    });
    child.stdin!.end(prompt);
    await this.save();
    await spawned;
    await owned.identityReady;
    if (
      child.pid &&
      child.exitCode === null &&
      owned.run.phase === 'starting' &&
      !owned.cancelRequested
    )
      enqueue(() => this.update(owned, 'running'));
    await owned.events;
    return structuredClone(owned.run);
  }
  async status(runId: string): Promise<TaskRun> {
    const value = this.records.get(runId);
    if (!value) throw new CompanionError('NOT_FOUND', '本机没有此运行记录', 404);
    return structuredClone(value);
  }
  async reconcileServerResolution(server: TaskRun): Promise<void> {
    const local = this.records.get(server.id);
    if (
      local?.phase !== 'unknown' ||
      server.phase !== 'unknown' ||
      !server.resolvedAt ||
      !server.resolvedBy
    )
      return;
    this.records.set(server.id, {
      ...local,
      resolvedAt: server.resolvedAt,
      resolvedBy: server.resolvedBy,
      resolutionReason: server.resolutionReason,
    });
    const cwd = this.runDirectories.get(server.id);
    if (cwd && this.workingDirectories.get(cwd) === server.id) this.workingDirectories.delete(cwd);
    await this.save();
  }
  async cancel(runId: string): Promise<TaskRun> {
    return this.cancelOwned(runId, true);
  }
  private async cancelOwned(runId: string, enforceAuthorization: boolean): Promise<TaskRun> {
    const owned = this.owned.get(runId);
    if (!owned) {
      const run = await this.status(runId);
      if (active(run) || run.phase === 'unknown')
        throw new CompanionError(
          'RUN_STATE_UNCONFIRMED',
          '没有本实例拥有的进程句柄，不能安全取消',
          409,
        );
      return run;
    }
    if (!owned.cancelRequested) {
      if (enforceAuthorization) this.authorize(owned.run);
      owned.cancelRequested = true;
      const cancelling = owned.events.then(async () => {
        await this.update(owned, 'cancel_requested');
        await owned.identityReady;
        if (enforceAuthorization) this.authorize(owned.run);
        if (owned.child.exitCode === null && owned.child.signalCode === null && owned.child.pid) {
          if (process.platform === 'win32') {
            // The PID is obtained solely from our retained live ChildProcess, never from a request or disk.
            owned.termination = owned.identity
              ? terminateOwnedWindowsTree(owned.identity)
              : Promise.resolve(false);
          } else {
            try {
              process.kill(-owned.child.pid, 'SIGTERM');
              owned.termination = Promise.resolve(true);
            } catch {
              owned.termination = Promise.resolve(false);
            }
          }
        }
      });
      owned.events = cancelling.catch(() => undefined);
    }
    await Promise.race([
      owned.closed,
      new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 5000);
        timer.unref();
      }),
    ]);
    return this.status(runId);
  }
  async resume(run: TaskRun, prompt: string, repository: string): Promise<TaskRun> {
    const original = [...this.records.values()].find(
      (value) =>
        value.id !== run.id &&
        value.taskId === run.taskId &&
        value.runner === run.runner &&
        value.externalSessionId === run.externalSessionId &&
        ['succeeded', 'failed', 'cancelled'].includes(value.phase),
    );
    if (!run.externalSessionId || !original)
      throw new CompanionError(
        'RUNNER_UNSUPPORTED',
        '仅可通过同设备已确认结束的官方会话ID恢复；请带交接创建新运行',
        409,
      );
    return this.start(run, prompt, repository);
  }
  async shutdown(): Promise<void> {
    const owned = [...this.owned.values()];
    for (const item of owned) void this.cancelOwned(item.run.id, false).catch(() => undefined);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        Promise.all(owned.map((item) => item.closed)),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(
            () =>
              reject(
                new CompanionError(
                  'RUN_STATE_UNCONFIRMED',
                  '关闭预算内无法确认本实例运行结束；保留未知运行供人工核查',
                  409,
                ),
              ),
            RUNNER_SHUTDOWN_TIMEOUT_MS,
          );
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
}
