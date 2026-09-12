import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, request } from './api';
import type { Board, Member, Task } from './types';

export interface SpaceActionsProps {
  board: Board;
  demo: boolean;
  onRefresh: () => void | Promise<void>;
  onNotice: (message: string) => void;
}

/** Compact administration controls, kept separate so the board view stays focused. */
export function SpaceActions({ board, demo, onRefresh, onNotice }: SpaceActionsProps) {
  const [busy, setBusy] = useState(false);
  const [transferTarget, setTransferTarget] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [statusIds, setStatusIds] = useState(() => board.statuses.map((status) => status.id));
  const canAdmin = board.space.role === 'owner' || board.space.role === 'admin';
  const canTransfer = board.space.role === 'owner';
  const archivedTasks = useQuery({
    queryKey: ['archived-tasks', board.space.id],
    enabled: !demo,
    queryFn: async () =>
      (await request<Task[]>(`/spaces/${board.space.id}/tasks`)).filter((task) => task.archived),
  });
  const members = useMemo(
    () => board.members.filter((member) => member.id !== undefined),
    [board.members],
  );

  const execute = async (description: string, action: () => Promise<unknown>) => {
    if (demo) {
      onNotice(`演示模式：${description}`);
      return;
    }
    setBusy(true);
    try {
      await action();
      await onRefresh();
      onNotice(`${description}成功`);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : `${description}失败`);
    } finally {
      setBusy(false);
    }
  };
  const move = (index: number, offset: -1 | 1) => {
    const next = [...statusIds];
    const destination = index + offset;
    if (destination < 0 || destination >= next.length) return;
    [next[index], next[destination]] = [next[destination], next[index]];
    setStatusIds(next);
  };
  const selectedMember = members.find((member) => member.id === transferTarget) as
    Member | undefined;

  return (
    <section aria-label="空间操作" className="space-actions">
      <h3>空间管理</h3>
      {!!archivedTasks.data?.length && (
        <div className="space-action-row">
          <h4>已归档任务</h4>
          {archivedTasks.data.map((task) => (
            <div key={task.id}>
              <span>{task.title}</span>
              <button
                className="button ghost"
                disabled={busy || board.space.archived || board.space.role === 'viewer'}
                onClick={() =>
                  execute('恢复任务', async () => {
                    await api.patchTask(task.id, { archived: false }, task.version);
                    await archivedTasks.refetch();
                  })
                }
              >
                恢复任务
              </button>
            </div>
          ))}
        </div>
      )}
      {canAdmin && (
        <div className="space-action-row">
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              execute(board.space.archived ? '恢复空间' : '归档空间', () =>
                board.space.archived
                  ? api.restoreSpace(board.space.id)
                  : api.archiveSpace(board.space.id),
              )
            }
          >
            {board.space.archived ? '恢复空间' : '归档空间'}
          </button>
          <span>{board.space.archived ? '归档空间为只读状态。' : '归档后将阻止新的写入。'}</span>
        </div>
      )}
      {canTransfer && (
        <div className="space-action-row">
          <label>
            转移所有权
            <select
              value={transferTarget}
              disabled={busy}
              onChange={(event) => {
                setTransferTarget(event.target.value);
                setConfirmed(false);
              }}
            >
              <option value="">选择成员</option>
              {members
                .filter((member) => member.role !== 'owner')
                .map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}（{member.email}）
                  </option>
                ))}
            </select>
          </label>
          {selectedMember && (
            <label>
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
              />{' '}
              我确认将空间所有权转给 {selectedMember.name}
            </label>
          )}
          <button
            type="button"
            disabled={busy || !transferTarget || !confirmed}
            onClick={() =>
              execute('转移所有权', () => api.transferOwner(board.space.id, transferTarget))
            }
          >
            确认转移
          </button>
        </div>
      )}
      {canAdmin && (
        <div className="space-action-row">
          <div>
            <span>状态列顺序</span>
            {statusIds.map((statusId, index) => {
              const status = board.statuses.find((item) => item.id === statusId);
              return (
                <div key={statusId}>
                  <span>{status?.name ?? statusId}</span>
                  <button
                    type="button"
                    aria-label={`上移 ${status?.name ?? ''}`}
                    disabled={busy || index === 0}
                    onClick={() => move(index, -1)}
                  >
                    上移
                  </button>
                  <button
                    type="button"
                    aria-label={`下移 ${status?.name ?? ''}`}
                    disabled={busy || index === statusIds.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    下移
                  </button>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            disabled={busy || statusIds.every((id, index) => id === board.statuses[index]?.id)}
            onClick={() =>
              execute('更新状态列顺序', () =>
                request(`/spaces/${board.space.id}/statuses/reorder`, {
                  method: 'POST',
                  body: { statusIds },
                }),
              )
            }
          >
            保存顺序
          </button>
        </div>
      )}
    </section>
  );
}
