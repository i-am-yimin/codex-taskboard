import { useEffect, useRef, useState } from 'react';
import {
  appearanceSchema,
  appearanceRecordSchema,
  defaultAppearance,
  themeManifestSchema,
  themePackageSchema,
  type Appearance,
  type AppearanceRecord,
  type ThemePackage,
} from '@taskboard/core';
import { ApiError, request } from './api';
import { companionKey, companionOrigin, hasLocalCompanion } from './companionBridge';
import { applyAppearance } from './themes';

type Pending = { value: Appearance; version: number; key: string };
type Saved = {
  value: AppearanceRecord;
  packages: ThemePackage[];
  pending?: Pending;
  syncedIds?: string[];
};
function initial(): Saved {
  const mode = localStorage.getItem('tb:theme');
  return {
    value: { ...defaultAppearance, mode: mode === 'light' || mode === 'dark' ? mode : 'system' },
    packages: [],
  };
}
export function useAppearance(accountId?: string, demo = false) {
  const [saved, setSaved] = useState<Saved>(initial);
  const [preview, setPreview] = useState<Appearance | null>(null);
  const [cloud, setCloud] = useState<AppearanceRecord | null>(null);
  const [status, setStatus] = useState('本机外观');
  const [busy, setBusy] = useState(false);
  const [storageKey, setStorageKey] = useState<string>();
  const current = useRef({ saved, preview, storageKey });
  current.current = { saved, preview, storageKey };
  const generation = useRef(0);
  const previewEpoch = useRef(0);
  const syncing = useRef(false);
  const cloudRef = useRef(cloud);
  cloudRef.current = cloud;
  const persist = (next: Saved) => {
    setSaved(next);
    current.current.saved = next;
    if (current.current.storageKey) {
      try {
        localStorage.setItem(current.current.storageKey, JSON.stringify(next));
      } catch {
        setStatus('本机存储空间不足；本次外观仅在当前窗口保留，请导出主题备份');
      }
    }
  };
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => applyAppearance(preview ?? saved.value, saved.packages, media.matches);
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [saved, preview]);

  // All async completions are pinned to this account/server generation.
  useEffect(() => {
    const token = ++generation.current;
    let stopped = false;
    setStorageKey(undefined);
    setSaved(initial());
    setPreview(null);
    setCloud(null);
    setBusy(false);
    setStatus(demo ? '演示模式：仅保存在本机' : '本机外观');
    const load = async () => {
      if (!accountId) return;
      let server = location.origin;
      if (hasLocalCompanion()) {
        const response = await fetch(`${companionOrigin()}/v1/browser/upstream`, {
          headers: { 'x-taskboard-companion-key': (await companionKey()) ?? '' },
        });
        if (!response.ok) throw new Error('无法确认当前服务器');
        server = (await response.json()).data.upstream;
      }
      if (stopped) return;
      const key = `tb:appearance:${encodeURIComponent(server)}:${accountId}`;
      let next = initial();
      try {
        const raw = JSON.parse(localStorage.getItem(key) ?? 'null');
        if (raw) {
          const value = appearanceSchema.parse({
            themeId: raw.value.themeId,
            mode: raw.value.mode,
            layout: raw.value.layout,
          });
          const packages: ThemePackage[] = raw.packages.map((p: ThemePackage) => ({
            id: p.id,
            manifest: themeManifestSchema.parse(p.manifest),
          }));
          next = {
            value: {
              ...value,
              version:
                Number.isInteger(raw.value.version) && raw.value.version > 0
                  ? raw.value.version
                  : 1,
            },
            packages,
          };
          next.syncedIds = Array.isArray(raw.syncedIds)
            ? raw.syncedIds.filter((id: unknown) => typeof id === 'string')
            : [];
          if (
            raw.pending &&
            Number.isInteger(raw.pending.version) &&
            raw.pending.version > 0 &&
            typeof raw.pending.key === 'string'
          )
            next.pending = {
              value: appearanceSchema.parse(raw.pending.value),
              version: raw.pending.version,
              key: raw.pending.key,
            };
        }
      } catch {
        localStorage.removeItem(key);
      }
      setStorageKey(key);
      current.current.storageKey = key;
      persist(next);
      await syncCloud(token);
    };
    void load().catch(() => {
      if (!stopped) setStatus('暂时无法读取主题配置，恢复连接后重试');
    });
    const refresh = () => {
      if (current.current.storageKey) void syncCloud(token);
    };
    const timer = setInterval(refresh, 30000);
    addEventListener('focus', refresh);
    addEventListener('online', refresh);
    return () => {
      stopped = true;
      generation.current++;
      clearInterval(timer);
      removeEventListener('focus', refresh);
      removeEventListener('online', refresh);
    };
    // Identity changes reset the controller; polling reads current state through refs.
  }, [accountId, demo]);

  async function upload(packages: ThemePackage[], themeId: string) {
    const selected = packages.find((p) => p.id === themeId);
    if (selected) await request('/me/themes', { method: 'POST', body: selected.manifest });
  }
  async function syncCloud(token = generation.current) {
    if (demo || !accountId || syncing.current || cloudRef.current) return;
    syncing.current = true;
    try {
      const remote = appearanceRecordSchema.parse(await request('/me/appearance'));
      const packages = themePackageSchema.array().parse(await request('/me/themes'));
      if (token !== generation.current) return;
      let local = current.current.saved;
      const merged = [
        ...packages,
        ...local.packages.filter(
          (p) =>
            (!local.syncedIds?.includes(p.id) || p.id === local.pending?.value.themeId) &&
            !packages.some((r) => r.id === p.id),
        ),
      ];
      if (local.pending) {
        persist({ ...local, packages: merged, syncedIds: packages.map((p) => p.id) });
        const pendingKey = local.pending.key;
        await upload(merged, local.pending.value.themeId);
        if (token !== generation.current) return;
        const value = appearanceRecordSchema.parse(
          await request('/me/appearance', {
            method: 'PUT',
            body: local.pending.value,
            version: local.pending.version,
            idempotencyKey: local.pending.key,
          }),
        );
        if (token !== generation.current) return;
        // Do not discard a newer local selection made while this request was in flight.
        local = current.current.saved;
        if (local.pending?.key !== pendingKey) return;
        persist({
          value,
          packages: merged,
          syncedIds: [...packages.map((p) => p.id), value.themeId],
        });
      } else if (current.current.preview && remote.version !== local.value.version) {
        setCloud(remote);
        setStatus('云端外观已变化；当前预览已保留');
        persist({ ...local, packages: merged, syncedIds: packages.map((p) => p.id) });
        return;
      } else {
        // A pristine server record must not erase a 0.1.4 light/dark preference.
        if (remote.version === 1 && local.value.mode !== 'system') {
          const pending = {
            value: appearanceSchema.parse({
              themeId: local.value.themeId,
              mode: local.value.mode,
              layout: local.value.layout,
            }),
            version: 1,
            key: crypto.randomUUID(),
          };
          persist({ ...local, packages: merged, pending });
          setStatus('原明暗偏好已保留，等待同步');
          return;
        }
        persist({ value: remote, packages: merged, syncedIds: packages.map((p) => p.id) });
      }
      setStatus('已同步到账号');
    } catch (error) {
      if (token !== generation.current) return;
      if (error instanceof ApiError && error.code === 'VERSION_CONFLICT') {
        const remote = await request<AppearanceRecord>('/me/appearance').catch(() => null);
        if (token !== generation.current) return;
        setCloud(remote);
        setStatus('其他设备已修改外观，请处理冲突');
      } else
        setStatus(
          error instanceof ApiError && error.status === 404
            ? '账号同步需要升级服务端；本机主题仍可使用'
            : current.current.saved.pending
              ? '已保存在本机，待同步'
              : '离线：使用本机外观',
        );
    } finally {
      syncing.current = false;
    }
  }
  async function apply(value = preview) {
    if (!value || busy) return;
    previewEpoch.current++;
    value = appearanceSchema.parse({
      themeId: value.themeId,
      mode: value.mode,
      layout: value.layout,
    });
    const token = generation.current;
    const local = current.current.saved;
    persist({
      ...local,
      value: { ...value, version: local.value.version },
      pending: demo
        ? undefined
        : {
            value,
            version: local.pending?.version ?? local.value.version,
            key: crypto.randomUUID(),
          },
    });
    setPreview(null);
    setBusy(true);
    try {
      await syncCloud(token);
    } finally {
      if (token === generation.current) setBusy(false);
    }
  }
  function addPackage(pack: ThemePackage) {
    persist({
      ...current.current.saved,
      packages: [...current.current.saved.packages.filter((p) => p.id !== pack.id), pack],
    });
    setPreview({ ...current.current.saved.value, themeId: pack.id });
  }
  async function removePackage(id: string) {
    previewEpoch.current++;
    const token = generation.current;
    setBusy(true);
    try {
      const value = demo
        ? {
            ...current.current.saved.value,
            themeId:
              current.current.saved.value.themeId === id
                ? 'glass'
                : current.current.saved.value.themeId,
          }
        : await request<AppearanceRecord>(`/me/themes/${id}`, { method: 'DELETE' });
      if (token !== generation.current) return;
      persist({ value, packages: current.current.saved.packages.filter((p) => p.id !== id) });
      setPreview(null);
      setCloud(null);
      setStatus(demo ? '已从本机移除主题' : '已从账号移除主题');
    } catch (e) {
      if (token === generation.current)
        setStatus(e instanceof Error ? e.message : '移除失败，请重试');
    } finally {
      if (token === generation.current) setBusy(false);
    }
  }
  return {
    value: preview ?? saved.value,
    packages: saved.packages,
    previewing: !!preview,
    cloud,
    status,
    busy,
    preview: (value: Appearance) => {
      previewEpoch.current++;
      setPreview(value);
    },
    cancel: () => {
      previewEpoch.current++;
      setPreview(null);
    },
    apply,
    addPackage,
    prepareImport: () => {
      const token = generation.current;
      const epoch = previewEpoch.current;
      return (pack: ThemePackage) => {
        if (token !== generation.current || epoch !== previewEpoch.current) return false;
        addPackage(pack);
        return true;
      };
    },
    removePackage,
    useCloud: () => {
      if (cloud) persist({ ...current.current.saved, pending: undefined, value: cloud });
      setPreview(null);
      setCloud(null);
      setStatus('已使用云端外观');
    },
    keepLocal: async () => {
      if (!cloud) return;
      const value = preview ?? saved.value;
      persist({
        ...current.current.saved,
        value: { ...value, version: cloud.version },
        pending: undefined,
      });
      setCloud(null);
      cloudRef.current = null;
      await apply(value);
    },
  };
}
export type AppearanceController = ReturnType<typeof useAppearance>;
