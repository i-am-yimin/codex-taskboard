import { z } from 'zod';
export const VERSION = '0.1.0';
export const API_VERSION = 1;
export const semantics = ['todo', 'in_progress', 'in_review', 'done', 'cancelled'] as const;
export const roles = ['owner', 'admin', 'editor', 'viewer'] as const;
export type Role = (typeof roles)[number];
export type Semantic = (typeof semantics)[number];
export interface User {
  id: string;
  name: string;
  email: string;
  instanceAdmin?: boolean;
}
export interface Member extends User {
  role: Role;
}
export interface Space {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  version: number;
  archived: boolean;
  role: Role;
}
export interface Status {
  id: string;
  spaceId: string;
  name: string;
  semantic: Semantic;
  position: number;
  color: string;
}
export interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
}
export interface Task {
  id: string;
  spaceId: string;
  number: number;
  title: string;
  description: string;
  statusId: string;
  priority: number;
  assigneeId: string | null;
  labels: string[];
  checklist: ChecklistItem[];
  repository: string | null;
  blocked: boolean;
  blockedReason: string;
  position: number;
  version: number;
  archived: boolean;
  updatedAt: string;
  createdAt: string;
}
export interface Activity {
  id: string;
  taskId: string;
  actorId: string;
  actorName: string;
  kind: string;
  body: string;
  createdAt: string;
}
export interface Execution {
  id: string;
  taskId: string;
  actorId: string;
  deviceId: string;
  threadId: string | null;
  phase: 'running' | 'submitted' | 'released';
  summary: string;
  verification: string;
  createdAt: string;
}
export interface Board {
  space: Space;
  statuses: Status[];
  tasks: Task[];
  members: Member[];
}
export interface TaskDetail {
  task: Task;
  activities: Activity[];
  executions: Execution[];
}
export class BoardError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
    public details?: unknown,
  ) {
    super(message);
  }
}
export function requireRole(
  role: Role | undefined,
  minimum: 'viewer' | 'editor' | 'admin' | 'owner',
) {
  const rank = { viewer: 0, editor: 1, admin: 2, owner: 3 };
  if (!role || rank[role] < rank[minimum])
    throw new BoardError('FORBIDDEN', '没有此操作的空间权限', 403);
}
export function normalizeRepository(input: string | null | undefined): string | null {
  if (!input?.trim()) return null;
  let value = input.trim();
  if (/^[\w.-]+@[\w.-]+:/.test(value))
    value = 'https://' + value.replace(/^[^@]+@/, '').replace(':', '/');
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new BoardError(
      'INVALID_REPOSITORY',
      '请使用 HTTPS 或 SSH 仓库地址，本机路径仅保存在设备映射中',
    );
  }
  if (
    !['https:', 'ssh:'].includes(url.protocol) ||
    !url.hostname ||
    !url.pathname.replace(/\//g, '')
  )
    throw new BoardError('INVALID_REPOSITORY', '仓库地址无效');
  return `https://${url.host.toLowerCase()}${url.pathname.replace(/\.git\/?$/, '').replace(/\/$/, '')}`;
}
export const idSchema = z.uuid();
export const loginSchema = z
  .object({
    email: z
      .email()
      .max(254)
      .transform((v) => v.toLowerCase()),
    password: z.string().min(12).max(256),
    deviceName: z.string().min(1).max(80).default('浏览器'),
  })
  .strict();
export const spaceSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    icon: z.string().min(1).max(8).default('◈'),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .default('#7466e8'),
    description: z.string().max(2000).default(''),
  })
  .strict();
export const statusSchema = z
  .object({
    name: z.string().trim().min(1).max(40),
    semantic: z.enum(semantics),
    position: z.number().finite().min(0).max(1000000),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  })
  .strict();
export const taskSchema = z
  .object({
    title: z.string().trim().min(1).max(240),
    description: z.string().max(100000).default(''),
    statusId: idSchema,
    priority: z.number().int().min(0).max(3).default(2),
    assigneeId: idSchema.nullable().default(null),
    labels: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
    checklist: z
      .array(
        z.object({ id: idSchema, text: z.string().min(1).max(500), checked: z.boolean() }).strict(),
      )
      .max(100)
      .default([]),
    repository: z.string().max(2000).nullable().default(null).transform(normalizeRepository),
    blocked: z.boolean().default(false),
    blockedReason: z.string().max(2000).default(''),
    position: z.number().finite().min(0).max(1e12).default(1000),
    archived: z.boolean().default(false),
  })
  .strict();
export const taskPatchSchema = z
  .object({
    title: z.string().trim().min(1).max(240).optional(),
    description: z.string().max(100000).optional(),
    statusId: idSchema.optional(),
    priority: z.number().int().min(0).max(3).optional(),
    assigneeId: idSchema.nullable().optional(),
    labels: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
    checklist: z
      .array(
        z.object({ id: idSchema, text: z.string().min(1).max(500), checked: z.boolean() }).strict(),
      )
      .max(100)
      .optional(),
    repository: z.string().max(2000).nullable().transform(normalizeRepository).optional(),
    blocked: z.boolean().optional(),
    blockedReason: z.string().max(2000).optional(),
    position: z.number().finite().min(0).max(1e12).optional(),
    archived: z.boolean().optional(),
  })
  .strict();
export interface AdapterCapabilities {
  embedded: boolean;
  projects: boolean;
  draft: boolean;
  thread: boolean;
  reason?: string;
}
export interface LocalProject {
  id: string;
  name: string;
  path: string;
}
export interface DraftRequest {
  taskId: string;
  spaceId: string;
  projectPath: string;
  prompt: string;
}
export interface AgentAdapter {
  id: string;
  probe(): Promise<AdapterCapabilities>;
  listProjects(): Promise<LocalProject[]>;
  openDraft(request: DraftRequest): Promise<void>;
  openThread(threadId: string): Promise<void>;
  dispose(): Promise<void>;
}
export interface TaskTransport {
  request<T>(
    path: string,
    options?: { method?: string; body?: unknown; version?: number; idempotencyKey?: string },
  ): Promise<T>;
}
export function taskPrompt(task: Task): string {
  return `使用 taskboard Skill 处理任务 ${task.id}（空间 ${task.spaceId}）。\n\n${task.title}\n\n${task.description}\n\n先读取最新任务并领取，按用户要求实施和验证，再提交结果至待验收。当前草稿不代表任务已经开始。`;
}
