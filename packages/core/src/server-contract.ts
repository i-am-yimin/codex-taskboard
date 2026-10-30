import { z } from 'zod';

/** An advertised protocol is not a replacement for authentication or task authorization. */
export const COLLABORATION_PROTOCOL = 1;
export const MINIMUM_COLLABORATION_SERVER = '0.1.4-preview.1';
export const COLLABORATION_MIGRATIONS = [
  '0005_collaborative_workflows',
  '0006_workflow_services',
  '0007_run_recovery',
  '0008_run_permissions',
  '0009_active_workflow_intervals',
] as const;
export const serverHealthSchema = z
  .object({
    status: z.literal('ok'),
    database: z.literal('ok'),
    serverVersion: z.string().min(1).max(80).optional(),
    apiVersion: z.number().int().positive().optional(),
    capabilities: z
      .object({ collaborativeWorkflows: z.number().int().nonnegative().optional() })
      .passthrough()
      .optional(),
    migrationRequired: z.boolean().optional(),
  })
  .passthrough();
export interface ServerCompatibility {
  status: 'compatible' | 'upgrade_required';
  serverVersion: string | null;
  reason: string;
}
export function assessServerCompatibility(value: unknown): ServerCompatibility {
  const parsed = serverHealthSchema.safeParse(value);
  const serverVersion = parsed.success ? (parsed.data.serverVersion ?? null) : null;
  if (
    parsed.success &&
    parsed.data.apiVersion === 1 &&
    parsed.data.capabilities?.collaborativeWorkflows === COLLABORATION_PROTOCOL &&
    parsed.data.migrationRequired === false
  )
    return { status: 'compatible', serverVersion, reason: '' };
  const reason =
    parsed.success && parsed.data.migrationRequired
      ? '服务器的协作数据库迁移尚未齐全。'
      : '服务器尚未声明本客户端所需的协作协议能力。';
  return { status: 'upgrade_required', serverVersion, reason };
}
export function requiresCollaborationContract(path: string, method = 'GET'): boolean {
  const route = path.split('?')[0];
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase()))
    return (
      /^\/(tasks|spaces)(\/|$)/.test(route) ||
      /^\/me\/(tasks|saved-filters|notifications|notification-preferences)(\/|$)/.test(route)
    );
  return (
    /^\/me\/(tasks|saved-filters|notifications|notification-preferences)(\/|$)/.test(route) ||
    /^\/spaces\/[^/]+\/(automation-rules|workflow-metrics)(\/|$)/.test(route) ||
    /^\/tasks\/[^/]+\/runs(\/|$)/.test(route)
  );
}
