import { z } from 'zod';

const sessionSchema = z
  .object({
    id: z.string().regex(/^[A-Za-z0-9]{48}$/),
    version: z.string().regex(/^\d+\.\d+\.\d+\.\d+$/),
    pid: z.number().int().positive(),
    createdTicks: z.string().regex(/^\d+$/),
    codexHome: z.string().min(1),
    endpoint: z.string().regex(/^http:\/\/127\.0\.0\.1:\d{1,5}$/),
    targetId: z.string().regex(/^[a-fA-F0-9]{32}$/),
    exactPageUrl: z.literal('app://-/index.html'),
    pageWebSocketUrl: z.string(),
  })
  .strict();

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

  private async query(path: string): Promise<unknown> {
    const response = await fetch(`http://127.0.0.1:${this.port}${path}`, {
      headers: { 'x-taskboard-control-key': this.key },
      signal: AbortSignal.timeout(4_000),
      redirect: 'error',
    });
    if (!response.ok) throw new Error('Codex launcher control is unavailable');
    return response.json();
  }

  async session(): Promise<LauncherSession | undefined> {
    const value = z
      .object({ session: sessionSchema.nullable() })
      .strict()
      .parse(await this.query('/session'));
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

  async verify(expected: LauncherSession): Promise<boolean> {
    try {
      const current = await this.session();
      if (!current || JSON.stringify(current) !== JSON.stringify(expected)) return false;
      return z
        .object({ valid: z.boolean() })
        .strict()
        .parse(await this.query(`/verify/${expected.id}`)).valid;
    } catch {
      return false;
    }
  }
}
