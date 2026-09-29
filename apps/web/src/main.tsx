import { StrictMode, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Dialog from '@radix-ui/react-dialog';
import {
  DndContext,
  useDroppable,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  useSortable,
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Archive,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Cloud,
  CloudOff,
  Command,
  GripVertical,
  LayoutGrid,
  List,
  LoaderCircle,
  LockKeyhole,
  Plus,
  Search,
  Settings,
  Signal,
  Sparkles,
  Users,
  Wifi,
  X,
} from 'lucide-react';
import { ConnectionSettings } from './ConnectionSettings';
import { DesktopServerSetup } from './DesktopServerSetup';
import {
  api,
  ApiError,
  cacheBoard,
  clearAccountCache,
  embeddedCapability,
  hasLocalCompanion,
  readCachedBoard,
} from './api';
import {
  clearOfflineSnapshot,
  removeOfflineBoard,
  readOfflineSnapshot,
  saveOfflineSnapshot,
} from './offlineSnapshot';
import { TaskDrawer } from './TaskDrawer';
import { subscribeDesktopBoardEvents } from './realtime';
import { SpaceActions } from './SpaceActions';
import { demoUser, makeDemoBoard } from './demo';
import { installEmbeddedReadyResponder } from './embeddedReady';
import type { Board, Member, Semantic, Space, Status, Task } from './types';
import './styles.css';
import './glass.css';

const query = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});
const isDemo = new URLSearchParams(location.search).get('demo') === '1';
if (import.meta.env.PROD && !embeddedCapability() && 'serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('/sw.js')
    .then(() => navigator.serviceWorker.ready)
    .then((registration) =>
      registration.active?.postMessage({
        type: 'cache-shell',
        urls: [
          ...performance
            .getEntriesByType('resource')
            .map((entry) => entry.name)
            .filter(
              (url) =>
                new URL(url).origin === location.origin &&
                new URL(url).pathname.startsWith('/assets/'),
            ),
        ],
      }),
    )
    .catch(() => undefined);
}
const semanticName: Record<Semantic, string> = {
  todo: '待办',
  in_progress: '进行中',
  in_review: '待验收',
  done: '已完成',
  cancelled: '已取消',
};
const priorityName = ['无优先级', '紧急', '高', '普通'];
const initials = (name: string) => name.slice(0, 1);

