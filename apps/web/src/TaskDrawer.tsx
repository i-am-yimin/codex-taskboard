import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Dialog from '@radix-ui/react-dialog';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Archive, X, Plus, Command } from 'lucide-react';
import { api, ApiError, openCodexDraft, idempotencyKey } from './api';
import { CollaborationPanel } from './CollaborationPanel';
import AgentRunPanel from './AgentRunPanel';
import { useDrawerPresence } from './motion/useDrawerPresence';
import { RequestFeedback } from './motion/RequestFeedback';
import { collaborationApi } from './collaborationApi';
import { makeDemoDetail } from './demo';
import type { Board, Task, TaskDetail } from './types';

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

type Props = {
  taskId: string;
  userId: string;
  editable: boolean;
  canControlExistingRuns?: boolean;
  board: Board;
  demo: boolean;
  offline: boolean;
  onClose: () => void;
  onOpenTask?: (id: string) => void;
  initialIntent?: 'submit' | 'accept' | 'return' | 'cancel' | 'reopen' | null;
  onRefresh: () => void;
  onNotice: (message: string) => void;
};
type Draft = Pick<
  Task,
  | 'title'
  | 'description'
  | 'statusId'
  | 'priority'
  | 'assigneeId'
  | 'reviewerId'
  | 'acceptanceCriteria'
  | 'dueAt'
  | 'repository'
  | 'labels'
  | 'checklist'
  | 'blocked'
  | 'blockedReason'
