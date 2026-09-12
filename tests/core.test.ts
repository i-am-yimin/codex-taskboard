import { describe, expect, it } from 'vitest';
import {
  normalizeRepository,
  requireRole,
  taskPatchSchema,
  taskSchema,
} from '../packages/core/src/index';
describe('repository identity never leaks credentials or device paths', () => {
  it('strips SSH and HTTPS credentials, query strings and fragments', () => {
    expect(normalizeRepository('git@github.com:acme/project.git')).toBe(
      'https://github.com/acme/project',
    );
    expect(
      normalizeRepository('https://secret:token@github.com/acme/project.git?token=private#x'),
    ).toBe('https://github.com/acme/project');
  });
  it('rejects local and executable URLs', () => {
    for (const value of [
      'I:\\project',
      'file:///tmp/project',
      '/tmp/project',
      'javascript:alert(1)',
      'https://github.com',
    ])
      expect(() => normalizeRepository(value)).toThrow();
  });
});
describe('domain boundaries', () => {
  it('enforces role ordering', () => {
    expect(() => requireRole('viewer', 'editor')).toThrow();
    expect(() => requireRole('admin', 'owner')).toThrow();
    expect(() => requireRole('owner', 'admin')).not.toThrow();
  });
  it('rejects invalid mutation fields and preserves partial updates', () => {
    expect(taskPatchSchema.parse({ title: '更新标题' })).toEqual({ title: '更新标题' });
    expect(taskPatchSchema.safeParse({ spaceId: crypto.randomUUID() }).success).toBe(false);
    expect(taskSchema.safeParse({ title: '  ', statusId: crypto.randomUUID() }).success).toBe(
      false,
    );
  });
});
