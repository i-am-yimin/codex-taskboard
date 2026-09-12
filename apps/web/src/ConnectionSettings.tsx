import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { request } from './api';

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
  const [repository, setRepository] = useState('');
  const [directory, setDirectory] = useState('');
  const devices = useQuery({
    queryKey: ['devices'],
    queryFn: () => (demo ? Promise.resolve<Device[]>([]) : request<Device[]>('/devices')),
  });
  async function local<T>(path: string, body?: unknown): Promise<T> {
    const key = await window.__TAURI__?.core?.invoke<string>('bridge_capability');
    if (!key) throw new Error('需要 Windows 启动器提供本机连接；当前可使用浏览器看板。');
    const response = await fetch(`http://127.0.0.1:47831${path}`, {
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
        result.draft ? '已验证草稿能力' : (result.reason ?? '尚未验证当前 Codex 的项目草稿能力'),
      );
    } catch (error) {
      setDiagnosis(error instanceof Error ? error.message : '检测失败');
    }
  }
  return (
    <>
      <h3>连接与设备</h3>
      <div className="connection-card">
        <div>
          <b>Codex 桌面接入</b>
          <p>{diagnosis}</p>
          <small>任务草稿能力需独立实机验证。</small>
        </div>
        <button className="button ghost" onClick={diagnose}>
          检测连接
        </button>
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