function App() {
  useEffect(() => installEmbeddedReadyResponder(), []);
  const client = useQueryClient();
  const [theme, setTheme] = useState<'system' | 'dark' | 'light'>(
    () => (localStorage.getItem('tb:theme') as 'system' | 'dark' | 'light' | null) ?? 'system',
  );
  const [sync, setSync] = useState<'connecting' | 'synced' | 'offline'>(
    navigator.onLine ? 'connecting' : 'offline',
  );
  const [view, setView] = useState<'board' | 'list'>('board');
  const [spaceMenu, setSpaceMenu] = useState(false);
  const [settings, setSettings] = useState(false);
  const [newTask, setNewTask] = useState(false);
  const [newSpace, setNewSpace] = useState(false);
  const [drawer, setDrawer] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [priority, setPriority] = useState<number | null>(null);
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [labelFilter, setLabelFilter] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{ task: Task; changes: Partial<Task> } | null>(null);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [offlineSession, setOfflineSession] = useState(() =>
    isDemo ? null : readOfflineSnapshot(),
  );
  const [showingCached, setShowingCached] = useState(!navigator.onLine && !!offlineSession);
  const priorAccountId = useRef<string | null>(null);
  const userQuery = useQuery({
    queryKey: ['me'],
    networkMode: 'always',
    queryFn: async () => {
      if (isDemo) return demoUser;
      try {
        const account = await api.me();
        setShowingCached(false);
        return account;
      } catch (error) {
        if (error instanceof ApiError && error.code === 'OFFLINE' && offlineSession) {
          setShowingCached(true);
          return offlineSession.account;
        }
        throw error;
      }
    },
  });
  const user = userQuery.data;
  const spacesQuery = useQuery({
    queryKey: ['spaces', user?.id],
    networkMode: 'always',
    enabled: !!user,
    queryFn: async () => {
      if (isDemo)
        return [
          makeDemoBoard().space,
          {
            ...makeDemoBoard().space,
            id: 'space-personal',
            name: '个人事项',
            icon: '☼',
            color: '#e89b3d',
          },
        ];
      try {
        return await api.spaces();
      } catch (error) {
        if (error instanceof ApiError && error.code === 'OFFLINE' && offlineSession) {
          setShowingCached(true);
          return offlineSession.spaces;
        }
        throw error;
      }
    },
  });
  const [spaceId, setSpaceId] = useState(isDemo ? 'space-work' : '');
  useEffect(() => {
    if (!spaceId && spacesQuery.data?.[0]) setSpaceId(spacesQuery.data[0].id);
  }, [spaceId, spacesQuery.data]);
  const boardQuery = useQuery({
    queryKey: ['board', user?.id, spaceId],
    networkMode: 'always',
    enabled: !!user && !!spaceId,
    queryFn: async () => {
      if (isDemo) return makeDemoBoard();
      try {
        const board = await api.board(spaceId);
        if (user) cacheBoard(user.id, board);
        setShowingCached(false);
        return board;
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403) && user) {
          localStorage.removeItem(`tb:board:${user.id}:${spaceId}`);
          removeOfflineBoard(user.id, spaceId);
          setOfflineSession(readOfflineSnapshot());
        }
        const cached =
          err instanceof ApiError && err.code === 'OFFLINE' && user
            ? offlineSession?.account.id === user.id
              ? (offlineSession.boards[spaceId] ?? readCachedBoard(user.id, spaceId))
              : readCachedBoard(user.id, spaceId)
            : null;
        if (cached) setShowingCached(true);
        if (cached) return cached;
        throw err;
      }
    },
  });
  const board = boardQuery.data;
  const latestBoard = useRef<Board | undefined>(board);
  latestBoard.current = board;
  useEffect(() => {
    if (!user || isDemo) return;
    if (priorAccountId.current && priorAccountId.current !== user.id) {
      void client.cancelQueries();
      client.removeQueries({ queryKey: ['spaces', priorAccountId.current] });
      client.removeQueries({ queryKey: ['board', priorAccountId.current] });
      client.removeQueries({ queryKey: ['task'] });
    }
    priorAccountId.current = user.id;
  }, [client, user]);
  useEffect(() => {
    if (!isDemo && user && offlineSession && offlineSession.account.id !== user.id) {
      clearAccountCache(offlineSession.account.id);
      clearOfflineSnapshot(offlineSession.account.id);
      setOfflineSession(null);
    }
  }, [offlineSession, user]);
  useEffect(() => {
    if (!isDemo && user && spacesQuery.data && board && !boardQuery.error && !showingCached) {
      saveOfflineSnapshot(user, spacesQuery.data, board);
      setOfflineSession(readOfflineSnapshot());
    }
  }, [board, showingCached, spacesQuery.data, user]);
  useEffect(() => {
    if (
      !isDemo &&
      userQuery.error instanceof ApiError &&
      [401, 403].includes(userQuery.error.status)
    ) {
      const accountId = user?.id ?? offlineSession?.account.id;
      if (accountId) clearAccountCache(accountId);
      clearOfflineSnapshot(accountId);
      setOfflineSession(null);
    }
  }, [offlineSession, user, userQuery.error]);
  useEffect(() => {
    if (!user || !spaceId || isDemo) return;
    setSync('connecting');
    const refresh = () => {
      client.invalidateQueries({ queryKey: ['board', user.id, spaceId] });
      client.invalidateQueries({ queryKey: ['task'] });
    };
    const revoke = () => {
      localStorage.removeItem(`tb:board:${user.id}:${spaceId}`);
      latestBoard.current?.tasks.forEach((task) => {
        localStorage.removeItem(`tb:draft:${user.id}:${task.id}`);
        localStorage.removeItem(`tb:result:${user.id}:${task.id}`);
      });
      removeOfflineBoard(user.id, spaceId);
      setOfflineSession(readOfflineSnapshot());
      client.removeQueries({ queryKey: ['board', user.id, spaceId] });
      client.removeQueries({ queryKey: ['task'] });
      client.setQueryData<Space[]>(['spaces', user.id], (spaces) =>
        spaces?.filter((space) => space.id !== spaceId),
      );
      setSync('offline');
      void api.me().catch((error) => {
        if (!(error instanceof ApiError) || ![401, 403].includes(error.status)) return;
        clearAccountCache(user.id);
        clearOfflineSnapshot(user.id);
        setOfflineSession(null);
      });
    };
    if (hasLocalCompanion()) {
      let stopped = false;
      let retry = 0;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let unsubscribe: () => void = () => undefined;
      const connect = () => {
        unsubscribe = subscribeDesktopBoardEvents(spaceId, {
          ready: () => {
            retry = 0;
            setSync('synced');
            refresh();
          },
          board: () => {
            setSync('synced');
            refresh();
          },
          revoked: () => {
            stopped = true;
            revoke();
          },
          error: () => {
            if (stopped) return;
            setSync(navigator.onLine ? 'connecting' : 'offline');
            timer = setTimeout(connect, Math.min(2000, 250 * 2 ** retry++));
          },
        });
      };
      connect();
      return () => {
        stopped = true;
        if (timer) clearTimeout(timer);
        unsubscribe();
      };
    }
    const events = new EventSource(
      `${import.meta.env.VITE_API_BASE ?? '/api/v1'}/spaces/${spaceId}/events`,
      { withCredentials: true },
    );
    events.addEventListener('ready', () => {
      setSync('synced');
      refresh();
    });
    events.addEventListener('board', () => {
      setSync('synced');
      refresh();
    });
    events.addEventListener('revoked', revoke);
    events.onerror = () => setSync(navigator.onLine ? 'connecting' : 'offline');
    return () => events.close();
  }, [client, spaceId, user]);
  useEffect(() => {
    const change = () => {
      setOffline(!navigator.onLine);
      setSync(navigator.onLine ? 'connecting' : 'offline');
      if (navigator.onLine) {
        client.invalidateQueries({ queryKey: ['me'] });
        client.invalidateQueries({ queryKey: ['spaces', user?.id] });
        client.invalidateQueries({ queryKey: ['board', user?.id, spaceId] });
      }
    };
    addEventListener('online', change);
    addEventListener('offline', change);
    return () => {
      removeEventListener('online', change);
      removeEventListener('offline', change);
    };
  }, [client, spaceId, user?.id]);
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === 'system' ? (media.matches ? 'dark' : 'light') : theme;
      localStorage.setItem('tb:theme', theme);
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
  const visible = useMemo(
    () =>
      board?.tasks.filter(
        (t) =>
          !t.archived &&
          (!search ||
            `${t.title} ${t.labels.join(' ')}`.toLowerCase().includes(search.toLowerCase())) &&
          (priority === null || t.priority === priority) &&
          (!assigneeFilter || t.assigneeId === assigneeFilter) &&
          (!labelFilter || t.labels.includes(labelFilter)),
      ) ?? [],
    [board, search, priority, assigneeFilter, labelFilter],
  );
  const editor = board?.space.role !== 'viewer' && !board?.space.archived;
  const readOnlyCached = offline || showingCached;

  const refresh = () => client.invalidateQueries({ queryKey: ['board', user?.id, spaceId] });
  const move = async (task: Task, statusId: string, position?: number) => {
    if (!board) return;
    if (readOnlyCached) return setNotice('离线缓存仅供浏览；恢复连接后才能更新任务。');
    if (!editor) return setNotice('你只有查看权限，无法移动任务。');
    const changes = {
      statusId,
      position:
        position ??
        Math.max(0, ...board.tasks.filter((t) => t.statusId === statusId).map((t) => t.position)) +
          1024,
    };
    if (isDemo) {
      client.setQueryData<Board>(['board', user?.id, spaceId], (b) =>
        b
          ? {
              ...b,
              tasks: b.tasks.map((t) =>
                t.id === task.id ? { ...t, ...changes, version: t.version + 1 } : t,
              ),
            }
          : b,
      );
      return;
    }
    try {
      await api.patchTask(task.id, changes, task.version);
      refresh();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'VERSION_CONFLICT') setConflict({ task, changes });
      else setNotice(e instanceof Error ? e.message : '更新失败');
    }
  };
  const logout = async () => {
    if (!isDemo) await api.logout().catch(() => undefined);
    if (user) {
      clearAccountCache(user.id);
      clearOfflineSnapshot(user.id);
    }
    location.href = location.pathname;
  };
  if (userQuery.isLoading || (user && spacesQuery.isLoading)) return <Loading />;
  if (!isDemo && (userQuery.error || !user))
    return (
      <Onboarding
        error={
          userQuery.error instanceof ApiError && userQuery.error.status === 401
            ? undefined
            : userQuery.error instanceof Error
              ? userQuery.error.message
              : undefined
        }
      />
    );
  if (location.hash.startsWith('#invite=') || location.hash.startsWith('#recovery='))
    return <Onboarding />;
  if (!isDemo && spacesQuery.data?.length === 0)
    return (
      <EmptySpace
        onCreated={(id) => {
          setSpaceId(id);
          client.invalidateQueries({ queryKey: ['spaces', user?.id] });
        }}
      />
    );
  if (boardQuery.error)
    return (
      <main className="empty-space">
        <CloudOff size={28} />
        <p className="eyebrow">无法打开空间</p>
        <h1>任务数据暂时不可用</h1>
        <p>
          {boardQuery.error instanceof Error
            ? boardQuery.error.message
            : '请检查网络连接或空间权限。'}
        </p>
        <button className="button primary" onClick={() => boardQuery.refetch()}>
          重试连接
        </button>
      </main>
    );
  if (!board) return <Loading label="正在打开空间…" />;

  return (
    <main
      className={`app-shell${new URLSearchParams(location.search).get('embedded') === '1' ? ' embedded' : ''}`}
    >
      <aside className="rail" aria-label="看板导航">
        <div className="brand">
          <Sparkles size={18} />
          <span>taskboard</span>
        </div>
        <button className="rail-icon active" title="任务看板">
          <LayoutGrid size={19} />
        </button>
        <div className="rail-fill" />
        <button className="avatar mine" title={user?.name}>
          {initials(user?.name ?? '我')}
        </button>
      </aside>
      <section className="workspace">
        <header className="topbar">
          <div className="space-switcher-wrap">
            <button className="space-switcher" onClick={() => setSpaceMenu(!spaceMenu)}>
              <i style={{ background: board.space.color }}>{board.space.icon}</i>
              <span>
                {board.space.name}
                {board.space.archived ? '（已归档）' : ''}
              </span>
              <ChevronDown size={15} />
            </button>
            {spaceMenu && (
              <div className="menu space-menu">
                {spacesQuery.data?.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setSpaceId(s.id);
                      setSpaceMenu(false);
                    }}
                  >
                    <i style={{ background: s.color }}>{s.icon}</i>
                    {s.name}
                    {s.archived ? '（已归档）' : ''}
                    {s.id === spaceId && <Check size={15} />}
                  </button>
                ))}
                <hr />
                <button
                  disabled={readOnlyCached}
                  onClick={() => {
                    setNewSpace(true);
                    setSpaceMenu(false);
                  }}
                >
                  <Plus size={15} />
                  新建空间
                </button>
                <button
                  onClick={() => {
                    setSettings(true);
                    setSpaceMenu(false);
                  }}
                >
                  <Settings size={15} />
                  管理当前空间
                </button>
              </div>
            )}
          </div>
          <div className="topbar-right">
            <span className={sync === 'offline' ? 'connection offline' : 'connection'}>
              {sync === 'offline' ? <CloudOff size={14} /> : <Cloud size={14} />}{' '}
              {sync === 'offline'
                ? '离线缓存'
                : isDemo
                  ? '演示模式'
                  : sync === 'connecting'
                    ? '正在同步'
                    : '已同步'}
            </span>
            <button className="icon-button" title="设置" onClick={() => setSettings(true)}>
              <Settings size={18} />
            </button>
          </div>
        </header>
        <div className="page-head">
          <div>
            <p className="eyebrow">
              {isDemo ? '可点击产品演示' : board.space.description || '任务空间'}
            </p>
            <h1>任务看板</h1>
          </div>
          <div className="head-actions">
            <button
              className="button ghost"
              onClick={() => setView(view === 'board' ? 'list' : 'board')}
            >
              {view === 'board' ? <List size={16} /> : <LayoutGrid size={16} />}{' '}
              {view === 'board' ? '列表' : '看板'}
            </button>
            <button
              className="button primary"
              onClick={() => setNewTask(true)}
              disabled={!editor || readOnlyCached}
            >
              <Plus size={17} />
              新建任务
            </button>
          </div>
        </div>
        <div className="toolbar">
          <label className="search">
            <Search size={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索任务、标签…"
            />
          </label>
          <select
            className="filter"
            aria-label="优先级筛选"
            value={priority ?? ''}
            onChange={(e) => setPriority(e.target.value === '' ? null : Number(e.target.value))}
          >
            <option value="">全部优先级</option>
            {priorityName.map((x, i) => (
              <option key={x} value={i}>
                {x}
              </option>
            ))}
          </select>
          <select
            className="filter"
            aria-label="负责人筛选"
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
          >
            <option value="">全部负责人</option>
            {board.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <select
            className="filter"
            aria-label="标签筛选"
            value={labelFilter}
            onChange={(e) => setLabelFilter(e.target.value)}
          >
            <option value="">全部标签</option>
            {[...new Set(board.tasks.flatMap((t) => t.labels))].map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
          <span className="result-count">{visible.length} 个任务</span>
        </div>
        {readOnlyCached && (
          <div className="banner">
            <CloudOff size={16} />
            当前正在浏览
            {showingCached
              ? `于 ${offlineSession?.updatedAt ? new Date(offlineSession.updatedAt).toLocaleString() : '此前'} 保存的`
              : '已'}
            缓存内容。此状态未验证登录或权限；草稿会保留在此设备，所有写入已暂停。
          </div>
        )}
        {isDemo && (
          <div className="demo-bar">
            <Sparkles size={15} />
            演示数据 · 不会修改或执行真实任务
          </div>
        )}
        {view === 'board' ? (
          <BoardView
            board={board}
            tasks={visible}
            onOpen={(id) => (id === '__new__' ? setNewTask(true) : setDrawer(id))}
            onMove={move}
            editable={!!editor && !readOnlyCached}
          />
        ) : (
          <ListView
            board={board}
            tasks={visible}
            onOpen={(id) => (id === '__new__' ? setNewTask(true) : setDrawer(id))}
          />
        )}
      </section>
      {drawer && (
        <TaskDrawer
          key={drawer}
          taskId={drawer}
          userId={user!.id}
          editable={!!editor && !readOnlyCached}
          board={board}
          demo={isDemo}
          offline={readOnlyCached}
          onClose={() => setDrawer(null)}
          onRefresh={refresh}
          onNotice={setNotice}
        />
      )}
      {newTask && (
        <NewTask
          board={board}
          demo={isDemo}
          offline={readOnlyCached}
          onClose={() => setNewTask(false)}
          onRefresh={refresh}
          onNotice={setNotice}
        />
      )}
      {newSpace && (
        <NewSpace
          demo={isDemo}
          onClose={() => setNewSpace(false)}
          onCreated={(id) => {
            setNewSpace(false);
            setSpaceId(id);
            client.invalidateQueries({ queryKey: ['spaces', user?.id] });
          }}
          onNotice={setNotice}
        />
      )}
      {settings && (
        <SettingsPanel
          board={board}
          demo={isDemo}
          offline={readOnlyCached}
          theme={theme}
          onTheme={setTheme}
          onClose={() => setSettings(false)}
          onRefresh={refresh}
          onNotice={setNotice}
          onLogout={logout}
        />
      )}
      {conflict && (
        <ConflictDialog
          conflict={conflict}
          onClose={() => setConflict(null)}
          onKeep={() => {
            setNotice('本地草稿已保留。请打开任务查看最新内容后再提交。');
            setConflict(null);
          }}
          onReload={() => {
            refresh();
            setConflict(null);
          }}
        />
      )}
      {notice && (
        <div className="toast">
          <Signal size={16} />
          {notice}
          <button onClick={() => setNotice(null)}>
            <X size={15} />
          </button>
        </div>
      )}
    </main>
  );
}

function Loading({ label = '正在连接任务看板…' }: { label?: string }) {
  return (
    <div className="loading">
      <Sparkles size={24} />
      <p>{label}</p>
    </div>
  );
}
function EmptySpace({ onCreated }: { onCreated: (id: string) => void }) {
  return (
    <main className="empty-space">
      <Sparkles size={28} />
      <p className="eyebrow">首次使用</p>
      <h1>创建你的第一个任务空间</h1>
      <p>用空间隔离工作、个人或团队任务。你可以稍后邀请成员并自定义状态列。</p>
      <NewSpace
        demo={false}
        embedded
        onClose={() => undefined}
        onCreated={onCreated}
        onNotice={() => undefined}
      />
    </main>
  );
}
function NewSpace({
  demo,
  onClose,
  onCreated,
  onNotice,
  embedded = false,
}: {
  demo: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
  onNotice: (s: string) => void;
  embedded?: boolean;
}) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'work' | 'personal'>('work');
  const [saving, setSaving] = useState(false);
  const create = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (demo) {
        onCreated('space-work');
        onNotice('演示模式：空间已创建。');
        return;
      }
      const space = await api.createSpace({
        name,
        icon: kind === 'work' ? '✦' : '☼',
        color: kind === 'work' ? '#7c6df2' : '#e89b3d',
        description: '',
      });
      onCreated(space.id);
    } catch (e) {
      setSaving(false);
      onNotice(e instanceof Error ? e.message : '创建空间失败');
    }
  };
  const form = (
    <>
      <label className="form-label">
        空间名称
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={kind === 'work' ? '例如：产品工作室' : '例如：个人事项'}
        />
      </label>
      <label className="form-label">
        用途
        <div className="segmented">
          <button className={kind === 'work' ? 'selected' : ''} onClick={() => setKind('work')}>
            工作
          </button>
          <button
            className={kind === 'personal' ? 'selected' : ''}
            onClick={() => setKind('personal')}
          >
            个人
          </button>
        </div>
      </label>
      <div className="modal-actions">
        {!embedded && (
          <button className="button ghost" onClick={onClose}>
            取消
          </button>
        )}
        <button className="button primary" disabled={!name.trim() || saving} onClick={create}>
          {saving && <LoaderCircle className="spin" size={15} />}创建空间
        </button>
      </div>
    </>
  );
  return embedded ? (
    <div className="inline-space-form">{form}</div>
  ) : (
    <Modal title="新建任务空间" onClose={onClose}>
      {form}
    </Modal>
  );
}
function BoardView({
  board,
  tasks,
  onOpen,
  onMove,
  editable,
}: {
  board: Board;
  tasks: Task[];
  onOpen: (id: string) => void;
  onMove: (task: Task, statusId: string, position?: number) => void;
  editable: boolean;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const drop = (event: DragEndEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    const overId = event.over?.id.toString();
    if (!task || !overId || overId === task.id) return;
    const overTask = tasks.find((item) => item.id === overId);
    const statusId = overTask?.statusId ?? overId;
    if (!board.statuses.some((status) => status.id === statusId)) return;
    const remaining = tasks
      .filter((item) => item.statusId === statusId && item.id !== task.id)
      .sort((a, b) => a.position - b.position);
    if (!overTask) return onMove(task, statusId);
    let index = remaining.findIndex((item) => item.id === overId);
    if (task.statusId === statusId && task.position < overTask.position) index++;
    const previous = remaining[index - 1]?.position ?? 0;
    const next = remaining[index]?.position ?? previous + 2048;
    onMove(task, statusId, (previous + next) / 2);
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={drop}>
      <div className="board">
        {board.statuses.map((status) => (
          <BoardColumn
            status={status}
            key={status.id}
            tasks={tasks.filter((t) => t.statusId === status.id)}
            members={board.members}
            onOpen={onOpen}
            editable={editable}
          />
        ))}
      </div>
    </DndContext>
  );
}
function BoardColumn({
  status,
  tasks,
  members,
  onOpen,
  editable,
}: {
  status: Status;
  tasks: Task[];
  members: Member[];
  onOpen: (id: string) => void;
  editable: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status.id, disabled: !editable });
  return (
    <section className={`column${isOver ? ' is-over' : ''}`} ref={setNodeRef}>
      <header className="column-head">
        <span className="status-dot" style={{ background: status.color }} />
        <b>{status.name}</b>
        <em>{tasks.length}</em>
      </header>
      <div className="column-body">
        <SortableContext
          items={tasks.map((task) => task.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              members={members}
              onOpen={onOpen}
              disabled={!editable}
            />
          ))}
        </SortableContext>
        <button className="add-inline" onClick={() => onOpen('__new__')} disabled={!editable}>
          <Plus size={15} />
          添加任务
        </button>
      </div>
    </section>
  );
}
function TaskCard({
  task,
  members,
  onOpen,
  disabled,
}: {
  task: Task;
  members: Member[];
  onOpen: (id: string) => void;
  disabled: boolean;
}) {
  const assignee = members.find((m) => m.id === task.assigneeId);
  const { attributes, listeners, setNodeRef, isDragging, transform, transition } = useSortable({
    id: task.id,
    disabled,
  });
  const {
    role: _sortableRole,
    tabIndex: _sortableTabIndex,
    'aria-disabled': _sortableDisabled,
    ...sortableAttributes
  } = attributes;
  return (
    <button
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`task-card${isDragging ? ' dragging' : ''}`}
      onClick={() => onOpen(task.id)}
      {...sortableAttributes}
      {...(disabled ? {} : listeners)}
    >
      <span className="task-title">
        <GripVertical size={14} />
        <span>{task.title}</span>
        {task.blocked && <LockKeyhole className="blocked" size={14} />}
      </span>
      <span className="tag-row">
        {task.labels.slice(0, 2).map((label) => (
          <span className="tag" key={label}>
            {label}
          </span>
        ))}
      </span>
      <span className="card-footer">
        <span className={`priority p${task.priority}`}>
          <i /> {priorityName[task.priority]}
        </span>
        <span className="task-no">TB-{task.number}</span>
        {assignee && <span className="avatar small">{initials(assignee.name)}</span>}
      </span>
    </button>
  );
}
function ListView({
  board,
  tasks,
  onOpen,
}: {
  board: Board;
  tasks: Task[];
  onOpen: (id: string) => void;
}) {
  return (
    <div className="list-view">
      <div className="list-header">
        <span>任务</span>
        <span>状态</span>
        <span>负责人</span>
        <span>优先级</span>
      </div>
      {tasks.map((t) => {
        const status = board.statuses.find((s) => s.id === t.statusId);
        const member = board.members.find((m) => m.id === t.assigneeId);
        return (
          <button className="list-row" key={t.id} onClick={() => onOpen(t.id)}>
            <span>
              <b>TB-{t.number}</b>
              {t.title}
              {t.blocked && <LockKeyhole size={13} />}
            </span>
            <span>
              <i className="status-dot" style={{ background: status?.color }} />
              {status?.name}
            </span>
            <span>
              {member ? (
                <>
                  <i className="avatar small">{initials(member.name)}</i>
                  {member.name}
                </>
              ) : (
                '未分配'
              )}
            </span>
            <span className={`priority p${t.priority}`}>
              <i /> {priorityName[t.priority]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function NewTask({
  board,
  demo,
  offline,
  onClose,
  onRefresh,
  onNotice,
}: {
  board: Board;
  demo: boolean;
  offline: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onNotice: (s: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [statusId, setStatusId] = useState(board.statuses[0]?.id ?? '');
  const [priority, setPriority] = useState(2);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      if (!demo)
        await api.createTask(board.space.id, {
          title,
          description,
          statusId,
          priority,
          position:
            Math.max(
              0,
              ...board.tasks.filter((t) => t.statusId === statusId).map((t) => t.position),
            ) + 1024,
        });
      onRefresh();
      onClose();
      onNotice(demo ? '演示模式：新任务已加入当前看板。' : '已创建任务。');
    } catch (e) {
      setSaving(false);
      onNotice(e instanceof Error ? e.message : '创建失败');
    }
  };
  return (
    <Modal title="新建任务" onClose={onClose}>
      <label className="form-label">
        任务标题
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例如：完善首次连接引导"
        />
      </label>
      <label className="form-label">
        描述
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="添加背景、范围或验收标准…"
        />
      </label>
      <div className="field-grid">
        <label className="form-label">
          状态
          <select value={statusId} onChange={(e) => setStatusId(e.target.value)}>
            {board.statuses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="form-label">
          优先级
          <select value={priority} onChange={(e) => setPriority(Number(e.target.value))}>
            {priorityName.map((p, i) => (
              <option value={i} key={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="modal-actions">
        <button className="button ghost" onClick={onClose}>
          取消
        </button>
        <button
          className="button primary"
          disabled={!title.trim() || saving || offline}
          onClick={save}
        >
          {saving && <LoaderCircle className="spin" size={15} />}创建任务
        </button>
      </div>
    </Modal>
  );
}

function SettingsPanel({
  board,
  demo,
  offline,
  theme,
  onTheme,
  onClose,
  onRefresh,
  onNotice,
  onLogout,
}: {
  board: Board;
  demo: boolean;
  offline: boolean;
  theme: 'system' | 'dark' | 'light';
  onTheme: (t: 'system' | 'dark' | 'light') => void;
  onClose: () => void;
  onRefresh: () => void;
  onNotice: (s: string) => void;
  onLogout: () => void;
}) {
  const [section, setSection] = useState<'space' | 'members' | 'statuses' | 'connection'>('space');
  const [name, setName] = useState(board.space.name);
  const [icon, setIcon] = useState(board.space.icon);
  const [color, setColor] = useState(board.space.color);
  const [description, setDescription] = useState(board.space.description);
  const canEditSpace =
    !offline && !board.space.archived && ['owner', 'admin'].includes(board.space.role);
  const [adding, setAdding] = useState(false);
  const saveSpace = async () => {
    if (demo) return onNotice('演示模式：空间名称已暂存在预览中。');
    try {
      await api.patchSpace(board.space.id, { name, icon, color, description }, board.space.version);
      onRefresh();
      onNotice('空间设置已保存。');
    } catch (e) {
      onNotice(e instanceof Error ? e.message : '保存失败');
    }
  };
  return (
    <div className="settings-overlay">
      <aside className="settings">
        <header>
          <div>
            <p className="eyebrow">{board.space.name}</p>
            <h2>空间设置</h2>
          </div>
          <button className="icon-button" aria-label="关闭" onClick={onClose}>
            <X />
          </button>
        </header>
        <div className="settings-body">
          <nav className="settings-nav">
            <button
              className={section === 'space' ? 'active' : ''}
              onClick={() => setSection('space')}
            >
              <Sparkles size={16} />
              空间概览
            </button>
            <button
              className={section === 'members' ? 'active' : ''}
              onClick={() => setSection('members')}
            >
              <Users size={16} />
              成员与权限
            </button>
            <button
              className={section === 'statuses' ? 'active' : ''}
              onClick={() => setSection('statuses')}
            >
              <CircleDot size={16} />
              状态列
            </button>
            <button
              className={section === 'connection' ? 'active' : ''}
              onClick={() => setSection('connection')}
            >
              <Wifi size={16} />
              连接与设备
            </button>
          </nav>
          <div className="settings-content">
            {section === 'space' && (
              <>
                <h3>空间信息</h3>
                <p className="muted">任务空间用来隔离工作、个人或团队数据。</p>
                <label className="form-label">
                  名称
                  <input
                    disabled={!canEditSpace}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <div className="field-grid">
                  <label className="form-label">
                    图标
                    <input
                      disabled={!canEditSpace}
                      value={icon}
                      maxLength={8}
                      onChange={(event) => setIcon(event.target.value)}
                    />
                  </label>
                  <label className="form-label">
                    颜色
                    <input
                      type="color"
                      disabled={!canEditSpace}
                      value={color}
                      onChange={(event) => setColor(event.target.value)}
                    />
                  </label>
                </div>
                <label className="form-label">
                  空间说明
                  <textarea
                    disabled={!canEditSpace}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                  />
                </label>
                <label className="form-label">
                  主题
                  <div className="segmented">
                    {(['system', 'light', 'dark'] as const).map((t) => (
                      <button
                        key={t}
                        className={theme === t ? 'selected' : ''}
                        onClick={() => onTheme(t)}
                      >
                        {t === 'system' ? '跟随系统' : t === 'light' ? '浅色' : '深色'}
                      </button>
                    ))}
                  </div>
                </label>
                <button className="button primary" disabled={!canEditSpace} onClick={saveSpace}>
                  保存更改
                </button>
                {!offline && (
                  <SpaceActions
                    key={`${board.space.version}-${board.statuses.map((status) => status.id).join('-')}`}
                    board={board}
                    demo={demo}
                    onRefresh={onRefresh}
                    onNotice={onNotice}
                  />
                )}
              </>
            )}
            {section === 'members' && !offline && (
              <Members
                members={board.members}
                spaceId={board.space.id}
                currentRole={board.space.role}
                onRefresh={onRefresh}
                onNotice={onNotice}
                demo={demo}
              />
            )}{' '}
            {section === 'statuses' && !offline && (
              <Statuses
                key={`${board.space.version}-${board.statuses.map((s) => s.id).join('-')}`}
                board={board}
                demo={demo}
                adding={adding}
                setAdding={setAdding}
                onNotice={onNotice}
                onRefresh={onRefresh}
              />
            )}{' '}
            {section === 'connection' && (
              <ConnectionSettings demo={demo} onNotice={onNotice} onLogout={onLogout} />
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
function Members({
  members,
  spaceId,
  currentRole,
  onRefresh,
  onNotice,
  demo,
}: {
  members: Member[];
  spaceId: string;
  currentRole: string;
  onRefresh: () => void;
  onNotice: (s: string) => void;
  demo: boolean;
}) {
  const [invite, setInvite] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('editor');
  const canManage = currentRole === 'owner' || currentRole === 'admin';
  const inviteMember = async () => {
    if (demo) return onNotice('演示模式：一次性邀请链接已创建。');
    try {
      const result = await api.invite(spaceId, { email: email || null, role, expiresInHours: 72 });
      const link = `${location.origin}${location.pathname}#invite=${encodeURIComponent(result.token)}`;
      await navigator.clipboard?.writeText(link);
      onNotice('邀请链接已复制，可安全发送给成员。');
      setInvite(false);
    } catch (e) {
      onNotice(e instanceof Error ? e.message : '创建邀请失败');
    }
  };
  const update = async (userId: string, next: string) => {
    if (demo) return onNotice('演示模式：角色已更新。');
    try {
      await api.updateMember(spaceId, userId, next);
      onRefresh();
    } catch (e) {
      onNotice(e instanceof Error ? e.message : '更新角色失败');
    }
  };
  const remove = async (userId: string) => {
    if (demo) return onNotice('演示模式：成员访问已撤销。');
    try {
      await api.removeMember(spaceId, userId);
      onRefresh();
    } catch (e) {
      onNotice(e instanceof Error ? e.message : '移除成员失败');
    }
  };
  return (
    <>
      <div className="settings-title">
        <div>
          <h3>成员</h3>
          <p className="muted">角色决定可查看、编辑和管理的范围。</p>
        </div>
        <button className="button primary" disabled={!canManage} onClick={() => setInvite(true)}>
          <Plus size={15} />
          邀请成员
        </button>
      </div>
      {invite && (
        <div className="add-status">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="可选：限制邀请邮箱"
          />
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="admin">管理员</option>
            <option value="editor">编辑者</option>
            <option value="viewer">只读</option>
          </select>
          <button className="button primary" onClick={inviteMember}>
            复制链接
          </button>
        </div>
      )}
      <div className="members">
        {members.map((m) => (
          <div className="member" key={m.id}>
            <span className="avatar">{initials(m.name)}</span>
            <div>
              <b>{m.name}</b>
              <small>{m.email}</small>
            </div>
            <select
              value={m.role}
              disabled={m.role === 'owner' || !canManage}
              onChange={(e) => update(m.id, e.target.value)}
            >
              <option value="owner">所有者</option>
              <option value="admin">管理员</option>
              <option value="editor">编辑者</option>
              <option value="viewer">只读</option>
            </select>
            {m.role !== 'owner' && canManage && (
              <button className="icon-button" title="移除成员" onClick={() => remove(m.id)}>
                <X size={15} />
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="callout">
        <LockKeyhole size={16} />
        <span>邀请仅能使用一次并会过期。空间权限同时保护搜索、订阅和 Agent 工具。</span>
      </div>
    </>
  );
}
function Statuses({
  board,
  demo,
  adding,
  setAdding,
  onNotice,
  onRefresh,
}: {
  board: Board;
  demo: boolean;
  adding: boolean;
  setAdding: (v: boolean) => void;
  onNotice: (s: string) => void;
  onRefresh: () => void;
}) {
  const [newName, setNewName] = useState('');
  const [semantic, setSemantic] = useState<Semantic>('todo');
  const add = async () => {
    if (!newName.trim()) return;
    try {
      if (!demo)
        await api.createStatus(board.space.id, {
          name: newName,
          semantic,
          position: board.statuses.length + 1,
          color: '#7c6df2',
        });
      setAdding(false);
      onRefresh();
    } catch (e) {
      onNotice(e instanceof Error ? e.message : '添加失败');
    }
  };
  return (
    <>
      <div className="settings-title">
        <div>
          <h3>状态列</h3>
          <p className="muted">名称可自定义；语义会保持稳定，供成员和 Agent 共用。</p>
        </div>
        <button className="button primary" onClick={() => setAdding(true)}>
          <Plus size={15} />
          添加状态
        </button>
      </div>
      <div className="statuses">
        {board.statuses.map((s) => (
          <StatusEditor
            key={s.id}
            status={s}
            all={board.statuses}
            demo={demo}
            onNotice={onNotice}
            onRefresh={onRefresh}
          />
        ))}
      </div>
      {adding && (
        <div className="add-status">
          <input
            autoFocus
            placeholder="状态名称"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <select value={semantic} onChange={(e) => setSemantic(e.target.value as Semantic)}>
            {Object.entries(semanticName).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <button className="button primary" onClick={add}>
            添加
          </button>
        </div>
      )}
      <div className="callout">
        <Archive size={16} />
        <span>删除状态会明确将全部任务迁移到选定列。</span>
      </div>
    </>
  );
}
function StatusEditor({
  status,
  all,
  demo,
  onNotice,
  onRefresh,
}: {
  status: Status;
  all: Status[];
  demo: boolean;
  onNotice: (s: string) => void;
  onRefresh: () => void;
}) {
  const [name, setName] = useState(status.name);
  const [target, setTarget] = useState(all.find((s) => s.id !== status.id)?.id ?? '');
  const save = async () => {
    try {
      if (!demo) await api.patchStatus(status.id, { name });
      onRefresh();
    } catch (e) {
      onNotice(e instanceof Error ? e.message : '更新状态失败');
    }
  };
  const remove = async () => {
    if (!target) return;
    try {
      if (!demo) await api.deleteStatus(status.id, target);
      onRefresh();
    } catch (e) {
      onNotice(e instanceof Error ? e.message : '删除状态失败');
    }
  };
  return (
    <div className="status-row">
      <GripVertical size={16} />
      <i className="status-dot" style={{ background: status.color }} />
      <input
        aria-label={`${status.name} 状态名称`}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={save}
      />
      <span>{semanticName[status.semantic]}</span>
      <select aria-label="迁移到" value={target} onChange={(e) => setTarget(e.target.value)}>
        {all
          .filter((s) => s.id !== status.id)
          .map((s) => (
            <option key={s.id} value={s.id}>
              迁移到：{s.name}
            </option>
          ))}
      </select>
      <button className="icon-button" title="删除状态" disabled={!target} onClick={remove}>
        <Archive size={15} />
      </button>
    </div>
  );
}

function Onboarding({ error }: { error?: string }) {
  const hash = new URLSearchParams(location.hash.slice(1));
  const inviteToken = hash.get('invite');
  const recoveryToken = hash.get('recovery');
  if (inviteToken) return <InviteAccept token={inviteToken} />;
  if (recoveryToken) return <RecoveryComplete token={recoveryToken} />;
  const screen = 'login';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(error ?? '');
  const desktop = hasLocalCompanion();
  const [desktopReady, setDesktopReady] = useState(!desktop);
  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!desktopReady) {
      setMessage('请先保存服务器地址，再登录。');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      await api.login({
        email,
        password,
        deviceName: navigator.userAgent.includes('Windows') ? 'Windows 桌面端' : '浏览器',
      });
      location.reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '登录失败');
      setBusy(false);
    }
  };
  return (
    <main className="onboarding">
      <div className="onboard-side">
        <div className="brand">
          <Sparkles size={19} />
          <span>taskboard</span>
        </div>
        <div className="onboard-copy">
          <p className="eyebrow">为 Codex 而生</p>
          <h1>
            让每次执行
            <br />
            都有清晰的下一步。
          </h1>
          <p>任务属于共享看板，项目与会话仍由 Codex 管理。跨设备同步上下文和验收结果。</p>
        </div>
        <div className="mini-cards">
          <span>
            <CheckCircle2 />
            空间级权限
          </span>
          <span>
            <Cloud />
            实时同步
          </span>
          <span>
            <Command />
            Codex 草稿
          </span>
        </div>
      </div>
      <div className="onboard-main">
        <div className="onboard-card">
          <div className="stepper">
            <span className={screen === 'login' ? 'current' : ''}>1</span>
            <i />
            <span>2</span>
          </div>
          <p className="eyebrow">欢迎回来</p>
          <h2>连接你的任务空间</h2>
          <p className="muted">使用管理员或邀请创建的账号登录。</p>
          {desktop && (
            <DesktopServerSetup
              onReadyChange={setDesktopReady}
              disabled={busy}
              onSaved={() => {
                setPassword('');
                setMessage('');
              }}
            />
          )}
          <form onSubmit={login}>
            <label className="form-label">
              邮箱
              <input
                autoComplete="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </label>
            <label className="form-label">
              密码
              <input
                autoComplete="current-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="至少 12 个字符"
                required
              />
            </label>
            {message && <p className="form-error">{message}</p>}
            <button className="button primary wide" disabled={busy || !desktopReady}>
              {busy && <LoaderCircle className="spin" size={15} />}登录并继续
            </button>
          </form>
          <button
            className="demo-link"
            onClick={() => (location.href = `${location.pathname}?demo=1`)}
          >
            先查看交互演示 <ArrowUpRight size={14} />
          </button>
        </div>
      </div>
    </main>
  );
}
function AuthFrame({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="onboarding">
      <div className="onboard-side">
        <div className="brand">
          <Sparkles size={19} />
          <span>taskboard</span>
        </div>
        <div className="onboard-copy">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>此操作仅会变更当前账号或加入指定的任务空间。</p>
        </div>
      </div>
      <div className="onboard-main">
        <div className="onboard-card">{children}</div>
      </div>
    </main>
  );
}
function InviteAccept({ token }: { token: string }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.acceptInvitation(token, name, email, password);
      location.hash = '';
      location.reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '无法接受邀请');
      setSaving(false);
    }
  };
  return (
    <AuthFrame eyebrow="空间邀请" title="加入任务空间">
      <p className="muted">创建账号后即可查看受邀请空间中的任务。</p>
      <form onSubmit={submit}>
        <label className="form-label">
          姓名
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="form-label">
          邮箱
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="form-label">
          设置密码
          <input
            type="password"
            minLength={12}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {message && <p className="form-error">{message}</p>}
        <button className="button primary wide" disabled={saving}>
          {saving && <LoaderCircle className="spin" size={15} />}接受邀请
        </button>
      </form>
    </AuthFrame>
  );
}
function RecoveryComplete({ token }: { token: string }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) return setMessage('两次输入的密码不一致');
    setSaving(true);
    try {
      await api.completeRecovery(token, password);
      location.replace(location.pathname);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '恢复失败');
      setSaving(false);
    }
  };
  return (
    <AuthFrame eyebrow="账号恢复" title="设置新密码">
      <form onSubmit={submit}>
        <label className="form-label">
          新密码
          <input
            type="password"
            minLength={12}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <label className="form-label">
          确认新密码
          <input
            type="password"
            minLength={12}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </label>
        {message && <p className="form-error">{message}</p>}
        <button className="button primary wide" disabled={saving}>
          {saving && <LoaderCircle className="spin" size={15} />}完成恢复
        </button>
      </form>
    </AuthFrame>
  );
}
function ConflictDialog({
  conflict,
  onClose,
  onKeep,
  onReload,
}: {
  conflict: { task: Task; changes: Partial<Task> };
  onClose: () => void;
  onKeep: () => void;
  onReload: () => void;
}) {
  return (
    <Modal title="发现更新冲突" onClose={onClose}>
      <p>
        “{conflict.task.title}”刚刚在另一台设备上被修改。为了避免覆盖他人的更改，本次修改尚未同步。
      </p>
      <div className="conflict-box">
        <b>你的草稿会保留在此设备</b>
        <small>重新加载可查看最新版本；之后可手动合并并再次保存。</small>
      </div>
      <div className="modal-actions">
        <button className="button ghost" onClick={onKeep}>
          保留草稿
        </button>
        <button className="button primary" onClick={onReload}>
          重新加载
        </button>
      </div>
    </Modal>
  );
}
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="modal-backdrop" />
        <Dialog.Content className="modal">
          <header>
            <Dialog.Title asChild>
              <h2>{title}</h2>
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="icon-button" aria-label="关闭" onClick={onClose}>
                <X size={18} />
              </button>
            </Dialog.Close>
          </header>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={query}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
