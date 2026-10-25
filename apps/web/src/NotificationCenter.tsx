import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Bell, Check, Clock3, X } from 'lucide-react';
import type { NotificationPreferences, TaskNotification } from '@taskboard/core';
import type { Space } from './types';
import { request } from './api';
import { notificationPermission } from './desktopNotifications';
import { groupNotifications, type NotificationInbox } from './useNotificationInbox';

export function NotificationCenter({
  open,
  onClose,
  inbox,
  spaces,
  spaceId,
  offline,
  onOpen,
}: {
  open: boolean;
  onClose: () => void;
  inbox: NotificationInbox;
  spaces: Space[];
  spaceId: string;
  offline: boolean;
  onOpen: (taskId: string, spaceId: string) => void;
}) {
  const [scope, setScope] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread' | 'unhandled' | 'later'>('all');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const visible = inbox.items.filter(
    (item) =>
      (!scope || item.spaceId === scope) &&
      (filter === 'unread'
        ? !item.readAt
        : filter === 'unhandled'
          ? !item.handledAt
          : filter === 'later'
            ? !!item.snoozedUntil && Date.parse(item.snoozedUntil) > Date.now()
            : true),
  );
  const groups = groupNotifications(visible, inbox.preferences.data ?? []);
  const act = async (ids: string[], action: 'read' | 'handle' | 'snooze', until?: string) => {
    setBusy(true);
    setError('');
    try {
      for (const id of ids)
        await request(`/me/notifications/${id}/${action}`, {
          method: 'POST',
          body: action === 'snooze' ? { until } : {},
        });
      if (action === 'snooze') inbox.resetReminder(ids);
      await inbox.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : '通知操作失败');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="workflow-backdrop motion-scrim" />
        <Dialog.Content
          className="workflow-sheet motion-drawer"
          aria-describedby="inbox-description"
        >
          <header className="workflow-header">
            <div>
              <Dialog.Title>
                <Bell size={22} />
                收件箱
              </Dialog.Title>
              <Dialog.Description id="inbox-description">
                未读、处理和稍后提醒彼此独立；已读可稍后提醒，已处理不再提醒。请求系统提醒不会自动标为已读。
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button className="icon-button" aria-label="关闭收件箱">
                <X />
              </button>
            </Dialog.Close>
          </header>
          <div className="workflow-body">
            <div className="workflow-toolbar">
              <label>
                空间
                <select
                  aria-label="通知空间"
                  value={scope}
                  onChange={(event) => setScope(event.target.value)}
                >
                  <option value="">全部有权空间</option>
                  {spaces.map((space) => (
                    <option key={space.id} value={space.id}>
                      {space.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                状态
                <select
                  aria-label="通知状态"
                  value={filter}
                  onChange={(event) => setFilter(event.target.value as typeof filter)}
                >
                  <option value="all">全部</option>
                  <option value="unread">未读</option>
                  <option value="unhandled">未处理</option>
                  <option value="later">稍后提醒</option>
                </select>
              </label>
              <button
                className="button ghost"
                disabled={offline || inbox.query.isFetching}
                onClick={() => inbox.refresh()}
              >
                刷新收件箱
              </button>
            </div>
            {offline && (
              <p className="workflow-warning">
                离线仅展示本窗口已加载的通知，不能确认当前权限；已暂停系统提醒和所有写入，恢复连接后会重新读取。
              </p>
            )}
            {inbox.query.isPending && !offline && <p role="status">正在读取通知…</p>}
            {inbox.query.error && (
              <p className="form-error" role="alert">
                读取通知失败：{inbox.query.error.message}
                <button
                  className="text-button"
                  disabled={offline}
                  onClick={() => inbox.query.refetch()}
                >
                  重试读取
                </button>
              </p>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
                <button className="text-button" onClick={() => setError('')}>
                  知道了
                </button>
              </p>
            )}
            {!inbox.query.isPending && !inbox.query.isError && groups.length === 0 && (
              <div className="workflow-empty">
                <Check size={24} />
                <h3>这里暂时没有通知</h3>
                <p>任务分配、提及、验收与规则提醒会保留在这里。</p>
              </div>
            )}
            <div className="notification-list">
              {groups.map((group) => (
                <NotificationGroup
                  key={group[0].id}
                  group={group}
                  spaceName={
                    spaces.find((space) => space.id === group[0].spaceId)?.name ?? '任务空间'
                  }
                  disabled={offline || busy}
                  onOpen={(item) => {
                    if (item.taskId) {
                      onClose();
                      onOpen(item.taskId, item.spaceId);
                    }
                  }}
                  onAction={act}
                />
              ))}
            </div>
            {inbox.query.hasNextPage && (
              <button
                className="button ghost"
                disabled={offline || inbox.query.isFetchingNextPage}
                onClick={() => inbox.query.fetchNextPage()}
              >
                {inbox.query.isFetchingNextPage ? '正在加载…' : '加载更早通知'}
              </button>
            )}
            <details className="notification-settings">
              <summary>空间提醒设置</summary>
              <p className="muted">
                静音只抑制系统提醒，收件箱保留全部事件。合并仅影响呈现，可展开查看每条通知。
              </p>
              <PreferenceEditor
                key={scope || spaceId}
                spaceId={scope || spaceId}
                spaces={spaces}
                preferences={inbox.preferences.data ?? []}
                permission={inbox.permission}
                disabled={offline || busy}
                onPermission={inbox.setPermission}
                onRefresh={inbox.refresh}
              />
              {inbox.preferences.error && (
                <p className="form-error">
                  设置读取失败：{inbox.preferences.error.message}
                  <button className="text-button" onClick={() => inbox.preferences.refetch()}>
                    重试设置
                  </button>
                </p>
              )}
            </details>
            {inbox.deliveryCandidates.error && (
              <p className="form-error">
                系统提醒候选读取失败：{inbox.deliveryCandidates.error.message}
                <button
                  className="text-button"
                  disabled={offline}
                  onClick={() => inbox.deliveryCandidates.refetch()}
                >
                  重试提醒候选
                </button>
              </p>
            )}
            {(inbox.deliveryError || inbox.deliveryMessage) && (
              <div className="delivery-status" role="status">
                {inbox.deliveryError ? (
                  <>
                    <p className="form-error">{inbox.deliveryError}</p>
                    <button
                      className="button ghost"
                      disabled={offline}
                      onClick={inbox.retryDelivery}
                    >
                      重试投递 / 回执
                    </button>
                  </>
                ) : (
                  <p className="muted">{inbox.deliveryMessage}</p>
                )}
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function NotificationGroup({
  group,
  spaceName,
  disabled,
  onOpen,
  onAction,
}: {
  group: TaskNotification[];
  spaceName: string;
  disabled: boolean;
  onOpen: (item: TaskNotification) => void;
  onAction: (ids: string[], action: 'read' | 'handle' | 'snooze', until?: string) => Promise<void>;
}) {
  const first = group[0];
  const unread = group.filter((item) => !item.readAt).length;
  const [laterMinutes, setLaterMinutes] = useState('60');
  const render = (item: TaskNotification) => (
    <article key={item.id} className={`notification-event${!item.readAt ? ' is-unread' : ''}`}>
      <div className="notification-meta">
        <span>{spaceName}</span>
        <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time>
      </div>
      <h3>{item.title}</h3>
      <p>{item.body || '任务状态有更新，请打开任务核对。'}</p>
      <div className="notification-flags">
        <span>{item.readAt ? '已读' : '未读'}</span>
        <span>{item.handledAt ? '已处理' : '未处理'}</span>
        {item.snoozedUntil && (
          <span>
            <Clock3 size={13} />
            {Date.parse(item.snoozedUntil) > Date.now() ? '稍后至' : '曾稍后至'}{' '}
            {new Date(item.snoozedUntil).toLocaleString()}
          </span>
        )}
        {item.deliveredAt && <span>已请求系统提醒</span>}
      </div>
      <div className="workflow-actions">
        {item.taskId && (
          <button className="button ghost" onClick={() => onOpen(item)}>
            打开任务
          </button>
        )}
        {!item.readAt && (
          <button
            className="text-button"
            disabled={disabled}
            onClick={() => onAction([item.id], 'read')}
          >
            标为已读
          </button>
        )}
        {!item.handledAt && (
          <button
            className="text-button"
            disabled={disabled}
            onClick={() => onAction([item.id], 'handle')}
          >
            标为已处理
          </button>
        )}
        <label className="snooze-control">
          稍后
          <select
            aria-label={`稍后提醒 ${item.title}`}
            value={laterMinutes}
            disabled={disabled || !!item.handledAt}
            onChange={(event) => setLaterMinutes(event.target.value)}
          >
            <option value="1">1 分钟（重新提醒）</option>
            <option value="15">15 分钟</option>
            <option value="60">1 小时</option>
            <option value="1440">24 小时</option>
          </select>
        </label>
        <button
          className="text-button"
          disabled={disabled || !!item.handledAt}
          onClick={() =>
            onAction(
              [item.id],
              'snooze',
              new Date(Date.now() + Number(laterMinutes) * 60000).toISOString(),
            )
          }
        >
          设置稍后
        </button>
      </div>
    </article>
  );
  return group.length === 1 ? (
    render(first)
  ) : (
    <details className="notification-group">
      <summary>
        <span>
          <strong>{first.title}</strong>
          <small>
            {spaceName} · {group.length} 条更新{unread ? `，${unread} 条未读` : ''}
          </small>
        </span>
        <span>展开全部事件</span>
      </summary>
      {group.map(render)}
    </details>
  );
}

function PreferenceEditor({
  spaceId,
  spaces,
  preferences,
  permission,
  disabled,
  onPermission,
  onRefresh,
}: {
  spaceId: string;
  spaces: Space[];
  preferences: NotificationPreferences[];
  permission: 'granted' | 'denied' | 'prompt' | 'unsupported';
  disabled: boolean;
  onPermission: (value: 'granted' | 'denied' | 'prompt' | 'unsupported') => void;
  onRefresh: () => Promise<void>;
}) {
  const server = preferences.find((value) => value.spaceId === spaceId);
  const [merge, setMerge] = useState(server?.mergeWindowSeconds ?? 60);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!dirty) setMerge(server?.mergeWindowSeconds ?? 60);
  }, [server?.mergeWindowSeconds, dirty]);
  const save = async (
    changes: Partial<
      Pick<NotificationPreferences, 'mutedUntil' | 'desktopEnabled' | 'mergeWindowSeconds'>
    >,
  ) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await request(`/me/notification-preferences/${spaceId}`, {
        method: 'PUT',
        body: {
          mutedUntil: server?.mutedUntil ?? null,
          desktopEnabled: server?.desktopEnabled ?? false,
          mergeWindowSeconds: merge,
          ...changes,
        },
      });
      setDirty(false);
      await onRefresh();
      setMessage('提醒设置已保存');
    } catch (error) {
      setError(error instanceof Error ? error.message : '保存设置失败');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="preference-editor">
      <h3>{spaces.find((space) => space.id === spaceId)?.name ?? '当前空间'}</h3>
      <p>
        {server?.mutedUntil && Date.parse(server.mutedUntil) > Date.now()
          ? `静音至 ${new Date(server.mutedUntil).toLocaleString()}`
          : '未静音'}{' '}
        · {server?.desktopEnabled ? '已启用系统提醒' : '系统提醒未启用'}
      </p>
      <div className="workflow-actions">
        <button
          className="button ghost"
          disabled={disabled || busy}
          onClick={() => save({ mutedUntil: new Date(Date.now() + 3600000).toISOString() })}
        >
          静音 1 小时
        </button>
        <button
          className="button ghost"
          disabled={disabled || busy}
          onClick={() => save({ mutedUntil: new Date(Date.now() + 86400000).toISOString() })}
        >
          静音 24 小时
        </button>
        <button
          className="text-button"
          disabled={disabled || busy || !server?.mutedUntil}
          onClick={() => save({ mutedUntil: null })}
        >
          取消静音
        </button>
      </div>
      <div className="workflow-actions">
        <button
          className="button primary"
          disabled={disabled || busy}
          onClick={async () => {
            setError('');
            try {
              const result = await notificationPermission(true);
              onPermission(result);
              if (result !== 'granted') {
                setError(
                  result === 'unsupported'
                    ? '当前环境不支持系统提醒；可在 Taskboard 桌面主窗口或安全浏览器中启用。收件箱仍可使用。'
                    : '系统通知权限未获允许，请到系统或浏览器设置中调整，再点击重试。',
                );
                return;
              }
              await save({ desktopEnabled: true });
            } catch (error) {
              setError(error instanceof Error ? error.message : '启用提醒失败');
            }
          }}
        >
          {server?.desktopEnabled && permission === 'granted'
            ? '重新检查此设备通知权限'
            : '启用此设备系统提醒'}
        </button>
        {server?.desktopEnabled && (
          <button
            className="button ghost"
            disabled={disabled || busy}
            onClick={() => save({ desktopEnabled: false })}
          >
            关闭此空间系统提醒
          </button>
        )}
      </div>
      <p className="muted">
        权限状态：
        {permission === 'granted'
          ? '提醒 API 可调用'
          : permission === 'denied'
            ? '已拒绝'
            : permission === 'unsupported'
              ? '此环境不支持'
              : '等待启用'}
        。Windows 专注助手、系统设置或开发环境归属可能使提醒不显示；API
        调用成功不等于系统已显示或用户已看到。
      </p>
      <label>
        合并时间窗口（秒，0 表示逐条展示）
        <input
          type="number"
          min={0}
          max={3600}
          value={merge}
          disabled={disabled || busy}
          onChange={(event) => {
            setDirty(true);
            setMerge(Number(event.target.value));
          }}
        />
      </label>
      <button
        className="button ghost"
        disabled={
          disabled || busy || !dirty || !Number.isInteger(merge) || merge < 0 || merge > 3600
        }
        onClick={() => save({ mergeWindowSeconds: merge })}
      >
        保存合并设置
      </button>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
