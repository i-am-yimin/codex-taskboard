import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { request } from './api';
import type { Task } from './types';

export type TaskFilter = {
  search: string;
  priority: number | null;
  assigneeId: string;
  label: string;
  relation: string;
};
type SavedFilter = {
  id: string;
  name: string;
  spaceId: string | null;
  query: TaskFilter;
  version: number;
};
const relations = [
  { id: '', title: '全部任务' },
  { id: 'responsible', title: '我负责' },
  { id: 'participating', title: '我参与' },
  { id: 'reviewing', title: '待我验收' },
  { id: 'blocked', title: '阻塞' },
];
export function MyTaskViews({
  userId,
  spaceId,
  offline,
  demo,
  filters,
  onFilter,
  onTasks,
}: {
  userId: string;
  spaceId: string;
  offline: boolean;
  demo: boolean;
  filters: TaskFilter;
  onFilter: (filter: TaskFilter) => void;
  onTasks: (tasks: Task[] | null) => void;
}) {
  const client = useQueryClient();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const relation = filters.relation;
  const tasks = useQuery({
    queryKey: ['my-tasks', userId, spaceId, filters],
    enabled: !!relation && !offline && !demo,
    queryFn: () => {
      const query = new URLSearchParams({ relation, spaceId });
      if (filters.search) query.set('search', filters.search);
      if (filters.priority !== null) query.set('priority', String(filters.priority));
      if (filters.assigneeId) query.set('assigneeId', filters.assigneeId);
      if (filters.label) query.set('label', filters.label);
      return request<{ items: Task[]; nextCursor: string | null }>(`/me/tasks?${query}`);
    },
  });
  const saved = useQuery({
    queryKey: ['saved-filters', userId],
    enabled: !offline && !demo,
    queryFn: async () => {
      const value = await request<SavedFilter[]>('/me/saved-filters');
      if (!Array.isArray(value)) throw new Error('服务器尚未提供兼容的个人筛选接口');
      return value;
    },
  });
  const [pages, setPages] = useState<Task[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  useEffect(() => {
    setPages([]);
    setCursor(tasks.data?.nextCursor ?? null);
  }, [tasks.data]);
  useEffect(() => {
    onTasks(!relation ? null : offline || demo ? [] : [...(tasks.data?.items ?? []), ...pages]);
  }, [onTasks, relation, tasks.data, pages, offline, demo]);
  const save = async () => {
    if (!name.trim() || offline || demo || busy) return;
    setBusy(true);
    setError('');
    try {
      await request('/me/saved-filters', {
        method: 'POST',
        body: {
          name: name.trim(),
          spaceId,
          query: {
            ...(filters.relation ? { relation: filters.relation } : {}),
            ...(filters.search ? { search: filters.search } : {}),
            ...(filters.priority !== null ? { priority: filters.priority } : {}),
            ...(filters.assigneeId ? { assigneeId: filters.assigneeId } : {}),
            ...(filters.label ? { label: filters.label } : {}),
          },
        },
      });
      setName('');
      await client.invalidateQueries({ queryKey: ['saved-filters', userId] });
    } catch (error) {
      setError(error instanceof Error ? error.message : '保存筛选失败');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="my-tasks" aria-label="个人任务视图">
      <div className="quick-views">
        {relations.map((item) => (
          <button
            key={item.id}
            aria-pressed={relation === item.id}
            onClick={() => onFilter({ ...filters, relation: item.id })}
          >
            {item.title}
          </button>
        ))}
      </div>
      {relation &&
        (offline ? (
          <p className="muted">离线无法确认个人任务关系；选择全部任务浏览现有缓存。</p>
        ) : demo ? (
          <p className="muted">演示模式不查询个人任务；请选择全部任务查看合成示例。</p>
        ) : tasks.isPending ? (
          <p role="status">正在读取个人任务…</p>
        ) : tasks.error ? (
          <p className="form-error" role="alert">
            {tasks.error.message}
            <button className="text-button" onClick={() => tasks.refetch()}>
              重试个人视图
            </button>
          </p>
        ) : tasks.data?.items.length === 0 ? (
          <p className="muted">此视图暂无任务。</p>
        ) : null)}
      {cursor && relation && (
        <button
          className="text-button"
          disabled={loadingMore}
          onClick={async () => {
            setLoadingMore(true);
            setError('');
            try {
              const query = new URLSearchParams({ relation, spaceId, cursor });
              if (filters.search) query.set('search', filters.search);
              if (filters.priority !== null) query.set('priority', String(filters.priority));
              if (filters.assigneeId) query.set('assigneeId', filters.assigneeId);
              if (filters.label) query.set('label', filters.label);
              const page = await request<{ items: Task[]; nextCursor: string | null }>(
                `/me/tasks?${query}`,
              );
              setPages((previous) => [
                ...previous,
                ...page.items.filter((item) => !previous.some((task) => task.id === item.id)),
              ]);
              setCursor(page.nextCursor);
            } catch (error) {
              setError(error instanceof Error ? error.message : '读取下一页失败');
            } finally {
              setLoadingMore(false);
            }
          }}
        >
          {' '}
          {loadingMore ? '正在加载…' : '加载更多个人任务'}{' '}
        </button>
      )}
      <details>
        <summary>保存与应用个人筛选</summary>
        {saved.isError && (
          <p className="form-error">
            个人筛选暂时不可用：{saved.error.message}
            <button className="text-button" onClick={() => saved.refetch()}>
              重试
            </button>
          </p>
        )}
        <div className="saved-filters">
          {(saved.data ?? [])
            .filter((item) => !item.spaceId || item.spaceId === spaceId)
            .map((item) => (
              <span key={item.id}>
                <button className="text-button" onClick={() => onFilter(item.query)}>
                  {item.name}
                </button>
                <button
                  className="icon-button"
                  aria-label={`删除筛选 ${item.name}`}
                  disabled={offline || busy}
                  onClick={async () => {
                    setBusy(true);
                    setError('');
                    try {
                      await request(`/me/saved-filters/${item.id}`, {
                        method: 'DELETE',
                        version: item.version,
                      });
                      await saved.refetch();
                    } catch (error) {
                      setError(error instanceof Error ? error.message : '删除失败');
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  ×
                </button>
              </span>
            ))}
        </div>
        <div className="collaboration-inline">
          <label>
            筛选名称
            <input
              value={name}
              maxLength={80}
              disabled={offline || demo || busy}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <button
            className="button ghost"
            disabled={offline || demo || busy || !name.trim()}
            onClick={save}
          >
            保存当前筛选
          </button>
        </div>
      </details>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
