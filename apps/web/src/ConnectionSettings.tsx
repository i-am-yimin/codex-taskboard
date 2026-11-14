import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { request } from './api';
import { connectionError, localConnection as local, useCodexConnection } from './codexConnection';
import { CodexPreferenceWarning, CodexRestartSteps } from './CodexConnectionAction';
import { codexConnectionView } from './codexConnectionView';

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
  const view = codexConnectionView(codex);
  const [diagnosis, setDiagnosis] = useState<string>();
  const [launching, setLaunching] = useState(false);
  const checking = codex.phase === 'checking';
  const connection = codex.connection;
  const invoke = window.__TAURI__?.core?.invoke;
  const busy = launching || codex.busy;
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
      await codex.detect();
    } catch (error) {
      setDiagnosis(connectionError(error, '独立测试环境启动失败'));
    } finally {
      setLaunching(false);
    }
  }
  async function installCodexBoard() {
    setDiagnosis(undefined);
    const current = await codex.detect();
    if (current?.state !== 'connected' || current.mode !== 'managed') {
      setDiagnosis('请先启动并确认独立测试 Codex，当前连接不会按测试环境安装。');
      return;
    }
    await codex.installSidebar();
  }
  return (
    <>
      <h3>Codex 与设备</h3>
      <section
        className="connection-card codex-daily-card"
        data-connection-tone={view.tone}
        aria-label="Codex 桌面接入"
      >
        <div className="codex-card-heading">
          <b>{view.title}</b>
          <p role="status" aria-live="polite">
            {view.summary}
          </p>
        </div>
        <dl className="codex-connection-facts" aria-label="当前接入能力">
          <div>
            <dt>Codex 桌面</dt>
            <dd>{invoke ? view.native : '请在 Windows Taskboard 中连接'}</dd>
          </div>
          <div>
            <dt>侧栏看板</dt>
            <dd>{view.sidebar}</dd>
          </div>
          <div>
            <dt>任务草稿</dt>
            <dd>
              {connection?.mode === 'managed' && codex.capabilities?.draft
                ? '独立环境需再核对项目与空编辑器'
                : '手动复制，由你确认发送'}
            </dd>
          </div>
        </dl>
        {view.restart && <CodexRestartSteps />}
        <div className="row-actions">
          {invoke && (
            <button
              className="button primary"
              disabled={busy}
              onClick={() => void codex[view.action]()}
            >
              {view.label === '连接 Codex' ? '接入日常 Codex' : view.label}
            </button>
          )}
          {view.action !== 'detect' && (
            <button className="button ghost" disabled={busy} onClick={diagnose}>
              {checking ? '检测中…' : '检测连接'}
            </button>
          )}
          {codex.phase === 'waiting' && (
            <button className="button ghost" onClick={codex.cancelWait}>
              取消等待
            </button>
          )}
        </div>
        {invoke && (
          <div className="codex-connection-options codex-card-footer">
            <label className="codex-auto-connect">
              <input
                type="checkbox"
                checked={codex.autoConnect}
                aria-describedby={codex.preferenceError ? 'codex-auto-connect-error' : undefined}
                onChange={(event) => codex.setAutoConnect(event.target.checked)}
              />
              <span>
                <b>启动 Taskboard 时自动连接日常 Codex</b>
                <small>
                  首次接入成功后记住。若当前窗口尚未启用连接，仍需保存工作并正常退出一次。
                </small>
              </span>
            </label>
            <CodexPreferenceWarning id="codex-auto-connect-error" />
          </div>
        )}
        <details
          className="codex-diagnostic-details"
          open={codex.phase === 'error' || Boolean(diagnosis)}
        >
          <summary>诊断详情</summary>
          {connection?.version && <p>Codex {connection.version}</p>}
          {codex.capabilities?.sidebar?.contractId && (
            <p>结构契约：{codex.capabilities.sidebar.contractId}</p>
          )}
          <p className="codex-diagnosis-text">{diagnosis ?? codex.diagnosis}</p>
          <p className="muted">
            只为当前页面确认侧栏能力；未知结构会停止接入。Codex 升级后将重新检查。
          </p>
        </details>
      </section>
      {invoke && (
        <div className="codex-connection-options">
          <details>
            <summary>独立测试环境</summary>
            <p className="muted">
              使用专用数据目录，需要单独登录；已有测试登录与项目会保留。用于兼容测试，日常使用请选上方接入。
            </p>
            <div className="row-actions">
              <button className="button ghost" disabled={busy} onClick={launchManagedCodex}>
                {launching ? '启动中…' : '启动独立测试 Codex'}
              </button>
              <button className="button ghost" disabled={busy} onClick={installCodexBoard}>
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
