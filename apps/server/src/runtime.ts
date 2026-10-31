import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

export type RuntimeSecrets = {
  databasePassword: string;
  sessionKey: string;
  setupToken: string;
  encryptionKey?: string;
};

/** Exclusive creation keeps secrets stable across restarts and concurrent initializers. */
export function initializeRuntimeSecrets(directory: string): RuntimeSecrets {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  chmodSync(directory, 0o700);
  const read = (name: string) => {
    const path = join(directory, name);
    try {
      writeFileSync(path, randomBytes(32).toString('hex'), { flag: 'wx', mode: 0o600 });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
    const value = readFileSync(path, 'utf8').trim();
    if (!/^[a-f0-9]{64}$/i.test(value)) throw new Error(`Invalid persisted secret: ${name}`);
    return value;
  };
  return {
    databasePassword: read('postgres-password'),
    sessionKey: read('session-key'),
    setupToken: read('setup-token'),
    encryptionKey: read('encryption-key'),
  };
}

/** The init container creates files; the API and maintenance commands only read them. */
export function loadRuntimeEnvironment(): RuntimeSecrets | undefined {
  const directory = process.env.TASKBOARD_STATE_DIR;
  if (!directory) return;
  const read = (name: string) => readFileSync(join(directory, name), 'utf8').trim();
  const secrets = {
    databasePassword: read('postgres-password'),
    sessionKey: read('session-key'),
    setupToken: read('setup-token'),
    encryptionKey: (() => {
      try {
        return read('encryption-key');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
        throw error;
      }
    })(),
  };
  if (Object.values(secrets).some((value) => value !== undefined && !/^[a-f0-9]{64}$/i.test(value)))
    throw new Error('Invalid runtime secrets; restore the taskboard-state volume');
  process.env.SESSION_KEY ??= secrets.sessionKey;
  if (secrets.encryptionKey) process.env.TASKBOARD_ENCRYPTION_KEY ??= secrets.encryptionKey;
  process.env.DATABASE_URL ??= `postgres://taskboard:${secrets.databasePassword}@db:5432/taskboard`;
  return secrets;
}

export type RuntimeLog = { time: string; level: string; message: string };
const levelNames: Record<number, string> = {
  10: 'trace',
  20: 'debug',
  30: 'info',
  40: 'warn',
  50: 'error',
  60: 'fatal',
};

/** A bounded, redacted view of this process's logs. Docker retains the full rotated output. */
export class RuntimeLogs {
  private entries: RuntimeLog[] = [];
  constructor(
    private secrets: string[] = [],
    private mirror = true,
  ) {}
  private sanitize(value: string): string {
    let result = value.replace(/(postgres(?:ql)?:\/\/[^:\s/]+:)[^@\s]+@/gi, '$1[REDACTED]@');
    for (const secret of this.secrets.filter(Boolean))
      result = result.replaceAll(secret, '[REDACTED]');
    return result;
  }
  write(chunk: string): void {
    const safe = this.sanitize(chunk);
    if (this.mirror) process.stdout.write(safe);
    for (const line of safe.trim().split('\n')) {
      try {
        const entry = JSON.parse(line) as {
          time?: number;
          level?: number;
          msg?: string;
          res?: { statusCode?: number };
          req?: { method?: string; url?: string };
        };
        const context = entry.req ? ` ${entry.req.method ?? ''} ${entry.req.url ?? ''}` : '';
        const status = entry.res?.statusCode ? ` (${entry.res.statusCode})` : '';
        this.entries.push({
          time: new Date(entry.time ?? Date.now()).toISOString(),
          level: levelNames[entry.level ?? 30] ?? 'info',
          message: `${entry.msg ?? ''}${context}${status}`.slice(0, 2000),
        });
      } catch {
        /* Ignore partial or non-JSON output rather than exposing raw payloads. */
      }
    }
    this.entries = this.entries.slice(-1000);
  }
  recent(limit = 200): RuntimeLog[] {
    return this.entries.slice(-limit).map((entry) => ({ ...entry }));
  }
}
