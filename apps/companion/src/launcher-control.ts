import { z } from 'zod';

const sessionSchema = z
  .object({
    id: z.string().regex(/^[A-Za-z0-9]{48}$/),
    version: z.string().regex(/^\d+\.\d+\.\d+\.\d+$/),
    pid: z.number().int().positive(),
    createdTicks: z.string().regex(/^\d+$/),
    codexHome: z.string().min(1).optional(),
    mode: z.enum(['daily', 'managed']).optional(),
    endpoint: z.string().regex(/^http:\/\/127\.0\.0\.1:\d{1,5}$/),
    targetId: z.string().regex(/^[a-fA-F0-9]{32}$/),
    exactPageUrl: z.literal('app://-/index.html'),
    pageWebSocketUrl: z.string(),
  })
  .strict()
  .refine((session) => session.mode === 'daily' ? session.codexHome === undefined : Boolean(session.codexHome),
    'Daily sessions must omit unverified Codex home; managed sessions require their private directory');

export type LauncherSession = z.infer<typeof sessionSchema>;

export class LauncherControl {
  constructor(
    private readonly port: number,
    private readonly key: string,
  ) {
    if (!Number.isInteger(port) || port < 1 || port > 65535 || !/^[A-Za-z0-9]{48}$/.test(key))
      throw new Error('Invalid private launcher control address or capability');
  }

  static fromEnvironment(): LauncherControl | undefined {
    if (process.env.TASKBOARD_RUNTIME_COMPANION !== '1') return undefined;
    const port = Number(process.env.TASKBOARD_CODEX_CONTROL_PORT);
    const key = process.env.TASKBOARD_CODEX_CONTROL_KEY;
    delete process.env.TASKBOARD_CODEX_CONTROL_PORT;
    delete process.env.TASKBOARD_CODEX_CONTROL_KEY;
    if (
      !key ||
      !/^[A-Za-z0-9]{48}$/.test(key) ||
      !Number.isInteger(port) ||
      port < 1 ||
      port > 65535
    )
      return undefined;
    return new LauncherControl(port, key);
  }

  private async query(path: string, timeoutMs = 4_000): Promise<unknown> {
    const response = await fetch(`http://127.0.0.1:${this.port}${path}`, {
      headers: { 'x-taskboard-control-key': this.key },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'error',
    });
    if (!response.ok) throw new Error('Codex launcher control is unavailable');
    return response.json();
  }

  async session(budgetMs = 4_000): Promise<LauncherSession | undefined> {
    const deadline = Date.now() + Math.min(4_000, budgetMs);
    for (let attempt = 0; attempt < 2; attempt++) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) return undefined;
      const session = await this.readSession(remaining);
      if (session) return session;
      // The native launcher can fail one bounded transport observation while
      // still holding the same live process. Recheck once within the original
      // budget; only a fresh complete native description can authorize use.
    }
    return undefined;
  }

  private async readSession(timeoutMs: number): Promise<LauncherSession | undefined> {
    const value = z
      .object({ session: sessionSchema.nullable() })
      .strict()
      .parse(await this.query('/session', timeoutMs));
    const session = value.session;
    if (!session) return undefined;
    const endpoint = new URL(session.endpoint);
    if (
      Number(endpoint.port) < 1 ||
      Number(endpoint.port) > 65535 ||
      session.pageWebSocketUrl !==
        `ws://127.0.0.1:${endpoint.port}/devtools/page/${session.targetId}`
    )
      throw new Error('Codex launcher target description is inconsistent');
    return session;
  }

  async hasExited(expected: LauncherSession): Promise<boolean> {
    // A failed ownership check also covers live page/port drift. Only the
    // private launcher's held-process exit receipt permits failed cleanup to
    // be retired without restoring the old page.
    try {
      const identity = sessionSchema.parse(expected);
      return z.object({ exited: z.boolean() }).strict().parse(
        await this.query('/exited/' + identity.id + '/' + identity.pid + '/' + identity.createdTicks),
      ).exited;
    } catch {
      return false;
    }
  }

  async verify(expected: LauncherSession): Promise<boolean> {
    try {
      // This was already two four-second requests. A transient negative may
      // be observed again within that same total budget, but every attempt
      // requires a fresh exact identity and a new positive native proof.
      const deadline = Date.now() + 8_000;
      for (let attempt = 0; attempt < 2; attempt++) {
        const remaining = deadline - Date.now();
        if (remaining <= 0) return false;
        const current = await this.session(remaining);
        if (!current || JSON.stringify(current) !== JSON.stringify(expected)) return false;
        const proofBudget = Math.min(4_000, deadline - Date.now());
        if (proofBudget <= 0) return false;
        if (z.object({ valid: z.boolean() }).strict()
          .parse(await this.query(`/verify/${expected.id}`, proofBudget)).valid) return true;
      }
      return false;
    } catch {
      return false;
    }
  }
}
