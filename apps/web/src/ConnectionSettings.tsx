import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { request } from './api';
import { companionKey, companionOrigin } from './companionBridge';

type Device = {
  id: string;
  name: string;
  createdAt: string;
  revokedAt: string | null;
  current: boolean;
};
export function ConnectionSettings({
  demo,
  onNotice,
  onLogout,
}: {
  demo: boolean;
  onNotice: (message: string) => void;
  onLogout: () => void;
}) {
  const [diagnosis, setDiagnosis] = useState('尚未检测桌面连接');
  const [launching, setLaunching] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [repository, setRepository] = useState('');
  const [directory, setDirectory] = useState('');
  const devices = useQuery({
    queryKey: ['devices'],
    queryFn: () => (demo ? Promise.resolve<Device[]>([]) : request<Device[]>('/devices')),
  });
  async function local<T>(path: string, body?: unknown): Promise<T> {
    const key = await companionKey();
    if (!key) throw new Error('需要 Windows 启动器提供本机连接；当前可使用浏览器看板。');
    const response = await fetch(`${companionOrigin()}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        'x-taskboard-companion-key': key,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error?.message ?? '本机连接失败');
    return result.data;
  }
  async function diagnose() {
    try {
      const result = await local<{ draft: boolean; reason?: string }>('/v1/codex/probe');
      setDiagnosis(
        result.draft ? '已连接受管理 Codex；填写前会核对项目与空白编辑器' : (result.reason ?? '尚未验证当前 Codex 的项目草稿能力'),
      );
    } catch (error) {
      setDiagnosis(error instanceof Error ? error.message : '检测失败');
    }
  }
  async function launchManagedCodex() {
    const invoke = window.__TAURI__?.core?.invoke;
    if (!invoke) return;
    setLaunching(true);
    try {
      setDiagnosis(await invoke<string>('start_managed_codex'));
    } catch (error) {
      setDiagnosis(error instanceof Error ? error.message : String(error));
    } finally {
      setLaunching(false);
    }
  }
  async function installCodexBoard() {
    setInstalling(true);
    try {
      const result = await local<{ embedded: boolean; reason?: string }>('/v1/codex/install', {});
      setDiagnosis(result.embedded ? '独立 Codex 侧栏看板已接入' : (result.reason ?? '看板接入未确认'));
    } catch (error) {
      setDiagnosis(error instanceof Error ? error.message : '看板接入失败');
    } finally { setInstalling(false); }
  }
  return (
    <>
      <h3>连接与设备</h3>
      <div className="connection-card">
        <div>
          <b>Codex 桌面接入</b>
          <p>{diagnosis}</p>
          <small>草稿只填入已验证项目的空白编辑器，发送由你确认。</small>
        </div>
        <div className="row-actions">
          {window.__TAURI__?.core?.invoke && (
            <>
              <button className="button ghost" disabled={launching} onClick={launchManagedCodex}>
                {launching ? '启动中…' : '启动独立 Codex'}
              </button>
              <button className="button ghost" disabled={installing} onClick={installCodexBoard}>
                {installing ? '接入中…' : '接入 Codex 侧栏'}
              </button>
            </>
          )}
          <button className="button ghost" onClick={diagnose}>
            检测连接
          </button>
        </div>
      </div>
      <p className="muted">
        {demo
          ? '演示数据未连接服务器。'
          : location.protocol === 'https:'
            ? '当前浏览器通过 HTTPS 访问看板。'
            : '当前为本机 HTTP 开发预览。生产部署使用 HTTPS。'}
      </p>
      {window.__TAURI__?.core?.invoke && (
        <section className="space-actions">
          <h3>本机仓库映射</h3>
          <p className="muted">填写已有目录；路径只保存在这台设备，不会自动克隆仓库。</p>
          <label className="form-label">
            仓库地址
            <input
              value={repository}
              onChange={(event) => setRepository(event.target.value)}
              placeholder="https://github.com/org/repo"
            />
          </label>
          <label className="form-label">
            本机已有目录
            <input
              value={directory}
              onChange={(event) => setDirectory(event.target.value)}
              placeholder="C:\\开发\\项目"
            />
          </label>
          <button
            className="button ghost"
            disabled={!repository || !directory}
            onClick={async () => {
              try {
                await local('/v1/mappings', { repository, path: directory });
                onNotice('本机映射已保存');
              } catch (error) {
                onNotice(error instanceof Error ? error.message : '保存映射失败');
              }
            }}
          >
            保存映射
          </button>
        </section>
      )}
      <h3>已登录设备</h3>
      {devices.error && <p className="form-error">设备列表暂不可用</p>}
      {demo && <p className="muted">真实登录后可在此撤销设备会话。</p>}
      {devices.data?.map((device) => (
        <div className="member" key={device.id}>
          <div>
            <b>
              {device.name}
              {device.current ? ' · 当前设备' : ''}
            </b>
            <small>
              {device.revokedAt ? '已撤销' : new Date(device.createdAt).toLocaleString()}
            </small>
          </div>
          <button
            className="button ghost"
            disabled={!!device.revokedAt}
            onClick={async () => {
              try {
                await request(`/devices/${device.id}/revoke`, {
                  method: 'POST',
                  body: {},
                });
                if (device.current) onLogout();
                else await devices.refetch();
              } catch (error) {
                onNotice(error instanceof Error ? error.message : '撤销失败');
              }
            }}
          >
            撤销会话
          </button>
        </div>
      ))}
      <button className="logout" onClick={onLogout}>
        退出当前设备
      </button>
    </>
  );
}