>;
const fields = (task: Task): Draft => ({
  title: task.title,
  description: task.description,
  statusId: task.statusId,
  priority: task.priority,
  assigneeId: task.assigneeId,
  reviewerId: task.reviewerId ?? null,
  acceptanceCriteria: task.acceptanceCriteria ?? '',
  dueAt: task.dueAt ?? null,
  repository: task.repository,
  labels: task.labels,
  checklist: task.checklist,
  blocked: task.blocked,
  blockedReason: task.blockedReason,
});
export function TaskDrawer({
  taskId,
  userId,
  editable,
  canControlExistingRuns,
  board,
  demo,
  offline,
  onClose,
  onOpenTask,
  initialIntent,
  onRefresh,
  onNotice,
}: Props) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ['task', userId, taskId],
    networkMode: 'always',
    queryFn: async (): Promise<TaskDetail> => {
      if (demo) return makeDemoDetail(taskId);
      try {
        return await api.task(taskId);
      } catch (error) {
        const cached = board.tasks.find((task) => task.id === taskId);
        if (error instanceof ApiError && error.code === 'OFFLINE' && cached)
          return { task: cached, activities: [], executions: [] };
        throw error;
      }
    },
  });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [baseVersion, setBaseVersion] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [conflicted, setConflicted] = useState(false);
  const [preview, setPreview] = useState(false);
  const [comment, setComment] = useState('');
  const [mentionIds, setMentionIds] = useState<string[]>([]);
  const [submission, setSubmission] = useState(initialIntent === 'submit');
  const [summary, setSummary] = useState('');
  const [verification, setVerification] = useState('');
  const [error, setError] = useState('');
  const [branch, setBranch] = useState('');
  const [prUrl, setPrUrl] = useState('');
  const [commitSha, setCommitSha] = useState('');
  const [resultRequirementsVersion, setResultRequirementsVersion] = useState<number | null>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const { closing, close: handleClose, onAnimationEnd } = useDrawerPresence(onClose, drawerRef);
  const submitAttempt = useRef<{ key: string; version: number; signature: string } | null>(null);
  const [handoffSummary, setHandoffSummary] = useState('');
  const [limitations, setLimitations] = useState('');
  const [blockers, setBlockers] = useState('');
  const [nextStep, setNextStep] = useState('');
  const [command, setCommand] = useState<
    'return' | 'cancel' | 'reopen' | 'block' | 'unblock' | 'release' | 'accept' | null
  >(initialIntent && initialIntent !== 'submit' ? initialIntent : null);
  const [reason, setReason] = useState('');
  const [requestState, setRequestState] = useState<'pending' | 'success' | 'error' | null>(null);
  const commentKey = `tb:comment:${userId}:${taskId}`;
  const key = `tb:draft:${userId}:${taskId}`;
  const resultKey = `tb:result:${userId}:${taskId}`;
  const detail = query.data;
  const draftSpaceId = detail?.task.spaceId;
  const closeCallback = useRef(handleClose);
  closeCallback.current = handleClose;
  useEffect(() => {
    if (detail && resultRequirementsVersion === null)
      setResultRequirementsVersion(detail.task.requirementsVersion ?? 1);
  }, [detail, resultRequirementsVersion]);
  useEffect(() => {
    const trigger = document.activeElement;
    const timer = setTimeout(
      () => drawerRef.current?.querySelector<HTMLElement>('button,textarea,input,select')?.focus(),
      0,
    );
    const keyboard = (event: KeyboardEvent) => {
      if (event.defaultPrevented || document.querySelector('[role=dialog]:not(.drawer)')) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        closeCallback.current();
      }
      if (event.key === 'Tab' && drawerRef.current) {
        const items = Array.from(
          drawerRef.current.querySelectorAll<HTMLElement>(
            'button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href],summary',
          ),
        ).filter((item) => item.getClientRects().length > 0);
        const first = items[0],
          last = items[items.length - 1];
        if (
          event.shiftKey &&
          (document.activeElement === first || !drawerRef.current.contains(document.activeElement))
        ) {
          event.preventDefault();
          last?.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last || !drawerRef.current.contains(document.activeElement))
        ) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', keyboard);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', keyboard);
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, [!!detail]);
  useEffect(() => {
    if (!detail || dirty) return;
    try {
      const cached = JSON.parse(localStorage.getItem(key) ?? 'null');
      if (cached?.draft && Number.isInteger(cached.baseVersion)) {
        setDraft({ ...fields(detail.task), ...cached.draft });
        setBaseVersion(cached.baseVersion);
        setDirty(true);
        setConflicted(cached.baseVersion !== detail.task.version);
        return;
      }
    } catch {
      localStorage.removeItem(key);
    }
    setDraft(fields(detail.task));
    setBaseVersion(detail.task.version);
  }, [detail, dirty, key]);
  useEffect(() => {
    if (draftSpaceId && dirty && draft && baseVersion)
      localStorage.setItem(key, JSON.stringify({ draft, baseVersion, spaceId: draftSpaceId }));
  }, [key, draft, dirty, baseVersion, draftSpaceId]);
  useEffect(() => {
    try {
      const cached = JSON.parse(localStorage.getItem(resultKey) ?? 'null');
      if (cached) {
        setSummary(cached.summary);
        setVerification(cached.verification ?? '');
        if (Number.isInteger(cached.requirementsVersion))
          setResultRequirementsVersion(cached.requirementsVersion);
        setBranch(cached.branch ?? '');
        setPrUrl(cached.prUrl ?? '');
        setCommitSha(cached.commitSha ?? '');
        if (
          cached.attempt &&
          typeof cached.attempt.key === 'string' &&
          Number.isInteger(cached.attempt.version) &&
          typeof cached.attempt.signature === 'string'
        )
          submitAttempt.current = cached.attempt;
        setHandoffSummary(cached.handoffSummary ?? '');
        setLimitations(cached.limitations ?? '');
        setBlockers(cached.blockers ?? '');
        setNextStep(cached.nextStep ?? '');
      }
    } catch {
      localStorage.removeItem(resultKey);
    }
  }, [resultKey]);
  useEffect(() => {
    if (
      draftSpaceId &&
      (summary || verification || handoffSummary || limitations || blockers || nextStep)
    )
      localStorage.setItem(
        resultKey,
        JSON.stringify({
          spaceId: draftSpaceId,
          summary,
          verification,
          handoffSummary,
          limitations,
          blockers,
          nextStep,
          branch,
          prUrl,
          commitSha,
          requirementsVersion: resultRequirementsVersion,
          attempt: submitAttempt.current,
        }),
      );
  }, [
    resultKey,
    summary,
    verification,
    handoffSummary,
    limitations,
    blockers,
    nextStep,
    branch,
    prUrl,
    commitSha,
    resultRequirementsVersion,
    draftSpaceId,
  ]);
  useEffect(() => {
    const cached = localStorage.getItem(commentKey);
    if (!cached) return;
    try {
      const value: unknown = JSON.parse(cached);
      if (value && typeof value === 'object' && 'body' in value && typeof value.body === 'string') {
        setComment(value.body);
        if ('mentionIds' in value && Array.isArray(value.mentionIds))
          setMentionIds(value.mentionIds.filter((id): id is string => typeof id === 'string'));
        return;
      }
    } catch {
      /* Existing comment drafts used plain text. */
    }
    setComment(cached);
  }, [commentKey]);
  useEffect(() => {
    if (draftSpaceId && (comment || mentionIds.length))
      localStorage.setItem(
        commentKey,
        JSON.stringify({ body: comment, mentionIds, spaceId: draftSpaceId }),
      );
  }, [commentKey, comment, mentionIds, draftSpaceId]);
  const refresh = async () => {
    await query.refetch();
    onRefresh();
  };
  async function perform(action: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    setRequestState('pending');
    try {
      await action();
      setRequestState('success');
    } catch (error) {
      setError(error instanceof Error ? error.message : '操作失败');
      setRequestState('error');
    } finally {
      setBusy(false);
    }
  }
  if (query.error)
    return (
      <aside className="drawer">
        <button className="icon-button" title="关闭" onClick={handleClose}>
          <X />
        </button>
        <p className="form-error">
          {query.error instanceof Error ? query.error.message : '无法加载任务'}
        </p>
      </aside>
    );
  if (!detail || !draft)
    return (
      <aside className="drawer">
        <p>正在加载任务…</p>
        <button onClick={handleClose}>关闭</button>
      </aside>
    );
  const task = detail.task;
  const update = <K extends keyof Draft>(name: K, value: Draft[K]) => {
    if (!editable || busy) return;
    setDirty(true);
    setDraft({ ...draft, [name]: value });
  };
  async function save(extra: Partial<Task> = {}) {
    if (!editable || busy || !draft) return;
    await perform(async () => {
      try {
        const candidate: Partial<Task> = {
          title: draft.title,
          description: draft.description,
          priority: draft.priority,
          assigneeId: draft.assigneeId,
          reviewerId: draft.reviewerId,
          acceptanceCriteria: draft.acceptanceCriteria,
          dueAt: draft.dueAt,
          repository: draft.repository,
          labels: draft.labels,
          checklist: draft.checklist,
        };
        const baseline = fields(task);
        const changes: Partial<Task> = Object.fromEntries(
          Object.entries(candidate).filter(
            ([name, value]) =>
              JSON.stringify(value) !== JSON.stringify(baseline[name as keyof Draft]),
          ),
        );
        Object.assign(changes, extra);
        const updated = demo
          ? { ...task, ...changes, version: task.version + 1 }
          : Object.keys(changes).length
            ? await api.patchTask(task.id, changes, baseVersion ?? task.version)
            : task;
        localStorage.removeItem(key);
        setDirty(false);
        setConflicted(false);
        setBaseVersion(updated.version);
        setDraft(fields(updated));
        client.setQueryData<TaskDetail>(['task', userId, taskId], { ...detail!, task: updated });
        client.setQueryData<Board>(['board', userId, board.space.id], (previous) =>
          previous
            ? {
                ...previous,
                tasks: previous.tasks.map((item) => (item.id === updated.id ? updated : item)),
              }
            : previous,
        );
        onNotice('任务已保存');
        if (extra.archived) {
          onClose();
          onRefresh();
        }
      } catch (error) {
        if (error instanceof ApiError && error.code === 'VERSION_CONFLICT') setConflicted(true);
        throw error;
      }
    });
  }
  const semantic = board.statuses.find((status) => status.id === task.statusId)?.semantic;
  const activeClaim = (detail.claims ?? []).find((claim) => !claim.releasedAt);
  const isAdmin = ['admin', 'owner'].includes(board.space.role);
  const isReviewer = task.reviewerId === userId;
  const isResponsible = task.assigneeId === userId;
  const children = detail.children ?? [];
  const requiredChildrenDone = children
    .filter((child) => child.requiredForParent !== false)
    .every(
      (child) => board.statuses.find((status) => status.id === child.statusId)?.semantic === 'done',
    );
  const running = detail.executions.find(
    (execution) => execution.phase === 'running' || execution.phase === 'claimed',
  );
  return (
    <aside
      className="drawer motion-drawer"
      data-state={closing ? 'closed' : 'open'}
      onAnimationEnd={onAnimationEnd}
      ref={drawerRef}
      role="dialog"
      aria-modal="true"
      aria-label="任务详情"
    >
      <header className="drawer-top">
        <span className="task-id">
          TB-{task.number}
          {dirty ? ' · 未保存草稿' : ''}
        </span>
        <div className="exec-actions">
          <button
            className="text-button"
            title="复制任务完整 ID"
            onClick={() =>
              perform(async () => {
                await navigator.clipboard.writeText(task.id);
                onNotice('任务 ID 已复制');
              })
            }
          >
            复制 ID
          </button>
          <button
            className="text-button"
            onClick={() =>
              perform(async () => {
                const url = new URL(location.href);
                url.searchParams.set('space', task.spaceId);
                url.searchParams.set('task', task.id);
                await navigator.clipboard.writeText(url.toString());
                onNotice('任务链接已复制');
              })
            }
          >
            复制链接
          </button>
          <button
            className="text-button"
            onClick={() =>
              perform(async () => {
                await navigator.clipboard.writeText(
                  `任务 TB-${task.number}（${task.id}）\n${task.title}\n\n${task.description}\n\n验收条件：${task.acceptanceCriteria ?? '未记录'}\n需求版本：${task.requirementsVersion ?? 1}\n负责人：${task.assigneeId ?? '未分配'}\n验收人：${task.reviewerId ?? '未分配'}\n\n领取不代表运行。先读取最新任务，按需求实施并提交验证与限制。`,
                );
                onNotice('任务上下文已复制');
              })
            }
          >
            复制上下文
          </button>
          <button
            className="icon-button"
            title="归档任务"
            disabled={!editable || busy || offline}
            onClick={() => save({ archived: true })}
          >
            <Archive size={17} />
          </button>
          <button className="icon-button" title="关闭" onClick={handleClose}>
            <X size={18} />
          </button>
        </div>
      </header>
      <div className="drawer-content">
        <textarea
          className="title-editor"
          aria-label="任务标题"
          value={draft.title}
          disabled={!editable || busy}
          onChange={(event) => update('title', event.target.value)}
        />
        <div className="field-grid">
          <label className="form-label">
            状态
            <select disabled value={task.statusId}>
              {board.statuses.map((status) => (
                <option key={status.id} value={status.id}>
                  {status.name}
                </option>
              ))}
            </select>
          </label>
          <label className="form-label">
            优先级
            <select
              disabled={!editable || busy}
              value={draft.priority}
              onChange={(event) => update('priority', Number(event.target.value))}
            >
              {['无优先级', '紧急', '高', '普通'].map((name, value) => (
                <option key={value} value={value}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="form-label">
            总负责人
            <select
              disabled={!editable || busy}
              value={draft.assigneeId ?? ''}
              onChange={(event) => update('assigneeId', event.target.value || null)}
            >
              <option value="">未分配</option>
              {board.members
                .filter((member) => member.role !== 'viewer')
                .map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="form-label">
            验收人
            <select
              disabled={!editable || busy || (!isResponsible && !isAdmin)}
              value={draft.reviewerId ?? ''}
              onChange={(event) => update('reviewerId', event.target.value || null)}
            >
              <option value="">尚未指定，请补派</option>
              {board.members
                .filter((member) => member.role !== 'viewer')
                .map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="form-label">
            到期时间
            <input
              type="datetime-local"
              disabled={!editable || busy}
              value={
                draft.dueAt
                  ? new Date(
                      new Date(draft.dueAt).getTime() -
                        new Date(draft.dueAt).getTimezoneOffset() * 60000,
                    )
                      .toISOString()
                      .slice(0, 16)
                  : ''
              }
              onChange={(event) =>
                update(
                  'dueAt',
                  event.target.value ? new Date(event.target.value).toISOString() : null,
                )
              }
            />
          </label>
          <label className="form-label">
            仓库
            <input
              disabled={!editable || busy}
              value={draft.repository ?? ''}
              onChange={(event) => update('repository', event.target.value || null)}
              placeholder="https://github.com/org/repo"
            />
          </label>
        </div>
        <section className="detail-section">
          <div className="section-heading">
            <h3>描述</h3>
            <button className="text-button" onClick={() => setPreview(!preview)}>
              {preview ? '继续编辑' : '预览 Markdown'}
            </button>
          </div>
          {preview ? (
            <div className="markdown-preview">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{draft.description}</ReactMarkdown>
            </div>
          ) : (
            <textarea
              className="description-editor"
              aria-label="任务描述"
              disabled={!editable || busy}
              value={draft.description}
              onChange={(event) => update('description', event.target.value)}
            />
          )}
        </section>
        <section className="detail-section">
          <h3>目标与验收条件</h3>
          <textarea
            aria-label="验收条件"
            disabled={!editable || busy}
            value={draft.acceptanceCriteria ?? ''}
            onChange={(event) => update('acceptanceCriteria', event.target.value)}
          />
          <p className="muted">
            需求 v{task.requirementsVersion ?? 1}
            。已确认需求的修改请使用下方需求变更提案，保留前后差异与影响。
          </p>
        </section>
        <section className="detail-section">
          <h3>标签</h3>
          <input
            disabled={!editable || busy}
            aria-label="任务标签"
            value={draft.labels.join(', ')}
            onChange={(event) =>
              update(
                'labels',
                event.target.value
                  .split(',')
                  .map((value) => value.trim())
                  .filter(Boolean),
              )
            }
            placeholder="用逗号分隔"
          />
        </section>
        <section className="detail-section">
          <div className="section-heading">
            <h3>检查清单</h3>
            <button
              className="text-button"
              disabled={!editable || busy}
              onClick={() =>
                update('checklist', [
                  ...draft.checklist,
                  { id: crypto.randomUUID(), text: '新检查项', checked: false },
                ])
              }
            >
              <Plus size={14} />
              添加检查项
            </button>
          </div>
          {draft.checklist.map((item) => (
            <div className="check-item" key={item.id}>
              <input
                type="checkbox"
                aria-label={`完成 ${item.text}`}
                disabled={!editable || busy}
                checked={item.checked}
                onChange={(event) =>
                  update(
                    'checklist',
                    draft.checklist.map((value) =>
                      value.id === item.id ? { ...value, checked: event.target.checked } : value,
                    ),
                  )
                }
              />
              <input
                aria-label="检查项"
                disabled={!editable || busy}
                value={item.text}
                onChange={(event) =>
                  update(
                    'checklist',
                    draft.checklist.map((value) =>
                      value.id === item.id ? { ...value, text: event.target.value } : value,
                    ),
                  )
                }
              />
              <button
                className="icon-button"
                title="删除检查项"
                disabled={!editable || busy}
                onClick={() =>
                  update(
                    'checklist',
                    draft.checklist.filter((value) => value.id !== item.id),
                  )
                }
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </section>
        <section className="detail-section">
          <h3>状态操作</h3>
          <p className="muted">状态变化通过命令提交；领取不表示 Agent 已运行。</p>
          {task.blocked && <p className="workflow-warning">阻塞：{task.blockedReason}</p>}
          <div className="exec-actions">
            <button
              className="button ghost"
              disabled={
                !editable ||
                busy ||
                offline ||
                (!isResponsible && !isAdmin && activeClaim?.actorId !== userId)
              }
              onClick={() => {
                setCommand(task.blocked ? 'unblock' : 'block');
                setReason('');
              }}
            >
              {task.blocked ? '解除阻塞' : '标记阻塞'}
            </button>
            {semantic === 'in_review' && (
              <button
                className="button ghost"
                disabled={!editable || busy || offline || (!isReviewer && !isAdmin)}
                onClick={() => {
                  setCommand('return');
                  setReason('');
                }}
              >
                退回修改
              </button>
            )}
            {semantic !== 'done' && semantic !== 'cancelled' && (
              <button
                className="button ghost"
                disabled={!editable || busy || offline || (!isResponsible && !isAdmin)}
                onClick={() => {
                  setCommand('cancel');
                  setReason('');
                }}
              >
                取消任务
              </button>
            )}
            {(semantic === 'done' || semantic === 'cancelled') && (
              <button
                className="button ghost"
                disabled={
                  !editable || busy || offline || (!isResponsible && !isReviewer && !isAdmin)
                }
                onClick={() => {
                  setCommand('reopen');
                  setReason('');
                }}
              >
                重新打开
              </button>
            )}
          </div>
        </section>
        {conflicted && (
          <div className="conflict-box">
            <b>任务已在别处更新，草稿仍保留。</b>
            <p>先核对最新内容，再决定是否用本地草稿更新。</p>
            <details>
              <summary>查看服务器最新内容</summary>
              <p>{task.title}</p>
              <pre>{task.description}</pre>
            </details>
            <button
              className="text-button"
              onClick={() => {
                setBaseVersion(task.version);
                setConflicted(false);
              }}
            >
              已核对，基于最新版本保留本地编辑
            </button>
            <button
              className="text-button"
              onClick={() => {
                localStorage.removeItem(key);
                setDraft(fields(task));
                setBaseVersion(task.version);
                setDirty(false);
                setConflicted(false);
              }}
            >
              放弃草稿，加载最新内容
            </button>
          </div>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button
          className="button primary"
          disabled={!editable || busy || offline}
          onClick={() => save()}
        >
          保存任务
        </button>
        {offline && <p className="muted">离线草稿保存在这台设备，尚未同步。</p>}
        <CollaborationPanel
          detail={detail}
          board={board}
          userId={userId}
          disabled={!editable || busy || offline}
          offline={offline}
          demo={demo}
          onOpen={(id) => onOpenTask?.(id)}
          run={(action) =>
            perform(async () => {
              await action();
              await refresh();
            })
          }
        />
        <RequestFeedback state={requestState} />
        <section className="detail-section execution">
          <h3>执行与交接</h3>
          {offline && detail.runs === undefined ? (
            <p className="muted">离线任务摘要未包含运行事实，不能据此判断是否正在执行。</p>
          ) : (
            <AgentRunPanel
              task={task}
              claims={detail.claims ?? []}
              runs={detail.runs ?? []}
              canWrite={editable && !offline && !demo}
              canControlExistingRuns={canControlExistingRuns ?? (editable && !offline && !demo)}
              userId={userId}
              onChanged={() => {
                void refresh();
              }}
            />
          )}
          <div className="exec-actions">
            <button
              className="button ghost"
              disabled={
                !editable ||
                offline ||
                busy ||
                !!activeClaim ||
                task.blocked ||
                children.length > 0 ||
                !['todo', 'in_progress'].includes(semantic ?? '')
              }
              onClick={() =>
                perform(async () => {
                  if (demo) return onNotice('演示模式不会领取真实任务');
                  await api.claim(task.id, task.version);
                  await refresh();
                })
              }
            >
              领取任务
            </button>
            <button
              className="button primary"
              disabled={!editable || offline}
              onClick={() =>
                perform(async () => {
                  if (demo) return onNotice('演示模式；桌面项目草稿能力尚未验证');
                  const opened = await openCodexDraft({
                    taskId,
                    spaceId: task.spaceId,
                    repository: task.repository,
                    prompt: `使用 taskboard Skill 处理任务 ${task.id}\n\n${task.title}\n\n${task.description}`,
                  });
                  onNotice(
                    opened.opened
                      ? '已打开未发送的任务草稿'
                      : (opened.fallback ?? '当前 Codex 项目草稿能力尚未验证'),
                  );
                })
              }
            >
              <Command size={15} />在 Codex 中打开
            </button>
          </div>
          {running && (
            <p className="muted">
              执行者：
              {board.members.find((member) => member.id === running.actorId)?.name ??
                running.actorId}{' '}
              · 设备 {running.deviceId.slice(0, 8)} · 业务领取记录，不代表进程正在运行
            </p>
          )}
          {(semantic === 'in_progress' || (children.length > 0 && semantic === 'todo')) && (
            <button
              className="text-button"
              disabled={
                !editable ||
                busy ||
                offline ||
                !task.reviewerId ||
                (children.length > 0 && !requiredChildrenDone)
              }
              onClick={() => setSubmission(true)}
            >
              {children.length > 0 ? '提交集成验收' : '提交结果至待验收'}
            </button>
          )}
          {semantic === 'in_review' && (
            <button
              className="button primary"
              disabled={
                !editable ||
                busy ||
                offline ||
                (!isReviewer && !isAdmin) ||
                !task.reviewerId ||
                !requiredChildrenDone
              }
              onClick={() => {
                setCommand('accept');
                setReason('');
              }}
            >
              验收并完成
            </button>
          )}
          {running && editable && (
            <details>
              <summary>恢复无法访问的执行</summary>
              <p className="muted">同一执行者或空间管理员可释放旧设备的领取。</p>
              <button
                className="text-button"
                disabled={busy || offline}
                onClick={() =>
                  perform(async () => {
                    setCommand('release');
                    setReason('');
                  })
                }
              >
                释放旧设备领取
              </button>
            </details>
          )}
          {detail.executions
            .filter((execution) => execution.phase !== 'running' && execution.phase !== 'claimed')
            .map((execution) => (
              <div className="activity" key={execution.id}>
                <div>
                  <b>{execution.phase === 'submitted' ? '提交验收' : '关联 / 释放'}</b>
                  <p>{execution.summary}</p>
                  <pre>{execution.verification}</pre>
                  {execution.handoffSummary && <p>交接摘要：{execution.handoffSummary}</p>}
                  {execution.limitations && <p>限制：{execution.limitations}</p>}
                  {execution.blockers && <p>阻塞：{execution.blockers}</p>}
                  {execution.nextStep && <p>下一步：{execution.nextStep}</p>}
                  {execution.branch && <p>分支：{execution.branch}</p>}
                  {execution.prUrl &&
                    (isHttpsUrl(execution.prUrl) ? (
                      <a href={execution.prUrl} target="_blank" rel="noreferrer">
                        关联 PR
                      </a>
                    ) : (
                      <p>PR 引用：{execution.prUrl}</p>
                    ))}
                  {execution.threadId && <small>会话引用：{execution.threadId}</small>}
                </div>
              </div>
            ))}
        </section>
        <section className="detail-section">
          <h3>活动与评论</h3>
          {offline && <p className="muted">离线缓存不包含活动、评论和执行记录。</p>}
          {detail.activities.map((activity) => (
            <div className="activity" key={activity.id}>
              <p>
                <b>{activity.actorName}</b> {activity.body}
              </p>
            </div>
          ))}
          <details className="comment-mentions">
            <summary>
              提及空间成员{mentionIds.length ? `（已选 ${mentionIds.length} 人）` : ''}
            </summary>
            <div className="mention-options">
              {board.members
                .filter((member) => member.id !== userId)
                .map((member) => (
                  <label className="check-item" key={member.id}>
                    <input
                      type="checkbox"
                      disabled={!editable || busy}
                      checked={mentionIds.includes(member.id)}
                      onChange={(event) =>
                        setMentionIds((current) =>
                          event.target.checked
                            ? [...current, member.id]
                            : current.filter((id) => id !== member.id),
                        )
                      }
                    />
                    {member.name}
                  </label>
                ))}
              {mentionIds
                .filter((id) => !board.members.some((member) => member.id === id))
                .map((id) => (
                  <label className="check-item" key={id}>
                    <input
                      type="checkbox"
                      checked
                      disabled={!editable || busy}
                      onChange={() =>
                        setMentionIds((current) => current.filter((value) => value !== id))
                      }
                    />
                    成员已离开，取消此提及
                  </label>
                ))}
            </div>
            <p className="muted">
              只有当前有权空间成员会收到提及；选人和评论草稿一并保留，发送失败不会清空。
            </p>
          </details>
          <div className="comment-box">
            <input
              aria-label="评论"
              disabled={!editable || busy}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="写一条评论…"
            />
            <button
              disabled={!editable || !comment.trim() || busy || offline}
              onClick={() =>
                perform(async () => {
                  if (!demo) await api.comment(taskId, comment, mentionIds);
                  localStorage.removeItem(commentKey);
                  setComment('');
                  setMentionIds([]);
                  await refresh();
                })
              }
            >
              发送
            </button>
          </div>
        </section>
      </div>
      <Dialog.Root open={submission} onOpenChange={setSubmission}>
        <Dialog.Portal>
          <Dialog.Overlay className="modal-backdrop" />
          <Dialog.Content className="modal" aria-describedby={undefined}>
            <Dialog.Title>提交验收结果</Dialog.Title>
            <label className="form-label">
              完成说明
              <textarea value={summary} onChange={(event) => setSummary(event.target.value)} />
            </label>
            <label className="form-label">
              验证记录
              <textarea
                value={verification}
                onChange={(event) => setVerification(event.target.value)}
              />
            </label>
            <div className="field-grid">
              <label className="form-label">
                工作分支
                <input value={branch} onChange={(event) => setBranch(event.target.value)} />
              </label>
              <label className="form-label">
                PR 链接
                <input
                  type="url"
                  value={prUrl}
                  onChange={(event) => setPrUrl(event.target.value)}
                />
              </label>
              <label className="form-label">
                提交 SHA
                <input value={commitSha} onChange={(event) => setCommitSha(event.target.value)} />
              </label>
            </div>
            {submitAttempt.current && submitAttempt.current.version !== task.version && (
              <p className="workflow-warning">
                保留的提交基于任务 v{submitAttempt.current.version}，当前为 v{task.version}
                。重试将沿用原操作；如需基于新需求提交，请先核对内容并修改材料，生成新的提交。
              </p>
            )}
            <label className="form-label">
              交接摘要
              <textarea
                value={handoffSummary}
                onChange={(event) => setHandoffSummary(event.target.value)}
              />
            </label>
            <label className="form-label">
              已知限制
              <textarea
                value={limitations}
                onChange={(event) => setLimitations(event.target.value)}
              />
            </label>
            <label className="form-label">
              当前阻塞
              <textarea value={blockers} onChange={(event) => setBlockers(event.target.value)} />
            </label>
            <label className="form-label">
              下一步
              <textarea value={nextStep} onChange={(event) => setNextStep(event.target.value)} />
            </label>
            {error && <p className="form-error">{error}</p>}
            <p className="muted">
              {offline
                ? '结果已保存在本机，尚未同步。联网后重新核对任务版本并提交。'
                : '提交后由指定验收人核验；父任务需独立集成验证。'}
            </p>
            {resultRequirementsVersion !== null &&
              resultRequirementsVersion !== (task.requirementsVersion ?? 1) && (
                <div className="workflow-warning">
                  <p>
                    此结果基于需求 v{resultRequirementsVersion}，当前为 v
                    {task.requirementsVersion ?? 1}。请先核对新版要求与验证范围。
                  </p>
                  <button
                    className="text-button"
                    onClick={() => {
                      setResultRequirementsVersion(task.requirementsVersion ?? 1);
                      submitAttempt.current = null;
                    }}
                  >
                    已重新核对，基于当前需求提交
                  </button>
                </div>
              )}
            <div className="modal-actions">
              <Dialog.Close asChild>
                <button className="button ghost">保留并关闭</button>
              </Dialog.Close>
              <button
                className="button primary"
                disabled={
                  !summary.trim() ||
                  !verification.trim() ||
                  busy ||
                  offline ||
                  (resultRequirementsVersion !== null &&
                    resultRequirementsVersion !== (task.requirementsVersion ?? 1))
                }
                onClick={() =>
                  perform(async () => {
                    const body = {
                      summary,
                      verification,
                      handoffSummary,
                      limitations,
                      blockers,
                      nextStep,
                      branch,
                      prUrl: prUrl || null,
                      commitSha,
                      artifactIds: (detail.artifacts ?? [])
                        .filter((item) => !item.deletedAt)
                        .map((item) => item.id),
                      requirementsVersion:
                        resultRequirementsVersion ?? task.requirementsVersion ?? 1,
                    };
                    const signature = JSON.stringify(body);
                    if (!submitAttempt.current || submitAttempt.current.signature !== signature)
                      submitAttempt.current = {
                        key: idempotencyKey(),
                        version: task.version,
                        signature,
                      };
                    localStorage.setItem(
                      resultKey,
                      JSON.stringify({
                        ...body,
                        spaceId: task.spaceId,
                        attempt: submitAttempt.current,
                      }),
                    );
                    if (!demo)
                      await collaborationApi.command(
                        taskId,
                        'submit',
                        body,
                        submitAttempt.current.version,
                        submitAttempt.current.key,
                      );
                    submitAttempt.current = null;
                    localStorage.removeItem(resultKey);
                    setSummary('');
                    setVerification('');
                    setBranch('');
                    setPrUrl('');
                    setCommitSha('');
                    setHandoffSummary('');
                    setLimitations('');
                    setBlockers('');
                    setNextStep('');
                    setSubmission(false);
                    await refresh();
                  })
                }
              >
                提交验收
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <Dialog.Root
        open={command !== null}
        onOpenChange={(open) => {
          if (!open) setCommand(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="modal-backdrop motion-scrim" />
          <Dialog.Content className="modal motion-drawer" aria-describedby={undefined}>
            <Dialog.Title>
              {command === 'accept'
                ? '验收并完成'
                : command === 'return'
                  ? '退回修改'
                  : command === 'cancel'
                    ? '取消任务'
                    : command === 'reopen'
                      ? '重新打开任务'
                      : command === 'release'
                        ? '释放领取'
                        : command === 'block'
                          ? '标记阻塞'
                          : '解除阻塞'}
            </Dialog.Title>
            <label className="form-label">
              {command === 'accept' ? '验收结论 / 管理员代验理由' : '原因（必填）'}
              <textarea
                value={reason}
                maxLength={2000}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
            <p className="muted">
              {command === 'release'
                ? '释放业务领取不会停止本机进程。运行状态不确定时不能宣称取消成功。'
                : '操作保留已有成果与历史；服务器确认后才更新状态。'}
            </p>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="modal-actions">
              <Dialog.Close asChild>
                <button className="button ghost">返回</button>
              </Dialog.Close>
              <button
                className="button primary"
                disabled={
                  busy ||
                  offline ||
                  !command ||
                  (!reason.trim() && (command !== 'accept' || !isReviewer))
                }
                onClick={() =>
                  perform(async () => {
                    if (demo) throw new Error('演示模式不执行真实状态命令');
                    if (!command) return;
                    const action =
                      command === 'block' || command === 'unblock' ? 'progress' : command;
                    const body =
                      action === 'progress'
                        ? {
                            progress:
                              detail.participants?.find((person) => person.userId === userId)
                                ?.progress ?? 0,
                            summary: reason,
                            blocked: command === 'block',
                            blockedReason: command === 'block' ? reason : '',
                          }
                        : {
                            reason,
                            requirementsVersion:
                              resultRequirementsVersion ?? task.requirementsVersion ?? 1,
                          };
                    await collaborationApi.command(task.id, action, body, task.version);
                    setCommand(null);
                    setReason('');
                    await refresh();
                  })
                }
              >
                确认操作
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </aside>
  );
}
