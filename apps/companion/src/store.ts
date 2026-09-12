import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import { normalizeRepository } from '@taskboard/core';

export interface Draft {
  id: string;
  taskId: string;
  body: unknown;
  createdAt: string;
}
export interface OutboxItem {
  id: string;
  identity: string;
  path: string;
  body: unknown;
  version?: number;
  idempotencyKey: string;
  createdAt: string;
}
interface AccountData {
  cache: Record<string, unknown>;
  drafts: Draft[];
  outbox: OutboxItem[];
}
interface AccountIdentity {
  upstream: string;
  userId: string;
  key: string;
}
export interface CompanionState {
  deviceId: string;
  upstream?: string;
  mappings: Record<string, string>;
  active?: AccountIdentity;
  accounts: Record<string, AccountData>;
}

export function defaultDataDirectory(): string {
  return process.env.TASKBOARD_DATA_DIR ?? join(process.env.APPDATA ?? homedir(), 'CodexTaskboard');
}
export function normalizeUpstream(input: string): string {
  const url = new URL(input);
  url.hash = '';
  url.search = '';
  url.pathname = url.pathname.replace(/\/$/, '');
  return url.toString();
}
function identity(upstream: string, userId: string): AccountIdentity {
  const normalized = normalizeUpstream(upstream);
  return {
    upstream: normalized,
    userId,
    key: createHash('sha256').update(`${normalized}\0${userId}`).digest('base64url'),
  };
}
function emptyAccount(): AccountData {
  return { cache: {}, drafts: [], outbox: [] };
}

export class CompanionStore {
  private readonly path: string;
  private writes: Promise<void> = Promise.resolve();
  private state: CompanionState = { deviceId: randomUUID(), mappings: {}, accounts: {} };
  constructor(directory = defaultDataDirectory()) {
    this.path = join(directory, 'state.json');
  }
  async load(): Promise<void> {
    try {
      const stored = JSON.parse(await readFile(this.path, 'utf8')) as Partial<CompanionState>;
      // Old unpartitioned cache may contain another account’s data. Never migrate it.
      this.state = {
        deviceId: stored.deviceId ?? this.state.deviceId,
        ...(stored.upstream ? { upstream: stored.upstream } : {}),
        mappings: stored.mappings ?? {},
        accounts: stored.accounts ?? {},
        ...(stored.active ? { active: stored.active } : {}),
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      await this.save();
    }
  }
  snapshot(): Readonly<CompanionState> {
    return structuredClone(this.state);
  }
  private account(): AccountData {
    if (!this.state.active) throw new Error('NO_ACTIVE_ACCOUNT');
    return (this.state.accounts[this.state.active.key] ??= emptyAccount());
  }
  activeIdentity(): AccountIdentity | undefined {
    return this.state.active && { ...this.state.active };
  }
  configuredUpstream(): string | undefined {
    return this.state.upstream;
  }
  async setUpstream(upstream: string): Promise<void> {
    const write = this.writes.then(async () => {
      const candidate = { ...this.state, upstream };
      const temporary = `${this.path}.${process.pid}.${randomUUID()}.tmp`;
      await mkdir(dirname(this.path), { recursive: true });
      await writeFile(temporary, JSON.stringify(candidate), { encoding: 'utf8', mode: 0o600 });
      await rename(temporary, this.path);
      this.state.upstream = upstream;
    });
    this.writes = write.catch(() => undefined);
    return write;
  }
  async activate(upstream: string, userId: string): Promise<void> {
    this.state.active = identity(upstream, userId);
    this.account();
    await this.save();
  }
  async clearActiveData(): Promise<void> {
    if (this.state.active) delete this.state.accounts[this.state.active.key];
    this.state.active = undefined;
    await this.save();
  }
  async save(): Promise<void> {
    const write = this.writes.then(async () => {
      await mkdir(dirname(this.path), { recursive: true });
      const temporary = `${this.path}.${process.pid}.${randomUUID()}.tmp`;
      await writeFile(temporary, JSON.stringify(this.state), { encoding: 'utf8', mode: 0o600 });
      await rename(temporary, this.path);
    });
    this.writes = write.catch(() => undefined);
    return write;
  }
  async mapRepository(repository: string, localPath: string): Promise<void> {
    const key = normalizeRepository(repository);
    if (!key) throw new Error('INVALID_REPOSITORY');
    this.state.mappings[key] = localPath;
    await this.save();
  }
  localPath(repository: string | null): string | undefined {
    return repository ? this.state.mappings[repository] : undefined;
  }
  async cachePut(key: string, value: unknown): Promise<void> {
    this.account().cache[key] = { savedAt: new Date().toISOString(), value };
    await this.save();
  }
  cacheGet<T>(key: string): T | undefined {
    return (this.account().cache[key] as { value?: T } | undefined)?.value;
  }
  async clearCache(): Promise<void> {
    this.account().cache = {};
    await this.save();
  }
  async saveDraft(taskId: string, body: unknown): Promise<Draft> {
    const draft = { id: randomUUID(), taskId, body, createdAt: new Date().toISOString() };
    this.account().drafts.push(draft);
    await this.save();
    return draft;
  }
  drafts(): Draft[] {
    return structuredClone(this.account().drafts);
  }
  async queue(item: Omit<OutboxItem, 'id' | 'createdAt' | 'identity'>): Promise<OutboxItem> {
    const active = this.activeIdentity();
    if (!active) throw new Error('NO_ACTIVE_ACCOUNT');
    const value = {
      ...item,
      identity: active.key,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.account().outbox.push(value);
    await this.save();
    return value;
  }
  outbox(): OutboxItem[] {
    return structuredClone(this.account().outbox);
  }
  async removeOutbox(id: string): Promise<void> {
    const account = this.account();
    account.outbox = account.outbox.filter((item) => item.id !== id);
    await this.save();
  }
}
