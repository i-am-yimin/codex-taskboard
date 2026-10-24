import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { request } from './api';
import { connectionError, localConnection as local, useCodexConnection } from './codexConnection';

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
  const codex = useCodexConnection();
  const [diagnosis, setDiagnosis] = useState<string>();
  const [launching, setLaunching] = useState(false);
  const [installing, setInstalling] = useState(false);
  const checking = codex.phase === 'checking';
  const connection = codex.connection;
  const invoke = window.__TAURI__?.core?.invoke;
  const busy = launching || installing || codex.busy;
  const [repository, setRepository] = useState('');
  const [directory, setDirectory] = useState('');
  const devices = useQuery({
    queryKey: ['devices'],
    queryFn: () => (demo ? Promise.resolve<Device[]>([]) : request<Device[]>('/devices')),
  });
  async function diagnose() {
    setDiagnosis(undefined);
    if (invoke) {
      await codex.detect();
      return;
    }
    try {
      const result = await local<{ embedded: boolean; draft: boolean; reason?: string }>(
        '/v1/codex/probe',
      );
      setDiagnosis(result.embedded ? '已接入 Codex 侧栏。' : (result.reason ?? '尚未连接 Codex'));
    } catch (error) {
      setDiagnosis(connectionError(error, '检测失败'));
    }
  }

  async function launchManagedCodex() {
    const invoke = window.__TAURI__?.core?.invoke;
    if (!invoke) return;
    setLaunching(true);
    try {
      setDiagnosis(await invoke<string>('start_managed_codex'));
    } catch (error) {
      setDiagnosis(connectionError(error, '独立测试环境启动失败'));
    } finally {
      setLaunching(false);
    }
  }
  async function installCodexBoard(daily: boolean) {
    setDiagnosis(undefined);
    if (daily) {
      await codex.connect();
      return;
    }
    setInstalling(true);
    try {
      const result = await local<{ embedded: boolean; reason?: string }>('/v1/codex/install', {});
      setDiagnosis(
        result.embedded
          ? daily
            ? '已接入日常 Codex 侧栏，原登录、项目和会话保持不变。'
            : '独立测试环境的侧栏看板已接入。'
          : (result.reason ?? '看板接入未确认'),
      );
    } catch (error) {
      setDiagnosis(connectionError(error, '看板接入失败'));
    } finally {
      setInstalling(false);
    }
  }
  return (
    <>
      <h3>连接与设备</h3>
      <div className="connection-card">
        <div>
          <b>Codex 桌面接入</b>
          <p role="status" aria-live="polite">
            {checking ? '正在检测 Codex 连接…' : (diagnosis ?? codex.diagnosis)}
          </p>
          {connection?.version && <p>Codex {connection.version}</p>}
          <small>日常接入沿用原有数据；任务草稿可复制到当前项目，由你确认发送。</small>
        </div>
        <div className="row-actions">
          {invoke && (
            <button
              className="button primary"
              disabled={busy}
              onClick={() => installCodexBoard(true)}
            >
              {codex.phase === 'waiting'
                ? '等待 Codex 退出…'
                : installing || codex.phase === 'connecting'
                  ? '接入中…'
                  : '接入日常 Codex'}
            </button>
          )}
          <button className="button ghost" disabled={busy} onClick={diagnose}>
            {checking ? '检测中…' : '检测连接'}
          </button>
          {codex.phase === 'waiting' && (
            <button className="button ghost" onClick={codex.cancelWait}>
              取消等待
            </button>
          )}
        </div>
      </div>
      {invoke && (
        <div className="codex-connection-options">
          <p className="muted">
            主界面的“连接 Codex”可直接打开或接入日常环境。首次未启用连接时，保存工作并正常退出
            Codex，Taskboard 会等待后自动接入。
          </p>
          <label className="codex-auto-connect">
            <input
              type="checkbox"
              checked={codex.autoConnect}
              onChange={(event) => codex.setAutoConnect(event.target.checked)}
            />
            启动 Taskboard 时自动连接日常 Codex
          </label>
          <p className="muted">
            首次接入成功后自动记住。以后直接打开 Taskboard，无需单独的连接快捷方式。
          </p>
          <details>
            <summary>独立测试环境</summary>
            <p className="muted">
              使用单独的数据目录，需要单独登录。用于兼容测试；日常使用请选上方接入。
            </p>
            <div className="row-actions">
              <button className="button ghost" disabled={busy} onClick={launchManagedCodex}>
                {launching ? '启动中…' : '启动独立测试 Codex'}
              </button>
              <button
                className="button ghost"
                disabled={busy}
                onClick={() => installCodexBoard(false)}
              >
                接入独立测试侧栏
              </button>
            </div>
          </details>
        </div>
      )}
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
