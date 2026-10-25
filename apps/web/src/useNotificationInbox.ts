import { useEffect, useRef, useState } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NotificationPreferences, TaskNotification } from '@taskboard/core';
import { request, ApiError } from './api';
import { notificationPermission, sendDesktopNotification } from './desktopNotifications';

export function groupNotifications(
  items: TaskNotification[],
  preferences: NotificationPreferences[],
) {
  const groups: TaskNotification[][] = [];
  for (const item of [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
    const seconds =
      preferences.find((value) => value.spaceId === item.spaceId)?.mergeWindowSeconds ?? 60;
    const group =
      seconds > 0
        ? groups.find(
            (candidate) =>
              candidate[0].spaceId === item.spaceId &&
              candidate[0].groupKey === item.groupKey &&
              Math.abs(Date.parse(candidate[0].createdAt) - Date.parse(item.createdAt)) <=
                seconds * 1000,
          )
        : undefined;
    if (group) group.push(item);
    else groups.push([item]);
  }
  return groups;
}

export function useNotificationInbox({
  userId,
  enabled,
  offline,
  onOpen,
}: {
  userId?: string;
  enabled: boolean;
  offline: boolean;
  onOpen: (taskId: string, spaceId: string) => void;
}) {
  const client = useQueryClient();
  const [deliveryError, setDeliveryError] = useState('');
  const [deliveryMessage, setDeliveryMessage] = useState('');
  const [permission, setPermission] = useState<'granted' | 'denied' | 'prompt' | 'unsupported'>(
    'prompt',
  );
  const [retry, setRetry] = useState(0);
  const [pollTime, setPollTime] = useState(Date.now());
  const pendingAck = useRef(new Map<string, string>());
  const cooldown = useRef(new Map<string, number>());
  const active = useRef(false);
  const generation = useRef(0);
  const account = useRef(userId);
  account.current = userId;
  const latestOpen = useRef(onOpen);
  latestOpen.current = onOpen;
  const query = useInfiniteQuery({
    queryKey: ['notifications', userId],
    enabled: enabled && !!userId && !offline,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const value = await request<{ items: TaskNotification[]; nextCursor: string | null }>(
        `/me/notifications${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ''}`,
      );
      if (!value || !Array.isArray(value.items)) throw new Error('服务器未提供兼容的通知接口');
      return value;
    },
    getNextPageParam: (page) => page.nextCursor,
    refetchInterval: enabled && !offline ? 15000 : false,
  });
  const preferences = useQuery({
    queryKey: ['notification-preferences', userId],
    enabled: enabled && !!userId && !offline,
    queryFn: async () => {
      const value = await request<NotificationPreferences[]>('/me/notification-preferences');
      if (!Array.isArray(value)) throw new Error('服务器未提供兼容的通知设置接口');
      return value;
    },
    refetchInterval: enabled && !offline ? 30000 : false,
  });
  const deliveryCandidates = useQuery({
    queryKey: ['notification-delivery-candidates', userId],
    enabled: enabled && !!userId && !offline && permission === 'granted',
    queryFn: async () => {
      const value = await request<{ items: TaskNotification[]; nextCursor: null }>(
        '/me/notifications?deliverable=true&limit=50',
      );
      if (!value || !Array.isArray(value.items)) throw new Error('服务器未提供兼容的提醒候选接口');
      return value;
    },
    refetchInterval: enabled && !offline && permission === 'granted' ? 15000 : false,
  });
  const items =
    query.error instanceof ApiError && [401, 403].includes(query.error.status)
      ? []
      : Array.from(
          new Map(
            (query.data?.pages.flatMap((page) => page.items) ?? []).map((item) => [item.id, item]),
          ).values(),
        );
  useEffect(() => {
    generation.current++;
    pendingAck.current.clear();
    cooldown.current.clear();
    active.current = false;
    setDeliveryError('');
    setDeliveryMessage('');
    if (!enabled) return;
    void notificationPermission()
      .then(setPermission)
      .catch(() => setPermission('unsupported'));
  }, [userId, enabled]);
  useEffect(() => {
    generation.current++;
    active.current = false;
  }, [offline]);
  useEffect(() => {
    if (!enabled) return;
    const refresh = () => {
      if (!document.hidden && navigator.onLine) {
        void client.invalidateQueries({ queryKey: ['notifications', userId] });
        void client.invalidateQueries({ queryKey: ['notification-preferences', userId] });
        void client.invalidateQueries({ queryKey: ['notification-delivery-candidates', userId] });
        setPollTime(Date.now());
        void notificationPermission()
          .then(setPermission)
          .catch(() => undefined);
      }
    };
    const timer = setInterval(() => setPollTime(Date.now()), 15000);
    addEventListener('online', refresh);
    addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(timer);
      removeEventListener('online', refresh);
      removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [client, userId, enabled]);
  useEffect(() => {
    if (
      !enabled ||
      offline ||
      !userId ||
      permission !== 'granted' ||
      active.current ||
      !preferences.data ||
      query.isError ||
      preferences.isError ||
      deliveryCandidates.isError
    )
      return;
    const token = generation.current;
    const current = () => token === generation.current;
    const deliver = async () => {
      active.current = true;
      try {
        for (const [id, deliveryToken] of pendingAck.current) {
          if (!current()) return;
          try {
            await request(`/me/notifications/${id}/delivered`, {
              method: 'POST',
              body: { deliveryToken },
            });
            pendingAck.current.delete(id);
          } catch (error) {
            if (error instanceof ApiError && error.code === 'DELIVERY_LEASE_EXPIRED') {
              pendingAck.current.delete(id);
              continue;
            }
            if (current())
              setDeliveryError(
                `已向系统请求提醒，但请求回执未同步：${error instanceof Error ? error.message : '网络失败'}。重试只补回执。`,
              );
          }
        }
        const now = Date.now();
        const eligible = (deliveryCandidates.data?.items ?? []).filter((item) => {
          const pref = preferences.data.find((entry) => entry.spaceId === item.spaceId);
          return (
            pref?.desktopEnabled &&
            (!pref.mutedUntil || Date.parse(pref.mutedUntil) <= now) &&
            !item.deliveredAt &&
            (!item.readAt || !!item.snoozedUntil) &&
            !item.handledAt &&
            (!item.snoozedUntil || Date.parse(item.snoozedUntil) <= now) &&
            !pendingAck.current.has(item.id) &&
            (cooldown.current.get(item.id) ?? 0) <= now
          );
        });
        for (const group of groupNotifications(eligible, preferences.data).slice(0, 3)) {
          if (!current()) return;
          const claimed: (TaskNotification & { deliveryToken: string })[] = [];
          for (const item of group) {
            cooldown.current.set(item.id, now + 65000);
            try {
              const lease = await request<{ deliveryToken: string }>(
                `/me/notifications/${item.id}/delivery`,
                { method: 'POST', body: {} },
              );
              if (typeof lease.deliveryToken !== 'string')
                throw new Error('服务器未返回提醒轮次，请升级服务端后重试');
              claimed.push({ ...item, deliveryToken: lease.deliveryToken });
            } catch (error) {
              if (
                !(
                  error instanceof ApiError &&
                  ['DELIVERY_CLAIMED', 'NOTIFICATION_MUTED'].includes(error.code)
                ) &&
                current()
              )
                setDeliveryError(error instanceof Error ? error.message : '领取桌面提醒失败');
            }
          }
          if (!claimed.length || !current()) continue;
          const first = claimed[0];
          try {
            await sendDesktopNotification(
              claimed.length > 1 ? `${first.title}（${claimed.length} 条更新）` : first.title,
              claimed.length > 1 ? '更新详情保留在 Codex Taskboard 收件箱。' : first.body,
              () => {
                if (first.taskId) latestOpen.current(first.taskId, first.spaceId);
              },
            );
            if (account.current === userId)
              claimed.forEach((item) => pendingAck.current.set(item.id, item.deliveryToken));
            if (!current()) return;
            setDeliveryMessage('已向系统请求提醒；显示由系统决定，不会自动标为已读。');
            for (const item of claimed) {
              try {
                await request(`/me/notifications/${item.id}/delivered`, {
                  method: 'POST',
                  body: { deliveryToken: item.deliveryToken },
                });
                pendingAck.current.delete(item.id);
              } catch (error) {
                if (error instanceof ApiError && error.code === 'DELIVERY_LEASE_EXPIRED') {
                  pendingAck.current.delete(item.id);
                  continue;
                }
                if (current())
                  setDeliveryError(
                    `已请求系统提醒，回执尚未同步：${error instanceof Error ? error.message : '网络失败'}。`,
                  );
              }
            }
          } catch (error) {
            if (current())
              setDeliveryError(
                `${error instanceof Error ? error.message : '桌面提醒失败'}；持久通知仍在收件箱，1 分钟后可重试。`,
              );
          }
        }
      } finally {
        if (current()) active.current = false;
      }
    };
    void deliver();
  }, [
    enabled,
    offline,
    userId,
    permission,
    preferences.data,
    query.data,
    query.isError,
    preferences.isError,
    deliveryCandidates.isError,
    deliveryCandidates.data,
    retry,
    pollTime,
  ]);
  const refresh = async () => {
    await Promise.all([query.refetch(), preferences.refetch(), deliveryCandidates.refetch()]);
  };
  return {
    query,
    preferences,
    deliveryCandidates,
    items,
    permission,
    setPermission,
    deliveryError,
    deliveryMessage,
    resetReminder: (ids: string[]) => {
      generation.current++;
      active.current = false;
      ids.forEach((id) => {
        cooldown.current.delete(id);
        pendingAck.current.delete(id);
      });
      setRetry((value) => value + 1);
    },
    retryDelivery: () => {
      setDeliveryError('');
      setRetry((value) => value + 1);
    },
    refresh,
  };
}
export type NotificationInbox = ReturnType<typeof useNotificationInbox>;
