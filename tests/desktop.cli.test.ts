import { describe, expect, it, vi } from 'vitest';
import { CompanionClient, CliError, createProgram, EXIT_CODES } from '../packages/cli/src/main.ts';

describe('taskctl local transport', () => {
  it('does not use a remote credential and sends only the local bridge key', async () => {
    let headers: Headers | undefined;
    const fetcher = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      headers = new Headers(init?.headers);
      return new Response(JSON.stringify({ data: { id: 'task-1' } }), {
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch;
    const client = new CompanionClient({ key: 'bridge-only', fetcher });
    await expect(client.get('/tasks/task-1')).resolves.toEqual({ id: 'task-1' });
    expect(headers?.get('x-taskboard-companion-key')).toBe('bridge-only');
    expect(headers?.get('authorization')).toBeNull();
  });
  it('has stable conflict error codes', async () => {
    const fetcher = (async () =>
      new Response(
        JSON.stringify({ error: { code: 'VERSION_CONFLICT', message: 'new version' } }),
        { status: 409, headers: { 'content-type': 'application/json' } },
      )) as typeof fetch;
    const client = new CompanionClient({ key: 'bridge-only', fetcher });
    await expect(client.get('/tasks/task-1')).rejects.toMatchObject({
      code: 'VERSION_CONFLICT',
    } satisfies Partial<CliError>);
    expect(EXIT_CODES.CONFLICT).toBe(23);
  });
  it('keeps list filters in the companion proxy request', async () => {
    let path = '';
    const client = {
      get: async (value: string) => {
        path = value;
        return [];
      },
      mutation: async () => ({}),
    } as unknown as CompanionClient;
    const program = createProgram(client);
    const output = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
      await program.parseAsync([
        'node',
        'taskctl',
        'list',
        '00000000-0000-4000-8000-000000000001',
        '--query',
        'ship',
        '--priority',
        '2',
      ]);
    } finally {
      output.mockRestore();
    }
    expect(path).toContain('query=ship');
    expect(path).toContain('priority=2');
  });
});
