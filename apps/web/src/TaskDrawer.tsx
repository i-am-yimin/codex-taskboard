import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Dialog from '@radix-ui/react-dialog';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Archive, X, Plus, Command } from 'lucide-react';
import { api, ApiError, openCodexDraft, request } from './api';
import { makeDemoDetail } from './demo';
import type { Board, Task, TaskDetail } from './types';

type Props = {
  taskId: string;
  userId: string;
  editable: boolean;
  board: Board;
  demo: boolean;
  offline: boolean;
  onClose: () => void;
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
  board,
  demo,
  offline,
  onClose,
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
  const [submission, setSubmission] = useState(false);
  const [summary, setSummary] = useState('');
  const [verification, setVerification] = useState('');
  const [error, setError] = useState('');
  const key = `tb:draft:${userId}:${taskId}`;
  const resultKey = `tb:result:${userId}:${taskId}`;
  const detail = query.data;
  useEffect(() => {
    if (!detail || dirty) return;
    try {
      const cached = JSON.parse(localStorage.getItem(key) ?? 'null');
      if (cached?.draft && Number.isInteger(cached.baseVersion)) {
        setDraft(cached.draft);
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
    if (dirty && draft && baseVersion)
      localStorage.setItem(key, JSON.stringify({ draft, baseVersion }));
  }, [key, draft, dirty, baseVersion]);
  useEffect(() => {
    try {
      const cached = JSON.parse(localStorage.getItem(resultKey) ?? 'null');
      if (cached) {
        setSummary(cached.summary);
        setVerification(cached.verification);
      }
    } catch {
      localStorage.removeItem(resultKey);
    }
  }, [resultKey]);
  useEffect(() => {
    if (summary || verification)
      localStorage.setItem(resultKey, JSON.stringify({ summary, verification }));
  }, [resultKey, summary, verification]);
  const refresh = async () => {
    await query.refetch();
    onRefresh();
  };
  async function perform(action: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (error) {
      setError(error instanceof Error ? error.message : '操作失败');
    } finally {
      setBusy(false);
    }
  }
  if (query.error)
    return (
      <aside className="drawer">
        <button className="icon-button" title="关闭" onClick={onClose}>
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
        <button onClick={onClose}>关闭</button>
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
        const updated = demo
          ? { ...task, ...draft, ...extra, version: task.version + 1 }
          : await api.patchTask(task.id, { ...draft, ...extra }, baseVersion ?? task.version);
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
  const running = detail.executions.find((execution) => execution.phase === 'running');
  return (
    <aside className="drawer" aria-label="任务详情">
      <header className="drawer-top">
        <span className="task-id">
          TB-{task.number}
          {dirty ? ' · 未保存草稿' : ''}
        </span>
        <div>
          <button
            className="icon-button"
            title="归档任务"
            disabled={!editable || busy || offline}
            onClick={() => save({ archived: true })}
          >
            <Archive size={17} />
          </button>
          <button className="icon-button" title="关闭" onClick={onClose}>
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
            <select
              disabled={!editable || busy || offline}
              value={draft.statusId}
              onChange={(event) => update('statusId', event.target.value)}
            >
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
            负责人
            <select
              disabled={!editable || busy}
              value={draft.assigneeId ?? ''}
              onChange={(event) => update('assigneeId', event.target.value || null)}
            >
              <option value="">未分配</option>
              {board.members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
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
          <label className="check-item">
            <input
              type="checkbox"
              disabled={!editable || busy}
              checked={draft.blocked}
              onChange={(event) => update('blocked', event.target.checked)}
            />
            任务被阻塞
          </label>
          {draft.blocked && (
            <input
              aria-label="阻塞原因"
              disabled={!editable || busy}
              value={draft.blockedReason}
              onChange={(event) => update('blockedReason', event.target.value)}
            />
          )}
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
        <section className="detail-section execution">
          <h3>Codex 执行</h3>
          <div className="exec-actions">
            <button
              className="button ghost"
              disabled={!editable || offline || busy || !!running}
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
              · 设备 {running.deviceId.slice(0, 8)}
            </p>
          )}
          {semantic === 'in_progress' && (
            <button
              className="text-button"
              disabled={!editable || busy}
              onClick={() => setSubmission(true)}
            >
              提交结果至待验收
            </button>
          )}
          {semantic === 'in_review' && (
            <button
              className="button primary"
              disabled={!editable || busy || offline}
              onClick={() =>
                perform(async () => {
                  if (!demo) {
                    await api.accept(task.id, task.version);
                    await refresh();
                  }
                })
              }
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
                    await request(`/tasks/${taskId}/release`, {
                      method: 'POST',
                      version: task.version,
                      body: { reason: '用户通过看板恢复无法访问的执行设备' },
                    });
                    await refresh();
                  })
                }
              >
                释放旧设备领取
              </button>
            </details>
          )}
          {detail.executions
            .filter((execution) => execution.phase !== 'running')
            .map((execution) => (
              <div className="activity" key={execution.id}>
                <div>
                  <b>{execution.phase === 'submitted' ? '提交验收' : '关联 / 释放'}</b>
                  <p>{execution.summary}</p>
                  <pre>{execution.verification}</pre>
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
                  if (!demo) await api.comment(taskId, comment);
                  setComment('');
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
            {error && <p className="form-error">{error}</p>}
            <p className="muted">
              {offline
                ? '结果已保存在本机，尚未同步。联网后重新核对任务版本并提交。'
                : '提交后由有编辑权限的成员验收。'}
            </p>
            <div className="modal-actions">
              <Dialog.Close asChild>
                <button className="button ghost">保留并关闭</button>
              </Dialog.Close>
              <button
                className="button primary"
                disabled={!summary.trim() || !verification.trim() || busy || offline}
                onClick={() =>
                  perform(async () => {
                    if (!demo) await api.submit(taskId, summary, verification, task.version);
                    localStorage.removeItem(resultKey);
                    setSummary('');
                    setVerification('');
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
    </aside>
  );
}
